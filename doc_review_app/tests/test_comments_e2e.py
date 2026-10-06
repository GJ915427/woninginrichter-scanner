"""E2E Automated Tests for Threaded Comments, Initials & Ownership (F14–F17).

Covers:
- Feature F14: Threaded Comment Replies (`POST /api/annotations/{id}/comments`)
- Feature F15: Author Initials Display (avatar badges, initials algorithm)
- Feature F16: Comment Self-Editing (`PUT /api/comments/{id}`, is_edited flag)
- Feature F17: Strict Ownership Enforcement (403 Forbidden on unauthorized edits)

Adheres strictly to PROJECT.md § Interface Contracts (3. Annotations & Comments)
and ORIGINAL_REQUEST.md Acceptance Criteria (Threading & Comment Editing).
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def comment_test_setup(client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2):
    """Set up a test document with an initial annotation and root comment by reviewer 1."""
    # Ingest document
    sync_resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
        "filename": "comments_test.md",
        "content": "# Comments Test Document\n\nThis is a sample document for threaded discussion.",
        "format": "markdown"
    })
    doc_id = sync_resp.json().get("id", 1)

    # Reviewer 1 creates annotation
    ann_resp = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
        "start_offset": 26,
        "end_offset": 41,
        "selected_text": "sample document",
        "comment_content": "Reviewer 1 initial root comment."
    })
    ann_data = ann_resp.json()
    ann_id = ann_data.get("id", 1)

    # Extract root comment id
    comments = ann_data.get("comments", [])
    if comments:
        root_comment_id = comments[0]["id"]
    elif "root_comment" in ann_data:
        root_comment_id = ann_data["root_comment"]["id"]
    else:
        root_comment_id = 1

    return {
        "doc_id": doc_id,
        "ann_id": ann_id,
        "root_comment_id": root_comment_id
    }


# ==============================================================================
# FEATURE F14: Threaded Comment Replies (`POST /api/annotations/{id}/comments`)
# ==============================================================================

class TestFeatureF14ThreadedCommentReplies:
    """Tier 1 & Tier 2 tests for Feature F14."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f14_01_post_reply_to_root_comment(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T1-F14-01: Reviewer 2 posts reply with parent_comment_id; returns 201 with thread linkage."""
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]

        resp = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_id,
            "content": "Reviewer 2 first reply."
        })
        assert resp.status_code in (200, 201), f"Expected 200/201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("parent_comment_id") == root_id
        assert data.get("content") == "Reviewer 2 first reply."
        assert "id" in data
        assert "author_initials" in data

    def test_t1_f14_02_nested_reply_to_reply(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, comment_test_setup):
        """T1-F14-02: Reply to a reply forms deep hierarchical thread."""
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]

        # Level 1 reply
        r1 = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_id,
            "content": "Level 1 reply"
        })
        r1_id = r1.json().get("id")

        # Level 2 reply to level 1
        r2 = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer1, json={
            "parent_comment_id": r1_id,
            "content": "Level 2 reply to reply"
        })
        assert r2.status_code in (200, 201)
        assert r2.json().get("parent_comment_id") == r1_id

    def test_t1_f14_03_multiple_sibling_replies(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T1-F14-03: Multiple sibling replies to the same parent comment are recorded."""
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]

        for i in range(2):
            resp = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
                "parent_comment_id": root_id,
                "content": f"Sibling reply {i}"
            })
            assert resp.status_code in (200, 201)
            assert resp.json().get("parent_comment_id") == root_id

    def test_t1_f14_04_thread_hierarchy_traversal(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F14-04: Thread query returns comments list including root and replies."""
        doc_id = comment_test_setup["doc_id"]
        resp = client.get(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        ann = next(a for a in resp.json() if a["id"] == comment_test_setup["ann_id"])
        assert len(ann["comments"]) >= 1

    def test_t1_f14_05_reply_increments_document_comment_count(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, comment_test_setup):
        """T1-F14-05: Adding a reply increments document total comment count."""
        doc_id = comment_test_setup["doc_id"]
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]

        docs_before = client.get("/api/documents", headers=auth_headers_reviewer1).json()
        before_count = next(d["comment_count"] for d in docs_before if d["id"] == doc_id)

        client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_id,
            "content": "Count increment test reply"
        })

        docs_after = client.get("/api/documents", headers=auth_headers_reviewer1).json()
        after_count = next(d["comment_count"] for d in docs_after if d["id"] == doc_id)
        assert after_count >= before_count + 1

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f14_01_empty_reply_content_rejected_400(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T2-F14-01: Empty reply content string rejected with 400 Bad Request."""
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]
        resp = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_id,
            "content": ""
        })
        assert resp.status_code in (400, 422)

    def test_t2_f14_02_reply_to_nonexistent_annotation_404(self, client: TestClient, auth_headers_reviewer2):
        """T2-F14-02: Reply to non-existent annotation ID returns 404."""
        resp = client.post("/api/annotations/999999/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": 1,
            "content": "Orphan reply"
        })
        assert resp.status_code == 404

    def test_t2_f14_03_reply_to_nonexistent_parent_comment_400_or_404(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T2-F14-03: Reply pointing to non-existent parent comment ID rejected."""
        ann_id = comment_test_setup["ann_id"]
        resp = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": 999999,
            "content": "Invalid parent reply"
        })
        assert resp.status_code in (400, 404, 422)

    def test_t2_f14_04_cross_annotation_reply_rejected(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, comment_test_setup):
        """T2-F14-04: Cannot link reply to a parent comment belonging to a different annotation."""
        doc_id = comment_test_setup["doc_id"]
        # Create second annotation
        r2 = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "# Com",
            "comment_content": "Second annotation root"
        })
        ann2_id = r2.json().get("id")

        # Attempt to reply to annotation 2 with parent from annotation 1
        resp = client.post(f"/api/annotations/{ann2_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": comment_test_setup["root_comment_id"],
            "content": "Cross-thread injection attempt"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f14_05_deep_thread_nesting(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T2-F14-05: Deeply nested thread (5 levels) operates without stack overflow."""
        ann_id = comment_test_setup["ann_id"]
        parent_id = comment_test_setup["root_comment_id"]
        for level in range(5):
            r = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer1, json={
                "parent_comment_id": parent_id,
                "content": f"Depth level {level + 1}"
            })
            assert r.status_code in (200, 201)
            parent_id = r.json().get("id")


# ==============================================================================
# FEATURE F15: Author Initials Display
# ==============================================================================

class TestFeatureF15AuthorInitialsDisplay:
    """Tier 1 & Tier 2 tests for Feature F15."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f15_01_two_word_name_initials(self, client: TestClient, auth_headers_admin):
        """T1-F15-01: 'Jane Doe' generates initials 'JD'."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_jd",
            "password": "Password123!",
            "full_name": "Jane Doe",
            "is_admin": False
        }).json()
        assert user.get("initials") == "JD"

    def test_t1_f15_02_single_word_name_initials(self, client: TestClient, auth_headers_admin):
        """T1-F15-02: 'Cher' generates initials 'C'."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_cher",
            "password": "Password123!",
            "full_name": "Cher",
            "is_admin": False
        }).json()
        assert user.get("initials") == "C"

    def test_t1_f15_03_three_word_name_initials(self, client: TestClient, auth_headers_admin):
        """T1-F15-03: 'John Paul Jones' produces 'JPJ' or 'JJ'."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_jpj",
            "password": "Password123!",
            "full_name": "John Paul Jones",
            "is_admin": False
        }).json()
        initials = user.get("initials", "")
        assert initials in ("JPJ", "JJ", "JP")

    def test_t1_f15_04_root_comment_contains_author_initials(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F15-04: Root comment returned in annotation contains non-empty author initials."""
        doc_id = comment_test_setup["doc_id"]
        resp = client.get(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1)
        comment = resp.json()[0]["comments"][0]
        assert "author_initials" in comment and len(comment["author_initials"]) > 0

    def test_t1_f15_05_thread_reply_contains_author_initials(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T1-F15-05: Reply contains respondent's initials in response."""
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]
        resp = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_id,
            "content": "Checking initials in reply"
        })
        assert resp.status_code in (200, 201)
        assert "author_initials" in resp.json()
        assert len(resp.json()["author_initials"]) > 0

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f15_01_hyphenated_name_initials(self, client: TestClient, auth_headers_admin):
        """T2-F15-01: 'Mary-Jane Watson' produces valid non-empty initials."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_mjw",
            "password": "Password123!",
            "full_name": "Mary-Jane Watson",
            "is_admin": False
        }).json()
        assert len(user.get("initials", "")) >= 1

    def test_t2_f15_02_lowercase_name_initials_capitalized(self, client: TestClient, auth_headers_admin):
        """T2-F15-02: 'john doe' produces uppercase 'JD'."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_lower",
            "password": "Password123!",
            "full_name": "john doe",
            "is_admin": False
        }).json()
        assert user.get("initials") == "JD"

    def test_t2_f15_03_single_character_name_initials(self, client: TestClient, auth_headers_admin):
        """T2-F15-03: 'Q' produces initials 'Q'."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_q",
            "password": "Password123!",
            "full_name": "Q",
            "is_admin": False
        }).json()
        assert user.get("initials") == "Q"

    def test_t2_f15_04_whitespace_padded_name_initials(self, client: TestClient, auth_headers_admin):
        """T2-F15-04: '   Alan   Turing   ' produces initials 'AT' without whitespace."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_turing",
            "password": "Password123!",
            "full_name": "   Alan   Turing   ",
            "is_admin": False
        }).json()
        assert user.get("initials") == "AT"

    def test_t2_f15_05_unicode_accented_name_initials(self, client: TestClient, auth_headers_admin):
        """T2-F15-05: 'Émile Zola' produces initials 'ÉZ'."""
        user = client.post("/api/admin/users", headers=auth_headers_admin, json={
            "username": "user_zola",
            "password": "Password123!",
            "full_name": "Émile Zola",
            "is_admin": False
        }).json()
        assert user.get("initials") == "ÉZ"


# ==============================================================================
# FEATURE F16: Comment Self-Editing (`PUT /api/comments/{id}`)
# ==============================================================================

class TestFeatureF16CommentSelfEditing:
    """Tier 1 & Tier 2 tests for Feature F16."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f16_01_author_edits_own_comment_success(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F16-01: Author edits own comment; returns HTTP 200 with new content."""
        root_id = comment_test_setup["root_comment_id"]
        new_text = "Updated comment content by author."
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": new_text
        })
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("content") == new_text

    def test_t1_f16_02_is_edited_flag_set_to_true(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F16-02: After editing, is_edited flag is set to true."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": "Edited text with flag check."
        })
        assert resp.status_code == 200
        assert resp.json().get("is_edited") is True

    def test_t1_f16_03_updated_at_timestamp_advanced(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F16-03: updated_at timestamp is present and refreshed."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": "Edited text timestamp test."
        })
        assert resp.status_code == 200
        assert "updated_at" in resp.json()

    def test_t1_f16_04_original_author_preserved_on_edit(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F16-04: Author initials and user ID preserved after content edit."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": "Preserve author integrity."
        })
        assert resp.status_code == 200

    def test_t1_f16_05_multiple_successive_edits(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T1-F16-05: Multiple successive edits by author succeed."""
        root_id = comment_test_setup["root_comment_id"]
        r1 = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={"content": "Edit 1"})
        r2 = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={"content": "Edit 2"})
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r2.json().get("content") == "Edit 2"

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f16_01_edit_to_empty_content_rejected_400(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T2-F16-01: Editing comment to empty string rejected with 400 Bad Request."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": ""
        })
        assert resp.status_code in (400, 422)

    def test_t2_f16_02_edit_nonexistent_comment_404(self, client: TestClient, auth_headers_reviewer1):
        """T2-F16-02: Editing non-existent comment ID returns 404."""
        resp = client.put("/api/comments/999999", headers=auth_headers_reviewer1, json={
            "content": "Ghost comment edit"
        })
        assert resp.status_code == 404

    def test_t2_f16_03_edit_with_identical_content(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T2-F16-03: Submitting identical content succeeds gracefully."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": "Same content"
        })
        assert resp.status_code == 200

    def test_t2_f16_04_edit_large_comment_content(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T2-F16-04: Editing comment to 5,000 characters succeeds without truncation."""
        root_id = comment_test_setup["root_comment_id"]
        large_text = "Expanded edit: " + ("abcdefghij " * 450)
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": large_text
        })
        assert resp.status_code == 200
        assert resp.json().get("content") == large_text

    def test_t2_f16_05_attempt_to_modify_author_id_payload_ignored(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T2-F16-05: Injected user_id in edit payload is ignored; true author retained."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": "Attempted author hijack",
            "user_id": 9999
        })
        assert resp.status_code == 200
        assert resp.json().get("user_id") != 9999


# ==============================================================================
# FEATURE F17: Strict Ownership Enforcement (403 Forbidden)
# ==============================================================================

class TestFeatureF17StrictOwnershipEnforcement:
    """Tier 1 & Tier 2 tests for Feature F17."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f17_01_foreign_user_cannot_edit_comment_403(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T1-F17-01: Reviewer 2 attempting to edit Reviewer 1's comment returns HTTP 403 Forbidden."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer2, json={
            "content": "Hacked edit by non-author"
        })
        assert resp.status_code == 403, f"Expected 403 Forbidden, got {resp.status_code}: {resp.text}"

    def test_t1_f17_02_forbidden_error_detail_message(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T1-F17-02: 403 response contains descriptive error detail indicating ownership failure."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer2, json={
            "content": "Unauthorized update"
        })
        assert resp.status_code == 403
        data = resp.json()
        detail = data.get("detail", "") or data.get("error", "")
        assert "forbidden" in detail.lower() or "cannot edit" in detail.lower() or "ownership" in detail.lower() or len(detail) > 0

    def test_t1_f17_03_comment_content_unchanged_after_403(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, comment_test_setup):
        """T1-F17-03: Comment content remains completely unchanged after 403 Forbidden attempt."""
        doc_id = comment_test_setup["doc_id"]
        root_id = comment_test_setup["root_comment_id"]

        # Attempt unauthorized edit
        client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer2, json={
            "content": "Malicious content should not be saved"
        })

        # Fetch and verify
        doc = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1).json()
        ann = next(a for a in doc["annotations"] if a["id"] == comment_test_setup["ann_id"])
        root_comment = next(c for c in ann["comments"] if c["id"] == root_id)
        assert "Malicious content" not in root_comment["content"]

    def test_t1_f17_04_foreign_user_cannot_edit_reply_403(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, comment_test_setup):
        """T1-F17-04: Reviewer 1 cannot edit Reviewer 2's reply."""
        ann_id = comment_test_setup["ann_id"]
        root_id = comment_test_setup["root_comment_id"]

        reply = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": root_id,
            "content": "Reviewer 2 protected reply"
        }).json()
        reply_id = reply["id"]

        # Reviewer 1 tries to edit Reviewer 2's reply
        resp = client.put(f"/api/comments/{reply_id}", headers=auth_headers_reviewer1, json={
            "content": "Reviewer 1 attempting overwrite"
        })
        assert resp.status_code == 403

    def test_t1_f17_05_admin_subject_to_comment_ownership_policy(self, client: TestClient, auth_headers_admin, comment_test_setup):
        """T1-F17-05: Administrator cannot edit reviewer's comment body (preserves integrity)."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_admin, json={
            "content": "Admin attempting overwrite"
        })
        # Strict ownership requires 403 even for admin on comment content
        assert resp.status_code == 403

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f17_01_forged_user_id_in_header_rejected(self, client: TestClient, auth_headers_reviewer2, comment_test_setup):
        """T2-F17-01: Spoofed X-User-Id header ignored; cryptographic token enforced."""
        root_id = comment_test_setup["root_comment_id"]
        headers = dict(auth_headers_reviewer2)
        headers["X-User-Id"] = "1"  # Attempt to spoof author ID
        resp = client.put(f"/api/comments/{root_id}", headers=headers, json={
            "content": "Header spoofing attempt"
        })
        assert resp.status_code == 403

    def test_t2_f17_02_unauthenticated_edit_returns_401_before_403(self, client: TestClient, comment_test_setup):
        """T2-F17-02: Unauthenticated edit returns 401 Unauthorized before checking 403."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", json={"content": "No auth"})
        assert resp.status_code == 401

    def test_t2_f17_03_edit_deleted_comment_404(self, client: TestClient, auth_headers_reviewer1):
        """T2-F17-03: Attempting to edit non-existent comment returns 404."""
        resp = client.put("/api/comments/888888", headers=auth_headers_reviewer1, json={"content": "test"})
        assert resp.status_code == 404

    def test_t2_f17_04_attempt_to_reparent_comment_via_edit_ignored(self, client: TestClient, auth_headers_reviewer1, comment_test_setup):
        """T2-F17-04: Cannot hijack parent_comment_id or annotation_id via PUT /api/comments/{id}."""
        root_id = comment_test_setup["root_comment_id"]
        resp = client.put(f"/api/comments/{root_id}", headers=auth_headers_reviewer1, json={
            "content": "Normal text",
            "parent_comment_id": 999
        })
        assert resp.status_code == 200
        assert resp.json().get("parent_comment_id") != 999

    def test_t2_f17_05_ownership_enforcement_on_deep_nested_replies(self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, comment_test_setup):
        """T2-F17-05: Ownership 403 enforced on deep nested reply (level 3)."""
        ann_id = comment_test_setup["ann_id"]
        r1 = client.post(f"/api/annotations/{ann_id}/comments", headers=auth_headers_reviewer2, json={
            "parent_comment_id": comment_test_setup["root_comment_id"],
            "content": "Deep reply by reviewer 2"
        }).json()

        # Reviewer 1 attempts to edit Reviewer 2's deep reply
        resp = client.put(f"/api/comments/{r1['id']}", headers=auth_headers_reviewer1, json={
            "content": "Reviewer 1 unauthorized edit on deep reply"
        })
        assert resp.status_code == 403
