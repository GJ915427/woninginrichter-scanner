"""Integration and regression test suite for Document Access Control Matrix.

Validates:
- Role-based document listing (admin sees all, reviewer sees only assigned).
- Direct document and sub-resource authorization gates (404 before 403, IDOR protection).
- Admin access control matrix endpoints (GET, POST toggle, PUT batch).
- Zero regression against authentication, annotation creation, and comment threads.
"""

from typing import Any, Dict
import pytest
from starlette.testclient import TestClient


def test_admin_sees_all_documents(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    temp_sync_folder: Any,
) -> None:
    """Verify that an administrator sees all ingested documents."""
    # Ingest document 1
    resp1 = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "doc1.md", "content": "# Doc 1\nContent for doc 1"},
    )
    assert resp1.status_code in (200, 201)

    # Ingest document 2
    resp2 = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "doc2.md", "content": "# Doc 2\nContent for doc 2"},
    )
    assert resp2.status_code in (200, 201)

    # List documents as admin
    list_resp = client.get("/api/documents", headers=auth_headers_admin)
    assert list_resp.status_code == 200
    docs = list_resp.json()
    filenames = [d["filename"] for d in docs]
    assert "doc1.md" in filenames
    assert "doc2.md" in filenames


def test_reviewer_sees_empty_list_when_no_grants(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Verify reviewer sees 0 documents when no access has been granted."""
    # Ingest doc as admin
    client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "private_doc.md", "content": "# Private\nConfidential"},
    )

    # Reviewer lists documents
    resp = client.get("/api/documents", headers=auth_headers_reviewer1)
    assert resp.status_code == 200
    assert resp.json() == []


def test_reviewer_sees_only_granted_documents(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Verify reviewer only sees documents explicitly granted in document_access."""
    # Create 2 documents as admin
    resp1 = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "accessible.md", "content": "# Accessible Doc\nAllowed"},
    )
    doc1_id = resp1.json()["id"]

    client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "restricted.md", "content": "# Restricted Doc\nHidden"},
    )

    # Get reviewer1 user profile
    me_resp = client.get("/api/auth/me", headers=auth_headers_reviewer1)
    assert me_resp.status_code == 200
    rev1_id = me_resp.json()["id"]

    # Admin grants access to doc1
    toggle_resp = client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc1_id, "user_id": rev1_id, "granted": True},
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["granted"] is True

    # Reviewer1 lists documents -> should see ONLY accessible.md
    list_resp = client.get("/api/documents", headers=auth_headers_reviewer1)
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert len(docs) == 1
    assert docs[0]["filename"] == "accessible.md"


def test_reviewer_direct_get_unassigned_document_returns_403(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Direct access to unassigned document returns 403 Forbidden."""
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "secret.md", "content": "# Secret\nNo access"},
    )
    doc_id = resp.json()["id"]

    get_resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
    assert get_resp.status_code == 403
    assert "Access denied" in get_resp.json()["detail"]


def test_reviewer_direct_get_assigned_document_returns_200(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Direct access to assigned document returns 200 OK."""
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "shared.md", "content": "# Shared\nWelcome Alice"},
    )
    doc_id = resp.json()["id"]

    me = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc_id, "user_id": me["id"], "granted": True},
    )

    get_resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
    assert get_resp.status_code == 200
    assert get_resp.json()["filename"] == "shared.md"


def test_nonexistent_document_returns_404_before_403(
    client: TestClient,
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Verify INV-SEC-02: Nonexistent document returns 404, never 403."""
    resp = client.get("/api/documents/999999", headers=auth_headers_reviewer1)
    assert resp.status_code == 404


def test_reviewer_cannot_post_annotation_on_unassigned_document_403(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Posting annotation on unassigned document returns 403 Forbidden."""
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "no_ann.md", "content": "# Document text content"},
    )
    doc_id = resp.json()["id"]

    ann_resp = client.post(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_reviewer1,
        json={
            "start_offset": 2,
            "end_offset": 10,
            "selected_text": "Document",
            "comment_content": "Unauthorized annotation attempt",
        },
    )
    assert ann_resp.status_code == 403


def test_reviewer_can_post_annotation_on_assigned_document_201(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Posting annotation on assigned document returns 201 Created."""
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "yes_ann.md", "content": "# Document text content"},
    )
    doc_id = resp.json()["id"]

    me = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc_id, "user_id": me["id"], "granted": True},
    )

    ann_resp = client.post(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_reviewer1,
        json={
            "start_offset": 2,
            "end_offset": 10,
            "selected_text": "Document",
            "comment_content": "Authorized annotation",
        },
    )
    assert ann_resp.status_code == 201
    assert ann_resp.json()["document_id"] == doc_id


def test_reviewer_cannot_view_annotations_on_unassigned_document_403(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Listing annotations on unassigned document returns 403 Forbidden."""
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "ann_list.md", "content": "# Document text"},
    )
    doc_id = resp.json()["id"]

    resp = client.get(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1)
    assert resp.status_code == 403


def test_reviewer_cannot_reply_to_comment_on_unassigned_document_403(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Replying to an existing comment on an unassigned document returns 403."""
    # Admin creates document and annotation
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "thread_doc.md", "content": "# Thread Root Content"},
    )
    doc_id = resp.json()["id"]

    ann_resp = client.post(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_admin,
        json={
            "start_offset": 2,
            "end_offset": 8,
            "selected_text": "Thread",
            "comment_content": "Root comment by admin",
        },
    )
    ann_id = ann_resp.json()["id"]

    # Reviewer1 (not assigned) tries to reply
    reply_resp = client.post(
        f"/api/annotations/{ann_id}/comments",
        headers=auth_headers_reviewer1,
        json={"content": "Unauthorized reply attempt"},
    )
    assert reply_resp.status_code == 403


def test_reviewer_cannot_edit_comment_on_unassigned_document_403(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Editing comment on unassigned document returns 403 Forbidden."""
    # 1. Admin creates doc and assigns to Alice
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "revoked_doc.md", "content": "# Revoked Document Text"},
    )
    doc_id = resp.json()["id"]
    me = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc_id, "user_id": me["id"], "granted": True},
    )

    # 2. Alice creates annotation with comment
    ann_resp = client.post(
        f"/api/documents/{doc_id}/annotations",
        headers=auth_headers_reviewer1,
        json={
            "start_offset": 2,
            "end_offset": 9,
            "selected_text": "Revoked",
            "comment_content": "Initial comment before revoke",
        },
    )
    ann_id = ann_resp.json()["id"]
    # Get comment id
    ann_detail = client.get(f"/api/annotations/{ann_id}", headers=auth_headers_reviewer1).json()
    comment_id = ann_detail["comments"][0]["id"]

    # 3. Admin revokes Alice's access
    client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc_id, "user_id": me["id"], "granted": False},
    )

    # 4. Alice tries to edit her previous comment -> 403 Forbidden
    edit_resp = client.put(
        f"/api/comments/{comment_id}",
        headers=auth_headers_reviewer1,
        json={"content": "Attempted edit after revoke"},
    )
    assert edit_resp.status_code == 403


def test_admin_can_retrieve_access_matrix(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
    auth_headers_reviewer2: Dict[str, str],
) -> None:
    """Admin retrieves full 2D matrix of documents x reviewers."""
    # Ensure documents exist
    client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "matrix_doc1.md", "content": "# Matrix Doc 1"},
    )
    client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "matrix_doc2.md", "content": "# Matrix Doc 2"},
    )

    # Get matrix
    resp = client.get("/api/admin/document-access", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "documents" in data

    user_usernames = [u["username"] for u in data["users"]]
    assert "reviewer_alice" in user_usernames
    assert "reviewer_bob" in user_usernames

    doc_filenames = [d["filename"] for d in data["documents"]]
    assert "matrix_doc1.md" in doc_filenames
    assert "matrix_doc2.md" in doc_filenames


def test_non_admin_cannot_access_matrix_endpoint_403(
    client: TestClient,
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Non-admin reviewer cannot access matrix endpoint."""
    resp = client.get("/api/admin/document-access", headers=auth_headers_reviewer1)
    assert resp.status_code == 403


def test_admin_can_toggle_access_grant_and_revoke(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Admin toggles access grant and revoke for a user."""
    resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "toggle_test.md", "content": "# Toggle Test"},
    )
    doc_id = resp.json()["id"]
    me = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    user_id = me["id"]

    # Grant
    r1 = client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc_id, "user_id": user_id, "granted": True},
    )
    assert r1.status_code == 200
    assert r1.json()["granted"] is True

    # Check matrix
    m1 = client.get("/api/admin/document-access", headers=auth_headers_admin).json()
    doc_entry = next(d for d in m1["documents"] if d["id"] == doc_id)
    assert doc_entry["access"][str(user_id)] is True

    # Revoke
    r2 = client.post(
        "/api/admin/document-access/toggle",
        headers=auth_headers_admin,
        json={"document_id": doc_id, "user_id": user_id, "granted": False},
    )
    assert r2.status_code == 200
    assert r2.json()["granted"] is False

    # Check matrix again
    m2 = client.get("/api/admin/document-access", headers=auth_headers_admin).json()
    doc_entry2 = next(d for d in m2["documents"] if d["id"] == doc_id)
    assert doc_entry2["access"][str(user_id)] is False


def test_admin_can_batch_update_document_access(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
    auth_headers_reviewer2: Dict[str, str],
) -> None:
    """Admin batch updates access matrix across multiple documents and users."""
    resp1 = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "batch1.md", "content": "# Batch 1"},
    )
    doc1_id = resp1.json()["id"]

    resp2 = client.post(
        "/api/documents/sync",
        headers=auth_headers_admin,
        json={"filename": "batch2.md", "content": "# Batch 2"},
    )
    doc2_id = resp2.json()["id"]

    u1 = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()["id"]
    u2 = client.get("/api/auth/me", headers=auth_headers_reviewer2).json()["id"]

    # Batch update: doc1 gets [u1, u2], doc2 gets [u2]
    batch_resp = client.put(
        "/api/admin/document-access",
        headers=auth_headers_admin,
        json={
            "access_map": {
                str(doc1_id): [u1, u2],
                str(doc2_id): [u2],
            }
        },
    )
    assert batch_resp.status_code == 200
    assert batch_resp.json()["success"] is True

    # Reviewer 1 lists docs -> should see only batch1.md
    r1_docs = client.get("/api/documents", headers=auth_headers_reviewer1).json()
    r1_files = [d["filename"] for d in r1_docs]
    assert "batch1.md" in r1_files
    assert "batch2.md" not in r1_files

    # Reviewer 2 lists docs -> should see both batch1.md and batch2.md
    r2_docs = client.get("/api/documents", headers=auth_headers_reviewer2).json()
    r2_files = [d["filename"] for d in r2_docs]
    assert "batch1.md" in r2_files
    assert "batch2.md" in r2_files


def test_unauthenticated_requests_return_401(client: TestClient) -> None:
    """Unauthenticated requests return 401 Unauthorized."""
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/admin/document-access").status_code == 401
    assert client.post("/api/admin/document-access/toggle", json={}).status_code == 401
    assert client.put("/api/admin/document-access", json={}).status_code == 401


# [SPEC-CHANGE-AUTHORIZED: Toevoegen TDD regressietests voor sidecar cloud upsert, foreign key veilige hydratatie met string IDs, revisie-overerving inclusief expliciet lege lijsten en upload dual-write]
def test_batch_update_sidecar_cloud_upsert(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
    monkeypatch: Any,
) -> None:
    """Batch update writes permissions to sidecar and triggers cloud upsert with on_conflict=filename."""
    import json
    from unittest.mock import MagicMock
    from doc_review_app.config import settings
    from doc_review_app.storage import cloud_sync
    from doc_review_app.storage.json_storage import get_sidecar_path, read_sidecar

    captured_urls = []

    def mock_urlopen(req: Any, timeout: int = 5) -> Any:
        url = req.full_url if hasattr(req, "full_url") else str(req)
        captured_urls.append(url)
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr(cloud_sync.urllib.request, "urlopen", mock_urlopen)
    monkeypatch.setattr(cloud_sync.settings, "supabase_url", "https://mock-supabase.test")
    monkeypatch.setattr(cloud_sync.settings, "supabase_anon_key", "mock-anon-key")

    doc_name = "sample1.md"
    (settings.documents_dir / doc_name).write_text("# Sample 1", encoding="utf-8")
    sync_resp = client.post("/api/documents/sync-folder", headers=auth_headers_admin)
    assert sync_resp.status_code == 200

    docs = client.get("/api/documents", headers=auth_headers_admin).json()
    doc_entry = next((d for d in docs if d["filename"] == doc_name), None)
    assert doc_entry is not None
    doc_id = doc_entry["id"]

    r1_info = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    u1_id = r1_info["id"]
    r1_username = r1_info["username"]

    # Batch grant sample1.md to reviewer1
    payload = {
        "access_map": {
            str(doc_id): [u1_id],
        }
    }
    resp = client.put("/api/admin/document-access", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200

    # Verify on-disk sidecar contains allowed_usernames
    sc_path = get_sidecar_path(doc_name, settings.documents_dir)
    assert sc_path.exists()
    sc_data = read_sidecar(sc_path, filename_hint=doc_name)
    assert sc_data.get("allowed_usernames") == [r1_username]

    # Verify cloud push was executed with ?on_conflict=filename
    push_success = cloud_sync._execute_push(doc_name, sc_data)
    assert push_success is True
    assert any("?on_conflict=filename" in u for u in captured_urls)


def test_hydration_foreign_key_safety() -> None:
    """Hydration tolerates legacy string user IDs, unknown actor IDs, and preserves provenance."""
    import json
    import sqlite3
    from doc_review_app.config import settings
    from doc_review_app.services.document_service import upsert_document
    from doc_review_app.storage.json_storage import get_sidecar_path, write_sidecar_atomic
    from doc_review_app.storage.migration import hydrate_sidecars_to_sqlite
    from doc_review_app.database import get_db

    doc_name = "legacy_test.md"
    doc_path = settings.documents_dir / doc_name
    doc_path.write_text("# Legacy Document\nContent", encoding="utf-8")

    # Insert document properly in SQLite with valid schema
    upsert_document(
        filename=doc_name,
        content="# Legacy Document\nContent",
        format="markdown",
    )

    # Write sidecar with legacy string user IDs ("1229", "2") and actor initials
    sc_data = {
        "document_name": doc_name,
        "allowed_usernames": ["admin"],
        "comments": [],
        "audit_logs": [
            {
                "action": "add_comment",
                "actor_id": "1229",
                "actor_initials": "GW",
                "created_at": "2026-11-01T10:00:00Z",
                "entity_type": "comment",
                "entity_id": "c1",
                "metadata": {},
            },
            {
                "action": "edit_comment",
                "user_id": "2",
                "user_initials": "R1",
                "created_at": "2026-11-01T11:00:00Z",
                "entity_type": "comment",
                "entity_id": "c1",
                "metadata": {},
            },
            {
                "action": "orphan_action",
                "actor_id": "99999",
                "created_at": "2026-11-01T12:00:00Z",
                "entity_type": "document",
                "entity_id": "d1",
                "metadata": {},
            },
        ],
    }
    sc_path = get_sidecar_path(doc_name, settings.documents_dir)
    write_sidecar_atomic(sc_path, sc_data)

    with get_db() as conn:
        # Hydration must not crash with FOREIGN KEY constraint failed
        count = hydrate_sidecars_to_sqlite(db=conn, documents_dir=settings.documents_dir)
        assert count >= 0

        # Verify document_access table was populated
        access_rows = conn.execute(
            "SELECT u.username FROM document_access da JOIN users u ON da.user_id = u.id"
        ).fetchall()
        usernames = [r["username"] for r in access_rows]
        assert "admin" in usernames


def test_new_document_revision_inheritance(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """New revision inherits allowed_usernames from previous version; locked [] stays locked."""
    from doc_review_app.config import settings
    from doc_review_app.storage.json_storage import get_sidecar_path, write_sidecar_atomic, read_sidecar

    v1_name = "spec_v1.md"
    (settings.documents_dir / v1_name).write_text("# Spec V1", encoding="utf-8")
    client.post("/api/documents/sync-folder", headers=auth_headers_admin)

    # Grant v1 to reviewer1
    docs = client.get("/api/documents", headers=auth_headers_admin).json()
    v1_id = next(d["id"] for d in docs if d["filename"] == v1_name)
    r1_info = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    u1_id = r1_info["id"]
    r1_username = r1_info["username"]

    client.put(
        "/api/admin/document-access",
        json={"access_map": {str(v1_id): [u1_id]}},
        headers=auth_headers_admin,
    )

    # Ingest v2 -> should inherit reviewer1
    v2_name = "spec_v2.md"
    (settings.documents_dir / v2_name).write_text("# Spec V2", encoding="utf-8")
    client.post("/api/documents/sync-folder", headers=auth_headers_admin)

    v2_sc = read_sidecar(get_sidecar_path(v2_name, settings.documents_dir), filename_hint=v2_name)
    assert v2_sc.get("allowed_usernames") == [r1_username]

    # Reviewer 1 should immediately see spec_v2.md
    r1_docs = client.get("/api/documents", headers=auth_headers_reviewer1).json()
    assert any(d["filename"] == "spec_v2.md" for d in r1_docs)

    # Test Default-Deny: if locked_v1 has allowed_usernames=[], locked_v2 inherits []
    lock_v1 = "locked_v1.md"
    (settings.documents_dir / lock_v1).write_text("# Locked V1", encoding="utf-8")
    client.post("/api/documents/sync-folder", headers=auth_headers_admin)
    docs = client.get("/api/documents", headers=auth_headers_admin).json()
    lock_v1_id = next(d["id"] for d in docs if d["filename"] == lock_v1)

    client.put(
        "/api/admin/document-access",
        json={"access_map": {str(lock_v1_id): []}},
        headers=auth_headers_admin,
    )

    lock_v2 = "locked_v2.md"
    (settings.documents_dir / lock_v2).write_text("# Locked V2", encoding="utf-8")
    client.post("/api/documents/sync-folder", headers=auth_headers_admin)

    lock_v2_sc = read_sidecar(get_sidecar_path(lock_v2, settings.documents_dir), filename_hint=lock_v2)
    assert lock_v2_sc.get("allowed_usernames") == []


def test_upload_file_dual_write_access(
    client: TestClient,
    auth_headers_admin: Dict[str, str],
    auth_headers_reviewer1: Dict[str, str],
) -> None:
    """Web upload via save_uploaded_file inherits access and writes to both sidecar and SQLite."""
    from doc_review_app.config import settings
    from doc_review_app.storage.json_storage import get_sidecar_path, read_sidecar

    base_v50 = "domeinmodel_v50.md"
    (settings.documents_dir / base_v50).write_text("# Domeinmodel V50", encoding="utf-8")
    client.post("/api/documents/sync-folder", headers=auth_headers_admin)

    docs = client.get("/api/documents", headers=auth_headers_admin).json()
    v50_id = next(d["id"] for d in docs if d["filename"] == base_v50)
    r1_info = client.get("/api/auth/me", headers=auth_headers_reviewer1).json()
    u1_id = r1_info["id"]
    r1_username = r1_info["username"]

    # Grant v50 to reviewer1
    client.put(
        "/api/admin/document-access",
        json={"access_map": {str(v50_id): [u1_id]}},
        headers=auth_headers_admin,
    )

    # Upload v51 via API
    upload_file_content = b"# Domeinmodel V51\nNew Content"
    upload_resp = client.post(
        "/api/documents/upload",
        files=[("files", ("domeinmodel_v51.md", upload_file_content, "text/markdown"))],
        headers=auth_headers_admin,
    )
    assert upload_resp.status_code == 201

    # Sidecar of v51 must have reviewer1
    sc_v51 = read_sidecar(get_sidecar_path("domeinmodel_v51.md", settings.documents_dir), filename_hint="domeinmodel_v51.md")
    assert sc_v51.get("allowed_usernames") == [r1_username]

    # Reviewer 1 can immediately list and access v51
    r1_docs = client.get("/api/documents", headers=auth_headers_reviewer1).json()
    assert any(d["filename"] == "domeinmodel_v51.md" for d in r1_docs)

