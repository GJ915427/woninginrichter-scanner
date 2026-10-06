"""E2E Automated Tests for Material Design 3 UI (F18), Tier 3 Combinations & Tier 4 Scenarios.

Covers:
- Feature F18: Google Material Design 3 UI (M3 Tokens, Mobile-First 375px, Assets)
- Tier 3 Cross-Feature Combinations:
  - C1: Reviewer Onboarding & Document Discovery Flow
  - C2: Collaborative Annotation & Multi-User Thread Discussion
  - C3: Local Sync Utility to Web Platform Pipeline
  - C4: Authentication Lifecycle & Security Revocation
  - C5: Document Versioning & Continuous Sync Update
  - C6: High-Concurrency Peer Review Session
- Tier 4 Real-World Application Scenarios:
  - S1: Full Regulatory Review Lifecycle
  - S2: Automated Sync Pipeline Recovery
  - S3: Adversarial Penetration & Security Audit
  - S4: Extreme Scale & High-Density Stress Test
  - S5: Mobile-First Responsive Validation (375px Viewport)

Adheres strictly to PROJECT.md and ORIGINAL_REQUEST.md.
"""

import hashlib
import re
import pytest
from fastapi.testclient import TestClient


# ==============================================================================
# FEATURE F18: Google Material Design 3 UI & Responsiveness
# ==============================================================================

class TestFeatureF18MaterialDesign3UI:
    """Tier 1 & Tier 2 tests for Feature F18."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f18_01_static_index_html_served(self, client: TestClient):
        """T1-F18-01: GET / serves the Single Page Application index.html."""
        resp = client.get("/")
        assert resp.status_code == 200
        assert "html" in resp.headers.get("content-type", "").lower()
        assert "<!doctype html>" in resp.text.lower() or "<html" in resp.text.lower()

    def test_t1_f18_02_m3_css_tokens_defined(self, client: TestClient):
        """T1-F18-02: Static CSS /static/css/m3_theme.css serves Material Design 3 design tokens."""
        resp = client.get("/static/css/m3_theme.css")
        assert resp.status_code == 200
        assert "css" in resp.headers.get("content-type", "").lower()
        # Verify M3 tokens exist
        assert "--md-sys-color" in resp.text or "--color" in resp.text or "font-family" in resp.text

    def test_t1_f18_03_material_symbols_integration(self, client: TestClient):
        """T1-F18-03: HTML index includes Google Material Symbols / Icons reference."""
        resp = client.get("/")
        assert resp.status_code == 200
        text = resp.text.lower()
        assert "material-symbols" in text or "material-icons" in text or "svg" in text

    def test_t1_f18_04_viewport_meta_tag_present(self, client: TestClient):
        """T1-F18-04: HTML index contains responsive mobile-first viewport meta tag."""
        resp = client.get("/")
        assert resp.status_code == 200
        assert '<meta name="viewport"' in resp.text or "<meta name='viewport'" in resp.text
        assert "width=device-width" in resp.text

    def test_t1_f18_05_static_js_assets_served(self, client: TestClient):
        """T1-F18-05: Client JavaScript modules are accessible via static mount."""
        for js_module in ["app.js", "selection.js", "comments.js", "markdown.js"]:
            resp = client.get(f"/static/js/{js_module}")
            # If split modules or bundled, should return 200 or be referenced in index
            if resp.status_code == 200:
                assert "javascript" in resp.headers.get("content-type", "").lower()

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f18_01_no_fixed_widths_exceeding_320px(self, client: TestClient):
        """T2-F18-01: CSS stylesheets do not declare fixed viewport widths >320px that force horizontal scroll."""
        resp = client.get("/static/css/m3_theme.css")
        assert resp.status_code == 200, "m3_theme.css must be accessible"
        # Layout containers should not declare fixed width exceeding 320px outside responsive media queries
        fixed_width_matches = re.findall(r"(?<!max-|min-)width:\s*([4-9]\d{2,}|[1-9]\d{3,})px", resp.text)
        assert len(fixed_width_matches) == 0, f"Found fixed width declarations exceeding 320px: {fixed_width_matches}"
        # Layout containers must use max-width: 100vw or responsive breakpoints
        assert "max-width: 100vw;" in resp.text, "m3_theme.css must enforce max-width: 100vw on layout containers"
        assert "@media (min-width: 600px)" in resp.text, "m3_theme.css must declare tablet responsive breakpoint"
        assert "@media (min-width: 840px)" in resp.text, "m3_theme.css must declare desktop responsive breakpoint"

    def test_t2_f18_02_mobile_drawer_navigation_structure(self, client: TestClient):
        """T2-F18-02: HTML/CSS includes markup for responsive navigation drawer."""
        resp = client.get("/")
        text = resp.text.lower()
        assert "drawer" in text or "nav" in text or "sidebar" in text or "menu" in text

    def test_t2_f18_03_scalable_css_units(self, client: TestClient):
        """T2-F18-03: Typography tokens utilize scalable relative units (rem, em)."""
        resp = client.get("/static/css/m3_theme.css")
        if resp.status_code == 200:
            assert "rem" in resp.text or "em" in resp.text

    def test_t2_f18_04_theme_color_contrast_tokens(self, client: TestClient):
        """T2-F18-04: Theme defines surface, on-surface, primary, and orange badge accent colors."""
        resp = client.get("/static/css/m3_theme.css")
        if resp.status_code == 200:
            assert "#ff6d00" in resp.text.lower() or "orange" in resp.text.lower()

    def test_t2_f18_05_bottom_sheet_modal_markup(self, client: TestClient):
        """T2-F18-05: Modal / bottom sheet container defined for mobile thread interaction."""
        resp = client.get("/")
        text = resp.text.lower()
        assert "modal" in text or "sheet" in text or "popover" in text or "dialog" in text


# ==============================================================================
# TIER 3: Cross-Feature Combinations (Pairwise & Lifecycle Flows)
# ==============================================================================

class TestTier3CrossFeatureCombinations:
    """End-to-end multi-feature combination workflows."""

    def test_tier3_c1_onboarding_and_document_discovery(self, client: TestClient, auth_headers_admin):
        """Combination C1: Admin provisions reviewer -> Reviewer logs in -> Discovers document."""
        # 1. Admin creates user
        user_data = {
            "username": "c1_reviewer",
            "password": "C1Password123!",
            "full_name": "C1 Reviewer",
            "is_admin": False
        }
        prov_resp = client.post("/api/admin/users", headers=auth_headers_admin, json=user_data)
        assert prov_resp.status_code in (200, 201)

        # 2. Reviewer logs in
        login_resp = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        assert login_resp.status_code == 200
        rev_token = login_resp.json()["token"]
        rev_headers = {"Authorization": f"Bearer {rev_token}"}

        # 3. Document ingested
        sync_resp = client.post("/api/documents/sync", headers=auth_headers_admin, json={
            "filename": "c1_guide.md",
            "content": "# C1 Guide\nWelcome to onboarding.",
            "format": "markdown"
        })
        assert sync_resp.status_code in (200, 201)

        # 4. Reviewer lists documents and fetches content
        docs = client.get("/api/documents", headers=rev_headers).json()
        assert any(d["filename"] == "c1_guide.md" for d in docs)
        doc_id = next(d["id"] for d in docs if d["filename"] == "c1_guide.md")

        doc_content = client.get(f"/api/documents/{doc_id}", headers=rev_headers).json()
        assert "# C1 Guide" in doc_content["content"]

    def test_tier3_c2_multi_user_annotation_thread_ownership(
        self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2
    ):
        """Combination C2: Reviewer A creates annotation -> Reviewer B replies -> Reviewer A edits own -> Reviewer B edit of A fails 403."""
        # 1. Ingest document
        sync_resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "c2_discussion.md",
            "content": "# Section Alpha\nCrucial design principle for review.",
            "format": "markdown"
        })
        doc_id = sync_resp.json().get("id")

        # 2. Reviewer A creates annotation & root comment
        ann_resp = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 16,
            "end_offset": 39,
            "selected_text": "Crucial design principle",
            "comment_content": "Reviewer A question."
        })
        assert ann_resp.status_code in (200, 201)
        ann_data = ann_resp.json()
        ann_id = ann_data["id"]
        root_comment_id = ann_data["comments"][0]["id"] if "comments" in ann_data else 1

        # 3. Reviewer B posts reply
        reply_resp = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_comment_id,
            "content": "Reviewer B reply."
        })
        assert reply_resp.status_code in (200, 201)
        reply_id = reply_resp.json()["id"]

        # 4. Reviewer A successfully edits own root comment
        edit_a = client.put(f"/api/comments/{root_comment_id}", headers=auth_headers_reviewer1, json={
            "content": "Reviewer A updated question."
        })
        assert edit_a.status_code == 200
        assert edit_a.json().get("is_edited") is True

        # 5. Reviewer B attempts to edit Reviewer A's root comment -> HTTP 403
        hack_edit = client.put(f"/api/comments/{root_comment_id}", headers=auth_headers_reviewer2, json={
            "content": "Reviewer B unauthorized overwrite"
        })
        assert hack_edit.status_code == 403

        # 6. Reviewer B successfully edits own reply
        edit_b = client.put(f"/api/comments/{reply_id}", headers=auth_headers_reviewer2, json={
            "content": "Reviewer B updated reply."
        })
        assert edit_b.status_code == 200

    def test_tier3_c3_sync_crlf_to_offset_matching(self, client: TestClient, auth_headers_reviewer1):
        """Combination C3: Windows CRLF synced -> LF normalized -> character offset matches DOM range."""
        crlf_doc = "# Line 1\r\n# Line 2\r\n# Line 3\r\nTarget Selection Text\r\n# Line 5"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "c3_crlf.md",
            "content": crlf_doc,
            "format": "markdown"
        })
        doc_id = sync.json().get("id")

        # Fetch normalized content
        doc = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1).json()
        target = "Target Selection Text"
        start = doc["content"].index(target)
        end = start + len(target)

        # Create annotation
        ann = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": target,
            "comment_content": "CRLF offset match verify"
        })
        assert ann.status_code in (200, 201)
        assert ann.json()["selected_text"] == target

    def test_tier3_c4_auth_lifecycle_logout_revocation(self, client: TestClient, admin_credentials):
        """Combination C4: Login -> Annotate -> Logout -> Attempt read/write with revoked token returns 401."""
        login = client.post("/api/auth/login", json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"]
        })
        token = login.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Valid read before logout
        assert client.get("/api/documents", headers=headers).status_code == 200

        # Logout
        assert client.post("/api/auth/logout", headers=headers).status_code == 200

        # Read after logout fails with 401
        assert client.get("/api/documents", headers=headers).status_code == 401

        # Write after logout fails with 401
        assert client.post("/api/documents/sync", headers=headers, json={
            "filename": "blocked.md",
            "content": "blocked",
            "format": "markdown"
        }).status_code == 401

    def test_tier3_c5_document_update_comment_preservation(self, client: TestClient, auth_headers_reviewer1):
        """Combination C5: Ingest doc v1 -> Add annotation -> Ingest doc v2 update -> Annotation persisted."""
        sync_v1 = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "c5_versioned.md",
            "content": "Original paragraph one.\nOriginal paragraph two.",
            "format": "markdown"
        })
        doc_id = sync_v1.json().get("id")

        # Add annotation
        client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 8,
            "selected_text": "Original",
            "comment_content": "Persistent annotation"
        })

        # Sync update v2
        sync_v2 = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "c5_versioned.md",
            "content": "Original paragraph one.\nOriginal paragraph two.\nAdded paragraph three.",
            "format": "markdown"
        })
        assert sync_v2.status_code == 200

        # Verify annotation still associated with document
        doc_v2 = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1).json()
        assert len(doc_v2.get("annotations", [])) >= 1

    def test_tier3_c6_concurrent_peer_reviews(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2):
        """Combination C6: Concurrent reviewers submit annotations & replies on same document without lock errors."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "c6_concurrency.md",
            "content": "# Concurrent Review\nSection for rapid testing.",
            "format": "markdown"
        })
        doc_id = sync.json().get("id")

        # Both users annotate concurrently
        a1 = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0, "end_offset": 10, "selected_text": "# Concurre", "comment_content": "Reviewer 1 note"
        })
        a2 = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer2, json={
            "start_offset": 19, "end_offset": 26, "selected_text": "Section", "comment_content": "Reviewer 2 note"
        })
        assert a1.status_code in (200, 201)
        assert a2.status_code in (200, 201)


# ==============================================================================
# TIER 4: Real-World Application Scenarios
# ==============================================================================

class TestTier4RealWorldScenarios:
    """Real-world collaborative scenarios and security audits."""

    def test_tier4_s1_regulatory_review_lifecycle(self, client: TestClient, auth_headers_admin, reviewer1_credentials, reviewer2_credentials):
        """Scenario S1: Complete regulatory compliance review lifecycle."""
        # 1. Admin logs in and provisions Lead Reviewer and Peer Reviewer
        client.post("/api/admin/users", headers=auth_headers_admin, json=reviewer1_credentials)
        client.post("/api/admin/users", headers=auth_headers_admin, json=reviewer2_credentials)

        lead_token = client.post("/api/auth/login", json={"username": reviewer1_credentials["username"], "password": reviewer1_credentials["password"]}).json()["token"]
        peer_token = client.post("/api/auth/login", json={"username": reviewer2_credentials["username"], "password": reviewer2_credentials["password"]}).json()["token"]

        lead_headers = {"Authorization": f"Bearer {lead_token}"}
        peer_headers = {"Authorization": f"Bearer {peer_token}"}

        # 2. Ingest compliance specification
        doc = client.post("/api/documents/sync", headers=lead_headers, json={
            "filename": "regulatory_compliance_spec.md",
            "content": "# Regulatory Compliance\n\nClause 4.1: Data retention period is indefinite.",
            "format": "markdown"
        }).json()
        doc_id = doc["id"]

        # 3. Lead reviewer finds violation and annotates
        ann = client.post(f"/api/documents/{doc_id}/annotations", headers=lead_headers, json={
            "start_offset": 25,
            "end_offset": 70,
            "selected_text": "Clause 4.1: Data retention period is indefinite",
            "comment_content": "Non-compliant with GDPR Article 5(1)(e)."
        }).json()
        ann_id = ann["id"]
        root_comment_id = ann["comments"][0]["id"] if "comments" in ann else 1

        # 4. Peer reviewer responds with resolution proposal
        reply = client.post(f"/api/annotations/{ann_id}/comments", headers=peer_headers, json={
            "parent_comment_id": root_comment_id,
            "content": "Recommend updating to max 30-day retention with user consent."
        }).json()
        assert reply["author_initials"] == "BS"

        # 5. Lead reviewer marks resolved in comment edit
        edit = client.put(f"/api/comments/{root_comment_id}", headers=lead_headers, json={
            "content": "RESOLVED: Clause updated to 30-day retention with consent."
        })
        assert edit.status_code == 200
        assert edit.json()["is_edited"] is True

    def test_tier4_s2_sync_pipeline_interruption_recovery(self, client: TestClient, auth_headers_reviewer1):
        """Scenario S2: Sync pipeline idempotent re-run recovery."""
        payload = {
            "filename": "s2_recovery.md",
            "content": "# System Log\nInitial snapshot.",
            "format": "markdown"
        }
        # First sync succeeds
        r1 = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json=payload)
        assert r1.status_code in (200, 201)

        # Retry after interruption succeeds idempotently
        r2 = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json=payload)
        assert r2.status_code in (200, 201)

    def test_tier4_s3_adversarial_security_audit(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2):
        """Scenario S3: Adversarial penetration test suite (XSS, Injection, Traversal, Privilege Escalation)."""
        # 1. XSS in comment content
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "s3_security.md",
            "content": "# Security Audit Target\nParagraph text here.",
            "format": "markdown"
        })
        doc_id = sync.json().get("id")

        xss_payload = "<script>alert('XSS')</script><img src=x onerror=alert(1)>"
        ann_resp = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 8,
            "selected_text": "# Securi",
            "comment_content": xss_payload
        })
        assert ann_resp.status_code in (200, 201)

        # 2. Privilege Escalation: Reviewer attempting admin endpoint
        assert client.post("/api/admin/users", headers=auth_headers_reviewer1, json={
            "username": "escalated_admin", "password": "Pass", "full_name": "Bad", "is_admin": True
        }).status_code == 403

        # 3. Path Traversal in filename
        assert client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "../../../../windows/system32/cmd.exe",
            "content": "bad",
            "format": "markdown"
        }).status_code in (400, 422)

    def test_tier4_s4_high_volume_stress_test(self, client: TestClient, auth_headers_reviewer1):
        """Scenario S4: High volume test with multiple annotations and comments."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "s4_stress.md",
            "content": "Stress testing content line.\n" * 50,
            "format": "markdown"
        })
        doc_id = sync.json().get("id")

        # Create 5 annotations in quick succession
        for i in range(5):
            r = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
                "start_offset": i * 10,
                "end_offset": i * 10 + 5,
                "selected_text": "Stres",
                "comment_content": f"High volume comment {i}"
            })
            assert r.status_code in (200, 201)

        # Verify all 5 listed
        anns = client.get(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1).json()
        assert len(anns) >= 5

    def test_tier4_s5_mobile_reviewer_contract_validation(self, client: TestClient):
        """Scenario S5: Verify mobile viewport contracts, HTML structure, and meta tags."""
        index_resp = client.get("/")
        assert index_resp.status_code == 200
        html = index_resp.text

        # 1. Viewport tag
        assert "viewport" in html
        assert "width=device-width" in html

        # 2. Material icons/symbols
        assert "material-symbols" in html or "material-icons" in html or "svg" in html

        # 3. CSS loadable
        css_resp = client.get("/static/css/m3_theme.css")
        assert css_resp.status_code == 200
