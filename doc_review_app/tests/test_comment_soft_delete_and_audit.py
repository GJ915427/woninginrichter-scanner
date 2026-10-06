"""Tests for Comment Soft Delete, Comment Self-Editing, and Immutable Audit Logging."""

import pytest
from fastapi.testclient import TestClient


def test_comment_soft_delete_and_audit_trail(client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2, auth_headers_admin):
    # 1. Sync a document
    doc_resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_reviewer1,
        json={
            "filename": "audit_test.md",
            "content": "# Audit Test\n\nThis is a sentence for audit trail testing.",
            "format": "markdown",
        },
    )
    assert doc_resp.status_code in (200, 201)
    doc_id = doc_resp.json()["id"]

    # 2. Reviewer 1 creates an annotation with an initial comment
    ann_resp = client.post(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_reviewer1,
        json={
            "start_offset": 14,
            "end_offset": 23,
            "selected_text": "sentence",
            "comment_content": "Original comment by Reviewer 1",
            "badge_color": "#FF6D00",
        },
    )
    assert ann_resp.status_code == 201
    ann_data = ann_resp.json()
    ann_id = ann_data["id"]
    comment_1_id = ann_data["comments"][0]["id"]
    assert ann_data["comments"][0]["is_deleted"] is False

    # 3. Reviewer 2 replies to Reviewer 1's comment
    reply_resp = client.post(
        f"/api/annotations/{ann_id}/comments",
        headers=auth_headers_reviewer2,
        json={
            "content": "Reply by Reviewer 2",
            "parent_comment_id": comment_1_id,
        },
    )
    assert reply_resp.status_code == 201
    comment_2_id = reply_resp.json()["id"]

    # 4. Reviewer 1 edits their own comment
    edit_resp = client.post if False else client.put(
        f"/api/comments/{comment_1_id}",
        headers=auth_headers_reviewer1,
        json={"content": "Updated comment by Reviewer 1"},
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["content"] == "Updated comment by Reviewer 1"
    assert edit_resp.json()["is_edited"] is True

    # 5. Reviewer 2 CANNOT edit Reviewer 1's comment (403 Forbidden)
    forbidden_edit = client.put(
        f"/api/comments/{comment_1_id}",
        headers=auth_headers_reviewer2,
        json={"content": "Hacked comment by Reviewer 2"},
    )
    assert forbidden_edit.status_code == 403

    # 6. Reviewer 2 CANNOT delete Reviewer 1's comment (403 Forbidden)
    forbidden_delete = client.delete(
        f"/api/comments/{comment_1_id}",
        headers=auth_headers_reviewer2,
    )
    assert forbidden_delete.status_code == 403

    # 7. Reviewer 1 soft-deletes their comment
    # Since comment_2 (reply) still exists, annotation should remain active, but comment 1 is masked
    del_resp = client.delete(
        f"/api/comments/{comment_1_id}",
        headers=auth_headers_reviewer1,
    )
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["is_deleted"] is True
    assert del_data["annotation_deleted"] is False

    # 8. Check document annotations: root comment is masked as '[Opmerking verwijderd]' but reply is preserved
    list_resp = client.get(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_reviewer1,
    )
    assert list_resp.status_code == 200
    annotations = list_resp.json()
    assert len(annotations) == 1
    root_c = [c for c in annotations[0]["comments"] if c["id"] == comment_1_id][0]
    assert root_c["is_deleted"] is True
    assert root_c["content"] == "[Opmerking verwijderd]"
    reply_c = [c for c in annotations[0]["comments"] if c["id"] == comment_2_id][0]
    assert reply_c["is_deleted"] is False
    assert reply_c["content"] == "Reply by Reviewer 2"

    # 9. Reviewer 2 soft-deletes the reply
    # Now ALL comments are deleted, so the annotation should be soft-deleted as well
    del_reply_resp = client.delete(
        f"/api/comments/{comment_2_id}",
        headers=auth_headers_reviewer2,
    )
    assert del_reply_resp.status_code == 200
    assert del_reply_resp.json()["annotation_deleted"] is True

    # 10. Check document annotations again: annotation is no longer in active annotations list!
    list_resp_2 = client.get(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_reviewer1,
    )
    assert list_resp_2.status_code == 200
    assert len(list_resp_2.json()) == 0

    # 11. Check Audit History for Comment 1
    # Expect: CREATE -> UPDATE -> SOFT_DELETE
    hist_resp = client.get(
        f"/api/comments/{comment_1_id}/history",
        headers=auth_headers_reviewer1,
    )
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 3
    assert history[0]["action"] == "CREATE"
    assert history[0]["new_value"] == "Original comment by Reviewer 1"

    assert history[1]["action"] == "UPDATE"
    assert history[1]["old_value"] == "Original comment by Reviewer 1"
    assert history[1]["new_value"] == "Updated comment by Reviewer 1"

    assert history[2]["action"] == "SOFT_DELETE"
    assert history[2]["old_value"] == "Updated comment by Reviewer 1"

    # 12. Check Document-wide Audit Log
    doc_audit_resp = client.get(
        f"/api/documents/{doc_id}/audit-logs",
        headers=auth_headers_reviewer1,
    )
    assert doc_audit_resp.status_code == 200
    doc_audit = doc_audit_resp.json()
    # At least: annotation CREATE, comment 1 CREATE, comment 2 CREATE, comment 1 UPDATE,
    # comment 1 SOFT_DELETE, comment 2 SOFT_DELETE, annotation SOFT_DELETE
    actions = [e["action"] for e in doc_audit]
    assert "CREATE" in actions
    assert "UPDATE" in actions
    assert "SOFT_DELETE" in actions
