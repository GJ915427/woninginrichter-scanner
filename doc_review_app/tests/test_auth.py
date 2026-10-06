"""Unit and integration test suite for authentication, authorization, and administrative CLI.

Testing Domains:
1. Cryptographic Hashing & Initials Extraction (PBKDF2, OWASP compliance, initials algorithm)
2. Authentication Lifecycle (Login, Logout, Cookie & Bearer extraction, Expiration)
3. Administrative Access Control (/api/admin/users RBAC, 201/403/401/409 codes)
4. Administrative CLI Commands (init-admin, create-user, duplicate prevention)
"""

from datetime import datetime, timedelta, timezone
from io import StringIO
import sqlite3
import sys
from typing import Any, Dict
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from doc_review_app import cli
from doc_review_app.auth import hash_password, verify_password
from doc_review_app.config import settings
from doc_review_app.database import get_db, init_db
from doc_review_app.models import compute_initials
from doc_review_app.services import user_service


# ==============================================================================
# Domain 1: Cryptographic Hashing & Initials Extraction
# ==============================================================================

class TestCryptographyAndInitials:
    """Test cryptographic guarantees and Google M3 initials extraction."""

    def test_password_hashing_structure_and_verification(self):
        """Verify PBKDF2-HMAC-SHA256 hash format and verification fidelity."""
        password = "SuperSecretPassword123!"
        hashed = hash_password(password)

        # Ensure correct algorithm and iteration count
        assert hashed.startswith("pbkdf2:sha256:600000$")
        parts = hashed.split("$")
        assert len(parts) == 3
        meta, salt_hex, derived_hex = parts
        assert len(salt_hex) == 32  # 16 bytes = 32 hex chars
        assert len(derived_hex) == 64  # 32 bytes = 64 hex chars

        # Verify correct password succeeds
        assert verify_password(password, hashed) is True

        # Verify incorrect password fails
        assert verify_password("WrongPassword!", hashed) is False

    def test_verify_password_edge_cases(self):
        """Verify corrupt, empty, and malformed password hashes fail gracefully."""
        assert verify_password("", "pbkdf2:sha256:600000$abcd$1234") is False
        assert verify_password("pass", "") is False
        assert verify_password("pass", "invalid_format_string") is False
        assert verify_password("pass", "argon2:sha256:600000$abcd$1234") is False
        assert verify_password("pass", "pbkdf2:md5:600000$abcd$1234") is False

    def test_initials_derivation_rules(self):
        """Test Material Design 3 2-letter uppercase initials extraction."""
        # Multi-word full names
        assert compute_initials(full_name="Sarah Connor") == "SC"
        assert compute_initials(full_name="Jean-Luc Picard") == "JP"
        assert compute_initials(full_name="Martin Luther King Jr.") == "MJ"

        # Single word full name
        assert compute_initials(full_name="Madonna") == "M"
        assert compute_initials(full_name="X") == "X"

        # Empty full name, fallback to username
        assert compute_initials(full_name="", username="sarah_connor") == "SC"
        assert compute_initials(full_name=None, username="john.doe") == "JD"
        assert compute_initials(full_name="   ", username="admin") == "A"

        # Explicit initials override
        assert compute_initials(full_name="Sarah Connor", explicit_initials="SCO") == "SCO"

        # Ultimate fallback
        assert compute_initials(full_name=None, username=None) == "US"


# ==============================================================================
# Domain 2: Authentication Lifecycle
# ==============================================================================

class TestAuthenticationLifecycle:
    """Test login, logout, cookie/bearer extraction, and session expiration."""

    def test_login_success_with_valid_credentials(self, client: TestClient, admin_credentials: Dict[str, Any]):
        """Successful login returns 200, valid token, user profile, and session cookie."""
        resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data and len(data["token"]) > 20
        assert "user" in data
        assert data["user"]["username"] == admin_credentials["username"]
        assert data["user"]["is_admin"] is True

        # Check HTTP-only cookie set
        assert settings.session_cookie_name in resp.cookies

    def test_login_invalid_password_returns_401(self, client: TestClient, admin_credentials: Dict[str, Any]):
        """Login with incorrect password returns 401 Unauthorized."""
        resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": "WrongPassword123!",
        })
        assert resp.status_code == 401
        assert "Invalid username or password" in resp.text

    def test_login_nonexistent_user_returns_401(self, client: TestClient):
        """Login with unknown username returns 401 Unauthorized."""
        resp = client.post("/api/auth/login", json={
            "username": "ghost_user_does_not_exist",
            "password": "SomePassword123!",
        })
        assert resp.status_code == 401

    def test_login_empty_payload_validation(self, client: TestClient):
        """Empty username or password returns 400 Bad Request."""
        resp1 = client.post("/api/auth/login", json={"username": "", "password": "Password123!"})
        assert resp1.status_code in (400, 422)

        resp2 = client.post("/api/auth/login", json={"username": "admin", "password": ""})
        assert resp2.status_code in (400, 422)

    def test_me_endpoint_with_bearer_token(self, client: TestClient, admin_credentials: Dict[str, Any]):
        """GET /api/auth/me returns profile when authenticated via Bearer token."""
        login_resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"],
        })
        token = login_resp.json()["token"]

        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        profile = me_resp.json()
        assert profile["username"] == admin_credentials["username"]
        assert "initials" in profile
        assert profile["is_admin"] is True

    def test_me_endpoint_with_cookie(self, client: TestClient, admin_credentials: Dict[str, Any]):
        """GET /api/auth/me returns profile when authenticated via session cookie."""
        login_resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"],
        })
        token = login_resp.json()["token"]

        # Call /me passing cookie without Authorization header
        me_resp = client.get("/api/auth/me", cookies={settings.session_cookie_name: token})
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == admin_credentials["username"]

    def test_me_endpoint_unauthenticated_returns_401(self, client: TestClient):
        """GET /api/auth/me returns 401 when no token or cookie provided."""
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_logout_revokes_token_and_clears_cookie(self, client: TestClient, admin_credentials: Dict[str, Any]):
        """POST /api/auth/logout revokes session and clears cookie."""
        login_resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"],
        })
        token = login_resp.json()["token"]

        logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_resp.status_code == 200
        assert logout_resp.json()["status"] == "success"

        # Verify token is now invalid
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 401

    def test_expired_session_handling(self, client: TestClient, admin_credentials: Dict[str, Any]):
        """Expired session token is rejected with 401 and cleaned up."""
        # Manually insert an expired session
        with get_db() as db:
            user = user_service.get_user_by_username(db, admin_credentials["username"])
            assert user is not None
            expired_token = "test_expired_token_12345"
            past_time = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            db.execute(
                "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (expired_token, user["id"], past_time, past_time),
            )

        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert resp.status_code == 401

        # Check session was deleted from database
        with get_db() as db:
            cursor = db.execute("SELECT * FROM sessions WHERE token = ?", (expired_token,))
            assert cursor.fetchone() is None


# ==============================================================================
# Domain 3: Administrative Access Control
# ==============================================================================

class TestAdminAccessControl:
    """Test /api/admin/users endpoint role-based access control and provisioning."""

    def test_admin_can_provision_reviewer(self, client: TestClient, auth_headers_admin: Dict[str, str]):
        """Admin can provision a new reviewer user with 201 Created."""
        payload = {
            "username": "reviewer_unit_test_01",
            "password": "Password123!",
            "full_name": "Unit Reviewer",
            "is_admin": False,
        }
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json=payload)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["username"] == payload["username"]
        assert data["initials"] == "UR"
        assert data["is_admin"] is False
        assert "password" not in data
        assert "password_hash" not in data

    def test_admin_can_provision_secondary_admin(self, client: TestClient, auth_headers_admin: Dict[str, str]):
        """Admin can provision another administrator user."""
        payload = {
            "username": "admin_secondary_01",
            "password": "AdminPassword123!",
            "full_name": "Secondary Admin",
            "is_admin": True,
        }
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json=payload)
        assert resp.status_code in (200, 201)
        assert resp.json()["is_admin"] is True

    def test_non_admin_cannot_provision_user_returns_403(self, client: TestClient, auth_headers_reviewer1: Dict[str, str]):
        """Non-admin reviewer cannot provision users, receiving 403 Forbidden."""
        payload = {
            "username": "hacker_account",
            "password": "Password123!",
            "full_name": "Hacker Account",
            "is_admin": False,
        }
        resp = client.post("/api/admin/users", headers=auth_headers_reviewer1, json=payload)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_provision_user_returns_401(self, client: TestClient):
        """Unauthenticated caller receives 401 Unauthorized on admin endpoint."""
        payload = {
            "username": "anon_account",
            "password": "Password123!",
            "full_name": "Anon Account",
            "is_admin": False,
        }
        resp = client.post("/api/admin/users", json=payload)
        assert resp.status_code == 401

    def test_duplicate_username_returns_409(self, client: TestClient, auth_headers_admin: Dict[str, str]):
        """Creating an existing username returns 409 Conflict."""
        payload = {
            "username": "duplicate_check_user",
            "password": "Password123!",
            "full_name": "Duplicate Check",
            "is_admin": False,
        }
        resp1 = client.post("/api/admin/users", headers=auth_headers_admin, json=payload)
        assert resp1.status_code in (200, 201)

        resp2 = client.post("/api/admin/users", headers=auth_headers_admin, json=payload)
        assert resp2.status_code in (400, 409, 422)

    def test_admin_list_users(self, client: TestClient, auth_headers_admin: Dict[str, str]):
        """Admin can list all provisioned users."""
        resp = client.get("/api/admin/users", headers=auth_headers_admin)
        assert resp.status_code == 200
        users = resp.json()
        assert isinstance(users, list)
        assert len(users) >= 1
        assert any(u["username"] == settings.admin_username for u in users)

    def test_non_admin_cannot_list_users_returns_403(self, client: TestClient, auth_headers_reviewer1: Dict[str, str]):
        """Non-admin reviewer cannot list users, receiving 403 Forbidden."""
        resp = client.get("/api/admin/users", headers=auth_headers_reviewer1)
        assert resp.status_code == 403


# ==============================================================================
# Domain 4: Administrative CLI Commands
# ==============================================================================

class TestAdminCLICommands:
    """Test administrative CLI subcommands (init-admin, create-user)."""

    def test_cli_init_admin_creates_root_admin(self, tmp_path):
        """init-admin successfully provisions administrator."""
        test_db = str(tmp_path / "cli_test_1.db")
        code = cli.main([
            "--db-path", test_db,
            "init-admin",
            "--username", "root_cli_admin",
            "--password", "CliAdminPass123!",
            "--full-name", "Root CLI Admin",
            "--initials", "RCA",
        ])
        assert code == 0

        # Verify user in database
        with get_db(test_db) as db:
            user = user_service.get_user_by_username(db, "root_cli_admin")
            assert user is not None
            assert user["initials"] == "RCA"
            assert user["is_admin"] == 1

    def test_cli_init_admin_duplicate_fails(self, tmp_path):
        """init-admin with existing username exits with code 1."""
        test_db = str(tmp_path / "cli_test_2.db")
        code1 = cli.main([
            "--db-path", test_db,
            "init-admin",
            "--username", "dup_admin",
            "--password", "Pass123!",
            "--full-name", "Dup Admin",
        ])
        assert code1 == 0

        # Run again with same username
        code2 = cli.main([
            "--db-path", test_db,
            "init-admin",
            "--username", "dup_admin",
            "--password", "Pass123!",
            "--full-name", "Dup Admin",
        ])
        assert code2 == 1

    def test_cli_create_user_reviewer(self, tmp_path):
        """create-user provisions reviewer account."""
        test_db = str(tmp_path / "cli_test_3.db")
        init_db(test_db)

        code = cli.main([
            "--db-path", test_db,
            "create-user",
            "--username", "cli_reviewer",
            "--password", "ReviewerPass123!",
            "--full-name", "CLI Reviewer",
        ])
        assert code == 0

        with get_db(test_db) as db:
            user = user_service.get_user_by_username(db, "cli_reviewer")
            assert user is not None
            assert user["is_admin"] == 0
            assert user["initials"] == "CR"

    def test_cli_create_user_as_admin(self, tmp_path):
        """create-user with --admin flag provisions administrator."""
        test_db = str(tmp_path / "cli_test_4.db")
        init_db(test_db)

        code = cli.main([
            "--db-path", test_db,
            "create-user",
            "--username", "cli_extra_admin",
            "--password", "ExtraAdminPass123!",
            "--full-name", "Extra Admin",
            "--admin",
        ])
        assert code == 0

        with get_db(test_db) as db:
            user = user_service.get_user_by_username(db, "cli_extra_admin")
            assert user is not None
            assert user["is_admin"] == 1

    def test_cli_create_user_duplicate_fails(self, tmp_path):
        """create-user with existing username returns code 1."""
        test_db = str(tmp_path / "cli_test_5.db")
        init_db(test_db)

        cli.main([
            "--db-path", test_db,
            "create-user",
            "--username", "cli_dup_user",
            "--password", "Pass123!",
            "--full-name", "First User",
        ])

        code = cli.main([
            "--db-path", test_db,
            "create-user",
            "--username", "cli_dup_user",
            "--password", "Pass123!",
            "--full-name", "Second User",
        ])
        assert code == 1
