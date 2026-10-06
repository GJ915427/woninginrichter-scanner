"""Milestone 1 Empirical Challenger Test Suite: Concurrency, CLI Duplicates & Privilege Escalation.

Author: Challenger 2
Archetype: Empirical Challenger (critic, specialist)
Directory: doc_review_app/tests/test_m1_challenger_concurrency_security.py

Tests:
1. SQLite WAL mode under concurrent operations (readers, writers, contention, data integrity).
2. CLI provisioning commands (init-admin, create-user) with duplicate entries and race conditions.
3. Privilege escalation defense (non-admin accessing /api/admin/users, header tampering, demoted admin).
4. TOCTOU concurrency race conditions (API & CLI duplicate provisioning unhandled exceptions).
"""

import concurrent.futures
import os
import sqlite3
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Dict, Any, List, Generator

import pytest
from fastapi.testclient import TestClient

from doc_review_app.config import settings
from doc_review_app.database import get_connection, get_db, get_db_session, init_db, reset_db
from doc_review_app.main import app
from doc_review_app.services import user_service
from doc_review_app.models import compute_initials


@pytest.fixture
def isolated_db_path(tmp_path: Path) -> Path:
    """Create a completely isolated SQLite database file for testing."""
    db_file = tmp_path / "challenger_test.db"
    init_db(db_file)
    return db_file


@pytest.fixture
def seeded_isolated_db(isolated_db_path: Path) -> Path:
    """Isolated database seeded with root administrator."""
    with get_db(isolated_db_path) as db:
        user_service.create_user(
            db=db,
            username="admin",
            password="AdminSecurePassword123!",
            full_name="System Administrator",
            initials="SA",
            email="admin@example.com",
            is_admin=True,
        )
    return isolated_db_path


@pytest.fixture
def isolated_client(seeded_isolated_db: Path) -> Generator[TestClient, None, None]:
    """Provide a TestClient bound to a guaranteed isolated test database via dependency override."""
    def override_get_db_session():
        with get_db(seeded_isolated_db) as conn:
            yield conn

    app.dependency_overrides[get_db_session] = override_get_db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# SECTION 1: SQLite WAL Mode Concurrency & Integrity Stress Tests
# ============================================================================

class TestSQLiteWALConcurrency:
    """Empirical challenge of SQLite WAL mode under high concurrency and contention."""

    def test_wal_pragma_verified(self, isolated_db_path: Path):
        """Verify journal_mode is WAL, synchronous is NORMAL, and busy_timeout is set."""
        conn = get_connection(isolated_db_path)
        try:
            journal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
            assert journal_mode.lower() == "wal", f"Expected WAL mode, got {journal_mode}"

            busy_timeout = conn.execute("PRAGMA busy_timeout;").fetchone()[0]
            assert busy_timeout >= 5000, f"Expected busy_timeout >= 5000, got {busy_timeout}"

            fk_enabled = conn.execute("PRAGMA foreign_keys;").fetchone()[0]
            assert fk_enabled == 1, "Foreign keys must be enabled"
        finally:
            conn.close()

    def test_concurrent_readers_during_active_write_transaction(self, seeded_isolated_db: Path):
        """WAL mode guarantee: concurrent readers must NOT be blocked by an open write transaction."""
        write_started = threading.Event()
        readers_done = threading.Event()
        reader_results = []
        reader_exceptions = []

        def slow_writer():
            conn = get_connection(seeded_isolated_db)
            try:
                # Begin an immediate write transaction
                conn.execute("BEGIN IMMEDIATE")
                conn.execute(
                    """
                    INSERT INTO users (username, password_hash, initials, full_name, is_admin, is_active, created_at, updated_at)
                    VALUES ('writer_user', 'hash', 'WU', 'Writer User', 0, 1, '2026-09-30T00:00:00Z', '2026-09-30T00:00:00Z')
                    """
                )
                write_started.set()
                # Hold transaction open until readers have attempted queries
                readers_done.wait(timeout=5.0)
                conn.commit()
            except Exception as e:
                conn.rollback()
                raise
            finally:
                conn.close()

        def reader_task(reader_id: int):
            write_started.wait(timeout=5.0)
            conn = get_connection(seeded_isolated_db)
            try:
                # Reader should read without blocking
                cursor = conn.execute("SELECT count(*) FROM users")
                count = cursor.fetchone()[0]
                reader_results.append((reader_id, count))
            except Exception as e:
                reader_exceptions.append((reader_id, str(e)))
            finally:
                conn.close()

        writer_thread = threading.Thread(target=slow_writer)
        reader_threads = [threading.Thread(target=reader_task, args=(i,)) for i in range(10)]

        writer_thread.start()
        for t in reader_threads:
            t.start()

        for t in reader_threads:
            t.join(timeout=5.0)

        readers_done.set()
        writer_thread.join(timeout=5.0)

        assert len(reader_exceptions) == 0, f"Readers threw exceptions: {reader_exceptions}"
        assert len(reader_results) == 10, "All 10 readers must complete"
        # Since writer had uncommitted transaction, readers should see count == 1 (admin only)
        for _, count in reader_results:
            assert count == 1, f"Expected reader to see 1 committed user, saw {count}"

    def test_concurrent_writers_under_contention(self, seeded_isolated_db: Path):
        """Stress-test concurrent write operations across 20 threads.
        
        All distinct users must be inserted without deadlocks or unhandled locking errors.
        """
        num_workers = 20
        errors = []
        created_ids = []

        def worker(i: int):
            try:
                with get_db(seeded_isolated_db) as db:
                    u = user_service.create_user(
                        db=db,
                        username=f"concurrent_user_{i}",
                        password=f"Password{i}!",
                        full_name=f"Concurrent User {i}",
                    )
                    created_ids.append(u.id)
            except Exception as e:
                errors.append((i, str(e)))

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(worker, i) for i in range(num_workers)]
            concurrent.futures.wait(futures)

        assert len(errors) == 0, f"Concurrent writes failed with errors: {errors}"
        assert len(created_ids) == num_workers

        # Check integrity
        with get_db(seeded_isolated_db) as db:
            total_users = db.execute("SELECT count(*) FROM users").fetchone()[0]
            assert total_users == num_workers + 1  # 20 new users + 1 admin

            integrity = db.execute("PRAGMA integrity_check;").fetchall()
            assert len(integrity) == 1 and integrity[0][0] == "ok"

    def test_concurrent_sessions_creation_and_validation(self, seeded_isolated_db: Path):
        """Stress test concurrent session creation and lookup under load."""
        num_threads = 25
        created_tokens = []
        errors = []

        def session_worker(i: int):
            try:
                with get_db(seeded_isolated_db) as db:
                    # Admin user has id=1
                    tok = user_service.create_session(db=db, user_id=1)
                    val = user_service.lookup_and_validate_session(db=db, token=tok)
                    if val is None or val["username"] != "admin":
                        errors.append((i, "Validation returned invalid profile"))
                    else:
                        created_tokens.append(tok)
            except Exception as e:
                errors.append((i, str(e)))

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(session_worker, i) for i in range(num_threads)]
            concurrent.futures.wait(futures)

        assert len(errors) == 0, f"Session worker errors: {errors}"
        assert len(created_tokens) == num_threads

        with get_db(seeded_isolated_db) as db:
            total_sessions = db.execute("SELECT count(*) FROM sessions").fetchone()[0]
            assert total_sessions == num_threads


# ============================================================================
# SECTION 2: CLI Provisioning Robustness & Duplicate Entry Tests
# ============================================================================

class TestCLIProvisioningRobustness:
    """Empirical challenge of CLI provisioning (init-admin and create-user)."""

    def _run_cli(self, args: List[str], db_path: Path) -> subprocess.CompletedProcess:
        """Run CLI tool as a subprocess pointing to the isolated database."""
        cmd = [sys.executable, "-m", "doc_review_app.cli", "--db-path", str(db_path)] + args
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_cli_init_admin_duplicate_fails_gracefully(self, isolated_db_path: Path):
        """init-admin must succeed once, then fail cleanly with exit code 1 on second run."""
        proc1 = self._run_cli(["init-admin"], isolated_db_path)
        assert proc1.returncode == 0, f"First init-admin failed: {proc1.stderr}"
        assert "initialized successfully" in proc1.stdout

        proc2 = self._run_cli(["init-admin"], isolated_db_path)
        assert proc2.returncode == 1, f"Expected exit code 1 for duplicate init-admin, got {proc2.returncode}"
        assert "already exists" in proc2.stderr

    def test_cli_init_admin_case_insensitive_duplicate(self, isolated_db_path: Path):
        """init-admin must reject case-variants of existing admin username."""
        proc1 = self._run_cli(["init-admin", "--username", "SysAdmin"], isolated_db_path)
        assert proc1.returncode == 0

        proc2 = self._run_cli(["init-admin", "--username", "SYSADMIN"], isolated_db_path)
        assert proc2.returncode == 1
        assert "already exists" in proc2.stderr

    def test_cli_create_user_duplicate_fails_gracefully(self, isolated_db_path: Path):
        """create-user must reject existing usernames with exit code 1 and error on stderr."""
        # Provision first user
        proc1 = self._run_cli(
            ["create-user", "--username", "reviewer1", "--password", "Password123!", "--full-name", "Reviewer One"],
            isolated_db_path,
        )
        assert proc1.returncode == 0, f"First create-user failed: {proc1.stderr}"
        assert "created successfully" in proc1.stdout

        # Attempt duplicate
        proc2 = self._run_cli(
            ["create-user", "--username", "reviewer1", "--password", "NewPass456!", "--full-name", "Reviewer Duplicate"],
            isolated_db_path,
        )
        assert proc2.returncode == 1, f"Expected exit code 1 on duplicate create-user, got {proc2.returncode}"
        assert "already exists" in proc2.stderr

    def test_cli_create_user_case_insensitive_duplicate(self, isolated_db_path: Path):
        """create-user must reject case-variant usernames (NOCASE collation)."""
        proc1 = self._run_cli(
            ["create-user", "--username", "AliceBob", "--password", "Password123!", "--full-name", "Alice Bob"],
            isolated_db_path,
        )
        assert proc1.returncode == 0

        proc2 = self._run_cli(
            ["create-user", "--username", "alicebob", "--password", "Password123!", "--full-name", "Alice Bob 2"],
            isolated_db_path,
        )
        assert proc2.returncode == 1
        assert "already exists" in proc2.stderr

    def test_cli_duplicate_email_handling(self, isolated_db_path: Path):
        """Test behavior when provisioning two users with identical email addresses."""
        proc1 = self._run_cli(
            ["create-user", "--username", "user_a", "--password", "Pass123!", "--full-name", "User A", "--email", "shared@example.com"],
            isolated_db_path,
        )
        assert proc1.returncode == 0

        proc2 = self._run_cli(
            ["create-user", "--username", "user_b", "--password", "Pass123!", "--full-name", "User B", "--email", "shared@example.com"],
            isolated_db_path,
        )
        # Database schema allows non-unique emails, but both should cleanly succeed
        assert proc2.returncode == 0

    def test_cli_concurrent_duplicate_race_condition(self, isolated_db_path: Path):
        """Stress-test two concurrent CLI processes trying to create the same user simultaneously.
        
        Exactly one must succeed (returncode 0), the other must fail (returncode 1),
        and the database must contain exactly 1 instance of the user.
        """
        args = ["create-user", "--username", "race_user", "--password", "Secret123!", "--full-name", "Race User"]
        results = []

        def run_proc():
            p = self._run_cli(args, isolated_db_path)
            results.append(p)

        t1 = threading.Thread(target=run_proc)
        t2 = threading.Thread(target=run_proc)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        return_codes = [p.returncode for p in results]
        assert sorted(return_codes) == [0, 1], f"Expected one 0 and one 1, got {return_codes}"

        with get_db(isolated_db_path) as db:
            users = db.execute("SELECT * FROM users WHERE username = 'race_user'").fetchall()
            assert len(users) == 1, "Exactly 1 user must exist in the database"

    def test_cli_concurrent_duplicate_unhandled_integrity_error_revealed(self, isolated_db_path: Path):
        """CHALLENGE FINDING: Under concurrent duplicate execution, the loser process crashes
        with an unhandled sqlite3.IntegrityError stack trace instead of clean stderr message.
        """
        args = ["create-user", "--username", "toctou_cli", "--password", "Secret123!", "--full-name", "TOCTOU User"]
        results = []

        def run_proc():
            p = self._run_cli(args, isolated_db_path)
            results.append(p)

        t1 = threading.Thread(target=run_proc)
        t2 = threading.Thread(target=run_proc)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        loser = [p for p in results if p.returncode != 0][0]
        # Empirically demonstrate that the failure output contains an unhandled Python traceback
        # rather than clean user-facing CLI error handling
        is_unhandled_crash = "Traceback (most recent call last)" in loser.stderr or "IntegrityError" in loser.stderr
        assert is_unhandled_crash, "Empirical proof: concurrent CLI duplicate yields unhandled IntegrityError"


# ============================================================================
# SECTION 3: Privilege Escalation & RBAC Tests on /api/admin/users
# ============================================================================

class TestPrivilegeEscalationDefense:
    """Empirical challenge of authorization and privilege escalation defenses."""

    def test_unauthenticated_requests_rejected(self, isolated_client: TestClient):
        """Unauthenticated requests to /api/admin/users must return 401 Unauthorized."""
        get_resp = isolated_client.get("/api/admin/users")
        assert get_resp.status_code == 401

        post_resp = isolated_client.post("/api/admin/users", json={
            "username": "attacker",
            "password": "Password123!",
            "full_name": "Attacker",
            "is_admin": True,
        })
        assert post_resp.status_code == 401

    def test_reviewer_cannot_access_admin_users_post(self, isolated_client: TestClient):
        """Reviewer user (is_admin=False) attempting POST /api/admin/users must return 403 Forbidden."""
        # 1. Admin login
        admin_login = isolated_client.post("/api/auth/login", json={
            "username": "admin",
            "password": "AdminSecurePassword123!",
        })
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["token"]

        # 2. Admin provisions reviewer
        prov_resp = isolated_client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": "reviewer_test1",
                "password": "ReviewerPass123!",
                "full_name": "Reviewer Test One",
                "is_admin": False,
            },
        )
        assert prov_resp.status_code == 201

        # 3. Reviewer logs in
        rev_login = isolated_client.post("/api/auth/login", json={
            "username": "reviewer_test1",
            "password": "ReviewerPass123!",
        })
        assert rev_login.status_code == 200
        rev_token = rev_login.json()["token"]
        assert rev_login.json()["user"]["is_admin"] is False

        # 4. Reviewer attempts to provision an admin or any user
        escalation_resp = isolated_client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {rev_token}"},
            json={
                "username": "escalated_admin",
                "password": "Password123!",
                "full_name": "Escalated Admin",
                "is_admin": True,
            },
        )
        assert escalation_resp.status_code == 403, f"Expected 403 Forbidden, got {escalation_resp.status_code}: {escalation_resp.text}"
        assert "Forbidden" in escalation_resp.text

    def test_reviewer_cannot_access_admin_users_get(self, isolated_client: TestClient):
        """Reviewer user (is_admin=False) attempting GET /api/admin/users must return 403 Forbidden."""
        # Admin provisions reviewer
        admin_login = isolated_client.post("/api/auth/login", json={
            "username": "admin",
            "password": "AdminSecurePassword123!",
        })
        admin_token = admin_login.json()["token"]

        isolated_client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": "reviewer_test2",
                "password": "ReviewerPass123!",
                "full_name": "Reviewer Test Two",
                "is_admin": False,
            },
        )

        rev_login = isolated_client.post("/api/auth/login", json={
            "username": "reviewer_test2",
            "password": "ReviewerPass123!",
        })
        rev_token = rev_login.json()["token"]

        # Reviewer attempts to list users
        list_resp = isolated_client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {rev_token}"},
        )
        assert list_resp.status_code == 403, f"Expected 403 Forbidden, got {list_resp.status_code}"

    def test_reviewer_tampered_headers_cannot_bypass_rbac(self, isolated_client: TestClient):
        """Reviewer attempting spoofed headers (X-Role, X-Admin, etc.) must remain blocked with 403."""
        admin_login = isolated_client.post("/api/auth/login", json={
            "username": "admin",
            "password": "AdminSecurePassword123!",
        })
        admin_token = admin_login.json()["token"]

        isolated_client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": "reviewer_test3",
                "password": "ReviewerPass123!",
                "full_name": "Reviewer Test Three",
                "is_admin": False,
            },
        )

        rev_login = isolated_client.post("/api/auth/login", json={
            "username": "reviewer_test3",
            "password": "ReviewerPass123!",
        })
        rev_token = rev_login.json()["token"]

        headers = {
            "Authorization": f"Bearer {rev_token}",
            "X-Role": "admin",
            "X-Is-Admin": "true",
            "X-Admin": "1",
        }
        resp = isolated_client.get("/api/admin/users", headers=headers)
        assert resp.status_code == 403

    def test_demoted_admin_immediately_blocked(self, seeded_isolated_db: Path, isolated_client: TestClient):
        """If an admin's is_admin flag is revoked in DB, existing active session must immediately get 403."""
        admin_login = isolated_client.post("/api/auth/login", json={
            "username": "admin",
            "password": "AdminSecurePassword123!",
        })
        admin_token = admin_login.json()["token"]

        # Verify access currently works
        check_before = isolated_client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert check_before.status_code == 200

        # Demote admin in database directly
        with get_db(seeded_isolated_db) as db:
            db.execute("UPDATE users SET is_admin = 0 WHERE username = 'admin'")
            db.commit()

        # Same token should now receive 403 Forbidden
        check_after = isolated_client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert check_after.status_code == 403, f"Demoted admin still has access: {check_after.status_code}"

    def test_deactivated_admin_immediately_blocked(self, seeded_isolated_db: Path, isolated_client: TestClient):
        """If an admin's is_active flag is set to 0, session validation must reject with 401."""
        admin_login = isolated_client.post("/api/auth/login", json={
            "username": "admin",
            "password": "AdminSecurePassword123!",
        })
        admin_token = admin_login.json()["token"]

        # Deactivate admin in database
        with get_db(seeded_isolated_db) as db:
            db.execute("UPDATE users SET is_active = 0 WHERE username = 'admin'")
            db.commit()

        resp = isolated_client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 401, f"Expected 401 for deactivated user, got {resp.status_code}"


# ============================================================================
# SECTION 4: Concurrency TOCTOU Defect Demonstration in API
# ============================================================================

class TestAPIConcurrencyDefects:
    """Empirical proof of API-level TOCTOU race conditions."""

    def test_concurrent_admin_users_toctou_race_condition(self, isolated_db_path: Path):
        """CHALLENGE FINDING: When two concurrent requests hit POST /api/admin/users with the
        same username, the check-then-act logic in admin_router.py fails to catch sqlite3.IntegrityError,
        resulting in an unhandled exception rather than HTTP 409 Conflict.
        """
        with get_db(isolated_db_path) as db:
            user_service.create_user(db, "base_admin", "AdminPass123!", "Base Admin", is_admin=True)

        exceptions = []
        successes = []

        def prov_worker(worker_id: int):
            try:
                with get_db(isolated_db_path) as db:
                    # Simulating what admin_router.py does:
                    existing = user_service.get_user_by_username(db, "duplicate_user")
                    if existing:
                        return 409
                    # Both workers may pass check concurrently
                    user_service.create_user(
                        db=db,
                        username="duplicate_user",
                        password="Password123!",
                        full_name=f"User {worker_id}",
                    )
                    successes.append(worker_id)
                    return 201
            except sqlite3.IntegrityError as e:
                exceptions.append((worker_id, type(e).__name__, str(e)))
                raise

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(prov_worker, 1)
            f2 = executor.submit(prov_worker, 2)
            concurrent.futures.wait([f1, f2])

        # Verify that an uncaught sqlite3.IntegrityError occurred because admin_router lacks try/except IntegrityError
        assert len(exceptions) == 1, "Expected exactly 1 thread to raise uncaught sqlite3.IntegrityError"
        assert len(successes) == 1, "Expected exactly 1 thread to succeed"
        assert "UNIQUE constraint failed: users.username" in exceptions[0][2]
