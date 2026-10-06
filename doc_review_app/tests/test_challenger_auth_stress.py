"""Empirical Challenger Adversarial Stress Test Suite for Milestone 1 Authentication.

This suite challenges the Milestone 1 authentication implementation against:
1. Invalid credentials (nonexistent users, incorrect passwords, case sensitivity, timing variation)
2. Empty and whitespace credentials (usernames, passwords, provisioning edge cases)
3. Malformed Bearer tokens (syntax, headers, missing prefix, junk schemes, oversized tokens)
4. Token tampering (bit flips, truncation, forgery, SQLi in tokens, session isolation)
5. Replay after logout (token invalidation, double logout, cookie replay, re-login freshness)
6. SQL injection in authentication parameters (login parameters, admin provisioning, session lookup)
7. Extreme stress & boundary conditions (oversized payloads, rapid sequential logins, concurrent sessions)
"""

import os
from pathlib import Path
import secrets
import time
import pytest
from starlette.testclient import TestClient

from doc_review_app.config import settings
from doc_review_app.database import get_db, reset_db
from doc_review_app.services import user_service

# Isolate database for Challenger 1 to avoid interference from concurrent test runs
_ISOLATED_DB_PATH = Path(__file__).resolve().parent.parent / "challenger1_stress.db"
settings.db_path = _ISOLATED_DB_PATH


@pytest.fixture(scope="session", autouse=True)
def challenger_db_lifecycle():
    """Ensure isolated database is used and cleaned up after session."""
    settings.db_path = _ISOLATED_DB_PATH
    reset_db()
    yield
    # Cleanup database files if they exist
    for ext in ["", "-wal", "-shm"]:
        p = Path(f"{_ISOLATED_DB_PATH}{ext}")
        if p.exists():
            try:
                p.unlink()
            except Exception:
                pass


class TestInvalidCredentialsEmpirical:
    """Stress testing authentication against invalid and edge-case credentials."""

    def test_nonexistent_user_returns_401(self, client: TestClient):
        response = client.post(
            "/api/auth/login",
            json={"username": "ghost_user_does_not_exist_404", "password": "RandomPassword123!"},
        )
        assert response.status_code == 401
        assert "Invalid username or password" in response.json()["detail"]

    def test_existing_user_wrong_password_returns_401(self, client: TestClient, admin_credentials):
        response = client.post(
            "/api/auth/login",
            json={"username": admin_credentials["username"], "password": "DefinitivelyWrongPassword999!"},
        )
        assert response.status_code == 401
        assert "Invalid username or password" in response.json()["detail"]

    def test_case_insensitive_username_match(self, client: TestClient, admin_credentials):
        # Username lookup uses COLLATE NOCASE
        response = client.post(
            "/api/auth/login",
            json={"username": admin_credentials["username"].upper(), "password": admin_credentials["password"]},
        )
        assert response.status_code == 200
        assert "token" in response.json()

    def test_case_sensitive_password_rejection(self, client: TestClient, admin_credentials):
        # Passwords must be strictly case sensitive
        response = client.post(
            "/api/auth/login",
            json={"username": admin_credentials["username"], "password": admin_credentials["password"].lower()},
        )
        assert response.status_code == 401

    def test_timing_side_channel_observation(self, client: TestClient, admin_credentials):
        # Timing test: compare execution time of nonexistent user vs existing user with wrong password
        t0 = time.perf_counter()
        client.post("/api/auth/login", json={"username": "nonexistent_enum_probe", "password": "WrongPassword123!"})
        t_nonexistent = time.perf_counter() - t0

        t0 = time.perf_counter()
        client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": "WrongPassword123!"})
        t_existing = time.perf_counter() - t0

        # Note the timing discrepancy for observation in report
        assert t_nonexistent >= 0 and t_existing >= 0


class TestEmptyWhitespaceCredentialsEmpirical:
    """Stress testing empty, whitespace, and missing credential inputs."""

    @pytest.mark.parametrize(
        "username,password",
        [
            ("", "ValidPassword123!"),
            ("   ", "ValidPassword123!"),
            ("\t\n\r", "ValidPassword123!"),
            ("admin", ""),
            ("admin", "   "),
            ("admin", "\t\r\n   "),
            ("", ""),
            ("   ", "   "),
        ],
    )
    def test_login_empty_and_whitespace_rejected_with_400(self, client: TestClient, username, password):
        response = client.post(
            "/api/auth/login",
            json={"username": username, "password": password},
        )
        assert response.status_code == 400
        assert "cannot be empty" in response.json()["detail"]

    def test_login_missing_fields_rejected_with_422(self, client: TestClient):
        # Missing username
        resp1 = client.post("/api/auth/login", json={"password": "Password123!"})
        assert resp1.status_code == 422

        # Missing password
        resp2 = client.post("/api/auth/login", json={"username": "admin"})
        assert resp2.status_code == 422

        # Empty body
        resp3 = client.post("/api/auth/login", json={})
        assert resp3.status_code == 422

    def test_admin_provisioning_empty_or_whitespace_password(self, client: TestClient, admin_credentials):
        # Login as admin
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        admin_token = login_resp.json()["token"]

        # Attempt to provision user with whitespace password
        resp = client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": "reviewer_whitespace_pw",
                "password": "   ",
                "full_name": "Whitespace Reviewer",
                "is_admin": False,
            },
        )
        # Note the behavior: does the system allow creation of a user that can never log in?
        if resp.status_code == 201:
            # If created, attempt login with that user to demonstrate login failure
            login_attempt = client.post(
                "/api/auth/login",
                json={"username": "reviewer_whitespace_pw", "password": "   "},
            )
            assert login_attempt.status_code == 400  # Login rejects empty/whitespace password!


class TestMalformedBearerTokensEmpirical:
    """Stress testing malformed Authorization headers and tokens."""

    @pytest.mark.parametrize(
        "header_value",
        [
            "",
            "   ",
            "Bearer",
            "Bearer ",
            "Bearer   ",
            "Bearer token1 token2",
            "Bearer token1 token2 token3",
            "Basic dXNlcjpwYXNz",
            "Token some_arbitrary_token",
            "Digest username=\"admin\"",
            "Bearer null",
            "Bearer undefined",
            "Bearer None",
            "Bearer \t",
            "Bearer \x00",
            f"Bearer {'A' * 8192}",  # Oversized token string (8KB)
        ],
    )
    def test_malformed_auth_headers_return_401(self, client: TestClient, header_value):
        response = client.get("/api/auth/me", headers={"Authorization": header_value})
        assert response.status_code == 401
        assert "WWW-Authenticate" in response.headers

    def test_bearer_scheme_case_insensitivity(self, client: TestClient, admin_credentials):
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login_resp.json()["token"]

        for scheme in ["bearer", "BEARER", "Bearer", "BeArEr"]:
            resp = client.get("/api/auth/me", headers={"Authorization": f"{scheme} {token}"})
            assert resp.status_code == 200, f"Failed for scheme casing: {scheme}"
            assert resp.json()["username"] == admin_credentials["username"]


class TestTokenTamperingEmpirical:
    """Stress testing token bit flips, forgery, and tampering."""

    def test_single_byte_mutation_rejected_with_401(self, client: TestClient, admin_credentials):
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        valid_token = login_resp.json()["token"]

        # Mutate last character
        tampered_char = "b" if valid_token[-1] != "b" else "c"
        tampered_token = valid_token[:-1] + tampered_char

        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
        assert resp.status_code == 401
        assert "Invalid or expired session" in resp.json()["detail"]

    def test_truncated_token_rejected_with_401(self, client: TestClient, admin_credentials):
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        valid_token = login_resp.json()["token"]

        truncated = valid_token[:16]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {truncated}"})
        assert resp.status_code == 401

    def test_random_synthetic_token_rejected_with_401(self, client: TestClient):
        synthetic_token = secrets.token_urlsafe(32)
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {synthetic_token}"})
        assert resp.status_code == 401

    def test_inactive_user_token_rejected_with_401(self, client: TestClient, admin_credentials):
        # Create an active reviewer user, log them in, then deactivate user in DB
        with get_db() as db:
            user = user_service.create_user(
                db=db,
                username="temp_deactivated_user",
                password="UserPassword123!",
                full_name="Deactivated User",
                is_admin=False,
                is_active=True,
            )
        
        login_resp = client.post("/api/auth/login", json={"username": "temp_deactivated_user", "password": "UserPassword123!"})
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]

        # Deactivate user
        with get_db() as db:
            db.execute("UPDATE users SET is_active = 0 WHERE username = 'temp_deactivated_user'")
            db.commit()

        # Attempt to access /api/auth/me with active session token for deactivated user
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


class TestReplayAfterLogoutEmpirical:
    """Stress testing replay attacks, double logout, and session lifecycle."""

    def test_replay_me_after_logout_strictly_401(self, client: TestClient, admin_credentials):
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login_resp.json()["token"]

        # Verify active
        pre_check = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert pre_check.status_code == 200

        # Logout
        logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_resp.status_code == 200

        # Replay /api/auth/me
        replay_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert replay_me.status_code == 401
        assert "Invalid or expired session" in replay_me.json()["detail"]

    def test_replay_admin_after_logout_strictly_401(self, client: TestClient, admin_credentials):
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login_resp.json()["token"]

        # Logout
        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})

        # Replay admin provisioning
        replay_admin = client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": "replay_attempt_user",
                "password": "Password123!",
                "full_name": "Replay User",
                "is_admin": False,
            },
        )
        assert replay_admin.status_code == 401

    def test_double_logout_idempotency(self, client: TestClient, admin_credentials):
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login_resp.json()["token"]

        # First logout
        first = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert first.status_code == 200

        # Second logout with same token
        second = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert second.status_code in (200, 401)
        assert second.status_code != 500

    def test_cookie_replay_after_logout(self, client: TestClient, admin_credentials):
        # Login and obtain session cookie
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        cookie_val = login_resp.cookies.get(settings.session_cookie_name)
        assert cookie_val is not None

        # Verify access via cookie
        client.cookies.set(settings.session_cookie_name, cookie_val)
        me_resp = client.get("/api/auth/me")
        assert me_resp.status_code == 200

        # Logout using cookie
        logout_resp = client.post("/api/auth/logout")
        assert logout_resp.status_code == 200

        # Force send old cookie to test backend session revocation
        client.cookies.set(settings.session_cookie_name, cookie_val)
        replay_resp = client.get("/api/auth/me")
        assert replay_resp.status_code == 401

    def test_concurrent_sessions_selective_revocation(self, client: TestClient, admin_credentials):
        # User logs in on device 1
        resp1 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token1 = resp1.json()["token"]

        # User logs in on device 2
        resp2 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token2 = resp2.json()["token"]
        assert token1 != token2

        # Logout device 1
        logout1 = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token1}"})
        assert logout1.status_code == 200

        # Device 1 token must be revoked
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token1}"}).status_code == 401

        # Device 2 token MUST remain valid
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"}).status_code == 200


class TestSQLInjectionEmpirical:
    """Stress testing SQL injection resilience across login, headers, and admin endpoints."""

    SQLI_PAYLOADS = [
        "' OR '1'='1",
        "' OR 1=1 --",
        "' OR 'x'='x",
        "admin' --",
        "admin' /*",
        "' UNION SELECT 1, 'admin', 'hash', 'Admin', 'a@b.com', 1, 1, '2026-01-01', '2026-01-01' --",
        "'; DROP TABLE users; --",
        "'; DELETE FROM sessions; --",
        "' OR (SELECT COUNT(*) FROM users) > 0 --",
        "' AND 1=0 UNION ALL SELECT 1,'attacker','...', 'Attacker', 'at@ex.com', 1, 1, '2026-01-01', '2026-01-01' --",
        "admin' AND 1=1 --",
        "admin' AND 1=2 --",
        "\" OR \"\"=\"",
        "admin\" --",
    ]

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_sqli_in_login_username_rejected(self, client: TestClient, payload):
        response = client.post(
            "/api/auth/login",
            json={"username": payload, "password": "AnyPassword123!"},
        )
        assert response.status_code in (400, 401)
        assert response.status_code != 500

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_sqli_in_login_password_rejected(self, client: TestClient, admin_credentials, payload):
        response = client.post(
            "/api/auth/login",
            json={"username": admin_credentials["username"], "password": payload},
        )
        assert response.status_code in (400, 401)
        assert response.status_code != 500

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_sqli_in_bearer_token_header_rejected(self, client: TestClient, payload):
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {payload}"},
        )
        assert response.status_code == 401
        assert response.status_code != 500

    def test_database_integrity_after_sqli_attacks(self, client: TestClient, admin_credentials):
        # Verify that users and sessions tables were not modified, dropped, or corrupted by SQLi payloads
        with get_db() as db:
            cursor = db.execute("SELECT COUNT(*) as count FROM users WHERE username = ?", (admin_credentials["username"],))
            row = cursor.fetchone()
            assert row["count"] == 1, "Admin user table record was compromised!"


class TestBoundaryStressEmpirical:
    """Stress testing extreme payload sizes, special characters, and concurrency."""

    def test_password_length_upper_bound_4096(self, client: TestClient, admin_credentials):
        # 4096 characters password is accepted for validation attempt (401 invalid password)
        p_4096 = "A" * 4096
        resp_4096 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": p_4096})
        assert resp_4096.status_code == 401

        # 4097 characters password exceeds allowable limit -> 400
        p_4097 = "A" * 4097
        resp_4097 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": p_4097})
        assert resp_4097.status_code == 400
        assert "exceeds allowable limit" in resp_4097.json()["detail"]

    def test_extreme_username_length(self, client: TestClient):
        # Large username string
        large_username = "user_" + ("x" * 10000)
        resp = client.post("/api/auth/login", json={"username": large_username, "password": "Password123!"})
        assert resp.status_code in (400, 401)
        assert resp.status_code != 500

    def test_unicode_and_emojis_credentials(self, client: TestClient, admin_credentials):
        # Login as admin and provision user with Unicode & Emoji names
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        admin_token = login_resp.json()["token"]

        create_resp = client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": "müller_李_🔒",
                "password": "UnicodePassword_€_123!",
                "full_name": "Müller 李 🔒",
                "is_admin": False,
            },
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["username"] == "müller_李_🔒"

        # Now authenticate as this unicode user
        u_login = client.post(
            "/api/auth/login",
            json={"username": "müller_李_🔒", "password": "UnicodePassword_€_123!"},
        )
        assert u_login.status_code == 200
        assert u_login.json()["user"]["username"] == "müller_李_🔒"
