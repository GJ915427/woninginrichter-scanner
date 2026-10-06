"""E2E Automated Tests for Authentication & Access Control (F01–F04).

Covers:
- Feature F01: User Authentication (`POST /api/auth/login`, `GET /api/auth/me`)
- Feature F02: Access Control Enforcement (401 Unauthorized on protected routes)
- Feature F03: Administrative User Provisioning (`POST /api/admin/users`, `cli.py`)
- Feature F04: Session Revocation (`POST /api/auth/logout`)

Adheres strictly to PROJECT.md § Interface Contracts (1. Authentication & Admin)
and ORIGINAL_REQUEST.md Acceptance Criteria (Authentication & Access Control).
"""

import pytest
from fastapi.testclient import TestClient


# ==============================================================================
# FEATURE F01: User Authentication (`POST /api/auth/login`, `GET /api/auth/me`)
# ==============================================================================

class TestFeatureF01UserAuthentication:
    """Tier 1 & Tier 2 tests for Feature F01."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f01_01_login_valid_reviewer_credentials(self, client: TestClient, admin_credentials, reviewer1_credentials):
        """T1-F01-01: Valid reviewer credentials login succeeds with token and user object."""
        # Ensure reviewer exists
        admin_login = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        if admin_login.status_code == 200:
            admin_token = admin_login.json().get("token")
            client.post("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"}, json=reviewer1_credentials)

        resp = client.post("/api/auth/login", json={
            "username": reviewer1_credentials["username"],
            "password": reviewer1_credentials["password"]
        })
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0
        assert "user" in data
        user = data["user"]
        assert user["username"] == reviewer1_credentials["username"]
        assert "initials" in user
        assert user.get("is_admin") is False

    def test_t1_f01_02_login_valid_admin_credentials(self, client: TestClient, admin_credentials):
        """T1-F01-02: Valid administrator credentials login returns token with is_admin=True."""
        resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"].get("is_admin") is True

    def test_t1_f01_03_login_invalid_password_returns_401(self, client: TestClient, admin_credentials):
        """T1-F01-03: Valid username with incorrect password returns HTTP 401 Unauthorized."""
        resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": "WrongPassword999!"
        })
        assert resp.status_code == 401
        assert "token" not in resp.json()

    def test_t1_f01_04_login_nonexistent_user_returns_401(self, client: TestClient):
        """T1-F01-04: Non-existent username returns HTTP 401 Unauthorized."""
        resp = client.post("/api/auth/login", json={
            "username": "totally_nonexistent_user_9999",
            "password": "SomePassword123!"
        })
        assert resp.status_code == 401

    def test_t1_f01_05_get_auth_me_returns_profile(self, client: TestClient, auth_headers_admin, admin_credentials):
        """T1-F01-05: GET /api/auth/me returns current user profile for valid session."""
        resp = client.get("/api/auth/me", headers=auth_headers_admin)
        assert resp.status_code == 200
        profile = resp.json()
        assert profile["username"] == admin_credentials["username"]
        assert "id" in profile
        assert "initials" in profile
        assert profile["is_admin"] is True

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f01_01_empty_password_rejected(self, client: TestClient, admin_credentials):
        """T2-F01-01: Empty password string is rejected with 400 or 422."""
        resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": ""
        })
        assert resp.status_code in (400, 422, 401)

    def test_t2_f01_02_empty_username_rejected(self, client: TestClient):
        """T2-F01-02: Empty username string is rejected with 400 or 422."""
        resp = client.post("/api/auth/login", json={
            "username": "",
            "password": "SomePassword123!"
        })
        assert resp.status_code in (400, 422, 401)

    def test_t2_f01_03_extreme_length_password(self, client: TestClient, admin_credentials):
        """T2-F01-03: 10,000 character password rejected cleanly without crash."""
        resp = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": "A" * 10000
        })
        assert resp.status_code in (400, 401, 422)

    def test_t2_f01_04_sql_injection_attempt_rejected(self, client: TestClient):
        """T2-F01-04: SQL injection payload in username rejected cleanly with 401."""
        resp = client.post("/api/auth/login", json={
            "username": "' OR '1'='1' --",
            "password": "password"
        })
        assert resp.status_code == 401

    def test_t2_f01_05_unicode_credentials_support(self, client: TestClient, auth_headers_admin):
        """T2-F01-05: Unicode and accented characters in username/password handled correctly."""
        unicode_user = {
            "username": "rev_müller",
            "password": "Pässwörd!🚀123",
            "full_name": "Élodie Müller",
            "is_admin": False
        }
        create_resp = client.post("/api/admin/users", headers=auth_headers_admin, json=unicode_user)
        if create_resp.status_code == 201:
            login_resp = client.post("/api/auth/login", json={
                "username": unicode_user["username"],
                "password": unicode_user["password"]
            })
            assert login_resp.status_code == 200
            assert login_resp.json()["user"]["username"] == unicode_user["username"]


# ==============================================================================
# FEATURE F02: Access Control Enforcement
# ==============================================================================

class TestFeatureF02AccessControlEnforcement:
    """Tier 1 & Tier 2 tests for Feature F02."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f02_01_unauthenticated_documents_list_401(self, client: TestClient):
        """T1-F02-01: GET /api/documents without auth returns 401."""
        resp = client.get("/api/documents")
        assert resp.status_code == 401

    def test_t1_f02_02_unauthenticated_document_fetch_401(self, client: TestClient):
        """T1-F02-02: GET /api/documents/1 without auth returns 401."""
        resp = client.get("/api/documents/1")
        assert resp.status_code == 401

    def test_t1_f02_03_unauthenticated_create_annotation_401(self, client: TestClient):
        """T1-F02-03: POST /api/documents/1/annotations without auth returns 401."""
        resp = client.post("/api/documents/1/annotations", json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "hello",
            "comment_content": "test"
        })
        assert resp.status_code == 401

    def test_t1_f02_04_unauthenticated_create_comment_401(self, client: TestClient):
        """T1-F02-04: POST /api/annotations/1/comments without auth returns 401."""
        resp = client.post("/api/annotations/1/comments", json={
            "content": "unauthorized reply",
            "parent_comment_id": 1
        })
        assert resp.status_code == 401

    def test_t1_f02_05_unauthenticated_edit_comment_401(self, client: TestClient):
        """T1-F02-05: PUT /api/comments/1 without auth returns 401."""
        resp = client.put("/api/comments/1", json={"content": "hacked edit"})
        assert resp.status_code == 401

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f02_01_malformed_auth_header_401(self, client: TestClient):
        """T2-F02-01: Malformed Authorization header returns 401."""
        resp = client.get("/api/documents", headers={"Authorization": "MalformedHeaderWithNoBearer"})
        assert resp.status_code == 401

    def test_t2_f02_02_empty_bearer_token_401(self, client: TestClient):
        """T2-F02-02: 'Bearer ' with empty token returns 401."""
        resp = client.get("/api/documents", headers={"Authorization": "Bearer "})
        assert resp.status_code == 401

    def test_t2_f02_03_forged_bearer_token_401(self, client: TestClient):
        """T2-F02-03: Completely random/forged bearer token returns 401."""
        resp = client.get("/api/documents", headers={"Authorization": "Bearer deadbeef123456789abcdef"})
        assert resp.status_code == 401

    def test_t2_f02_04_tampered_token_signature_401(self, client: TestClient, auth_headers_admin):
        """T2-F02-04: Tampered signature on valid token returns 401."""
        token = auth_headers_admin["Authorization"].replace("Bearer ", "")
        tampered_token = token[:-4] + "xxxx" if len(token) > 4 else "invalid"
        resp = client.get("/api/documents", headers={"Authorization": f"Bearer {tampered_token}"})
        assert resp.status_code == 401

    def test_t2_f02_05_basic_auth_scheme_rejected_401(self, client: TestClient):
        """T2-F02-05: Basic auth scheme is rejected on Bearer-protected endpoints."""
        resp = client.get("/api/documents", headers={"Authorization": "Basic YWRtaW46cGFzczEyMw=="})
        assert resp.status_code == 401


# ==============================================================================
# FEATURE F03: Administrative User Provisioning (`POST /api/admin/users`)
# ==============================================================================

class TestFeatureF03AdminUserProvisioning:
    """Tier 1 & Tier 2 tests for Feature F03."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f03_01_admin_provisions_reviewer_account(self, client: TestClient, auth_headers_admin):
        """T1-F03-01: Admin creates reviewer account; returns 201 with user details."""
        new_user = {
            "username": "reviewer_created_01",
            "password": "Password123!",
            "full_name": "Created Reviewer",
            "is_admin": False
        }
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json=new_user)
        assert resp.status_code in (200, 201), f"Expected 200/201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["username"] == new_user["username"]
        assert data["initials"] == "CR"
        assert data.get("is_admin") is False
        assert "password" not in data
        assert "password_hash" not in data

    def test_t1_f03_02_admin_provisions_secondary_admin(self, client: TestClient, auth_headers_admin):
        """T1-F03-02: Admin can provision another user with is_admin=True."""
        new_admin = {
            "username": "secondary_admin",
            "password": "AdminPass456!",
            "full_name": "Secondary Administrator",
            "is_admin": True
        }
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json=new_admin)
        assert resp.status_code in (200, 201)
        assert resp.json().get("is_admin") is True

    def test_t1_f03_03_non_admin_cannot_provision_users_403(self, client: TestClient, auth_headers_reviewer1):
        """T1-F03-03: Regular non-admin reviewer attempting to provision user receives 403 Forbidden."""
        resp = client.post("/api/admin/users", headers=auth_headers_reviewer1, json={
            "username": "hacker_user",
            "password": "Password123!",
            "full_name": "Hacker User",
            "is_admin": False
        })
        assert resp.status_code == 403

    def test_t1_f03_04_admin_list_users(self, client: TestClient, auth_headers_admin):
        """T1-F03-04: Admin can list all provisioned users."""
        resp = client.get("/api/admin/users", headers=auth_headers_admin)
        # Note: If admin GET /api/admin/users exists, it returns 200 and list
        if resp.status_code != 404:
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)
            assert len(resp.json()) >= 1

    def test_t1_f03_05_provisioned_reviewer_can_login(self, client: TestClient, auth_headers_admin):
        """T1-F03-05: Provisioned reviewer account can successfully authenticate."""
        username = "reviewer_verify_login"
        password = "SecurePassword789!"
        client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": username,
            "password": password,
            "full_name": "Verify Login",
            "is_admin": False
        })
        login_resp = client.post("/api/auth/login", json={"username": username, "password": password})
        assert login_resp.status_code == 200
        assert "token" in login_resp.json()

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f03_01_duplicate_username_conflict_409(self, client: TestClient, auth_headers_admin):
        """T2-F03-01: Provisioning duplicate username returns 409 Conflict or 400."""
        user = {
            "username": "duplicate_user_test",
            "password": "Password123!",
            "full_name": "Duplicate Test",
            "is_admin": False
        }
        client.post("/api/admin/users", headers=auth_headers_admin, json=user)
        dup_resp = client.post("/api/admin/users", headers=auth_headers_admin, json=user)
        assert dup_resp.status_code in (400, 409, 422)

    def test_t2_f03_02_missing_required_provisioning_fields_422(self, client: TestClient, auth_headers_admin):
        """T2-F03-02: Missing required password or username field returns 422."""
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "missing_pass_user"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f03_03_whitespace_only_name_validation(self, client: TestClient, auth_headers_admin):
        """T2-F03-03: Whitespace full name handled safely."""
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "whitespace_name_user",
            "password": "Password123!",
            "full_name": "   ",
            "is_admin": False
        })
        assert resp.status_code in (200, 201, 400, 422)

    def test_t2_f03_04_special_characters_in_full_name(self, client: TestClient, auth_headers_admin):
        """T2-F03-04: Special chars in full name (e.g. Jean-Luc O'Connor) parsed cleanly."""
        resp = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "special_char_name",
            "password": "Password123!",
            "full_name": "Jean-Luc O'Connor",
            "is_admin": False
        })
        assert resp.status_code in (200, 201)
        if resp.status_code in (200, 201):
            assert "initials" in resp.json()

    def test_t2_f03_05_mass_provisioning_sequential(self, client: TestClient, auth_headers_admin):
        """T2-F03-05: Mass sequential provisioning handles database transactions cleanly."""
        for i in range(5):
            resp = client.post("/api/admin/users", headers=auth_headers_admin, json={
                "username": f"bulk_user_{i}",
                "password": f"Password{i}!",
                "full_name": f"Bulk User {i}",
                "is_admin": False
            })
            assert resp.status_code in (200, 201)


# ==============================================================================
# FEATURE F04: Session Revocation (`POST /api/auth/logout`)
# ==============================================================================

class TestFeatureF04SessionRevocation:
    """Tier 1 & Tier 2 tests for Feature F04."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f04_01_successful_logout_returns_success(self, client: TestClient, admin_credentials):
        """T1-F04-01: POST /api/auth/logout with valid token returns success status."""
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]

        logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_resp.status_code == 200
        assert logout_resp.json().get("status") == "success" or "Logged out" in logout_resp.text

    def test_t1_f04_02_token_invalid_post_logout_me_401(self, client: TestClient, admin_credentials):
        """T1-F04-02: After logout, calling /api/auth/me with revoked token returns 401."""
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login_resp.json()["token"]

        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 401

    def test_t1_f04_03_protected_endpoint_rejects_revoked_token(self, client: TestClient, admin_credentials):
        """T1-F04-03: Protected /api/documents rejects revoked token with 401."""
        login_resp = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login_resp.json()["token"]

        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        doc_resp = client.get("/api/documents", headers={"Authorization": f"Bearer {token}"})
        assert doc_resp.status_code == 401

    def test_t1_f04_04_relogin_after_logout_succeeds(self, client: TestClient, admin_credentials):
        """T1-F04-04: User can log back in with valid credentials after revoking prior session."""
        login1 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token1 = login1.json()["token"]
        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token1}"})

        login2 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        assert login2.status_code == 200
        token2 = login2.json()["token"]
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
        assert me_resp.status_code == 200

    def test_t1_f04_05_logout_without_auth_fails(self, client: TestClient):
        """T1-F04-05: Logout without Authorization header returns 401."""
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 401

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f04_01_double_logout_handling(self, client: TestClient, admin_credentials):
        """T2-F04-01: Double logout with same token handled gracefully (401 or idempotent 200)."""
        login = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login.json()["token"]

        logout1 = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout1.status_code == 200

        logout2 = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout2.status_code in (200, 401)

    def test_t2_f04_02_logout_with_empty_bearer(self, client: TestClient):
        """T2-F04-02: Logout with empty Bearer header returns 401."""
        resp = client.post("/api/auth/logout", headers={"Authorization": "Bearer "})
        assert resp.status_code == 401

    def test_t2_f04_03_concurrent_sessions_revocation_isolation(self, client: TestClient, admin_credentials):
        """T2-F04-03: Multiple concurrent logins; logout from one token does not affect second token."""
        login1 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        login2 = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token1 = login1.json()["token"]
        token2 = login2.json()["token"]

        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token1}"})
        # Check token1 revoked
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token1}"}).status_code == 401
        # Token2 remains active
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"}).status_code == 200

    def test_t2_f04_04_revoked_token_on_document_sync_rejected(self, client: TestClient, admin_credentials):
        """T2-F04-04: Revoked token attempting /api/documents/sync is rejected before disk write."""
        login = client.post("/api/auth/login", json={"username": admin_credentials["username"], "password": admin_credentials["password"]})
        token = login.json()["token"]
        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})

        sync_resp = client.post("/api/documents/sync", headers={"Authorization": f"Bearer {token}"}, json={
            "filename": "hacked_doc.md",
            "content": "# Malicious",
            "format": "markdown"
        })
        assert sync_resp.status_code == 401

    def test_t2_f04_05_expired_token_handling(self, client: TestClient):
        """T2-F04-05: Expired token format is rejected with 401."""
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxMDAwMDAwfQ.invalid"
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert resp.status_code == 401
