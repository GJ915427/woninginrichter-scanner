"""Integration and regression test suite for Document Explorer API.

Validates:
- POST /api/documents/upload: Single and batch uploads, UTF-8 normalization, path traversal sanitization, and invalid extension rejections.
- DELETE /api/documents/{doc_id}: Cascade deletion of annotations/comments and disk unlinking.
- Authentication gating on upload and delete endpoints.
"""

import io
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from doc_review_app.main import app
from doc_review_app.config import settings
from doc_review_app.database import get_db


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """Create an authenticated client session."""
    login_res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": settings.admin_password},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"
    client.cookies.set("auth_token", token)
    return client


class TestDocumentExplorerAPI:
    """Test suite for Document Explorer upload, delete, and validation lifecycles."""

    def test_upload_single_markdown_file(self, auth_client: TestClient, tmp_path: Path):
        """Uploading a single .md file saves to disk and indexes in SQLite."""
        file_content = b"# Document Explorer Test\n\nUploaded via test client.\r\n"
        files = [
            ("files", ("explorer_test_1.md", io.BytesIO(file_content), "text/markdown"))
        ]
        res = auth_client.post("/api/documents/upload", files=files)
        assert res.status_code == 201, f"Upload failed: {res.text}"
        data = res.json()
        assert len(data) == 1
        assert data[0]["filename"] == "explorer_test_1.md"
        assert data[0]["action"] in ("created", "updated")

        # Verify file on disk
        target_file = settings.documents_dir / "explorer_test_1.md"
        assert target_file.exists()
        assert target_file.read_text(encoding="utf-8").startswith("# Document Explorer Test")

        # Cleanup
        target_file.unlink(missing_ok=True)

    def test_upload_batch_mixed_files(self, auth_client: TestClient):
        """Batch upload multiple files (.md and .txt) in a single request."""
        f1 = ("files", ("batch_doc1.md", io.BytesIO(b"# Batch 1\n"), "text/markdown"))
        f2 = ("files", ("batch_doc2.txt", io.BytesIO(b"Plain text batch 2\n"), "text/plain"))
        res = auth_client.post("/api/documents/upload", files=[f1, f2])
        assert res.status_code == 201
        data = res.json()
        assert len(data) == 2
        filenames = [d["filename"] for d in data]
        assert "batch_doc1.md" in filenames
        assert "batch_doc2.txt" in filenames

        # Cleanup
        (settings.documents_dir / "batch_doc1.md").unlink(missing_ok=True)
        (settings.documents_dir / "batch_doc2.txt").unlink(missing_ok=True)

    def test_upload_invalid_extension_rejected(self, auth_client: TestClient):
        """Unsupported file extensions like .pdf or .exe are rejected with 400."""
        files = [
            ("files", ("malicious.exe", io.BytesIO(b"MZBinaryData"), "application/octet-stream"))
        ]
        res = auth_client.post("/api/documents/upload", files=files)
        assert res.status_code == 400
        assert "Unsupported file extension" in res.json()["detail"]

    def test_upload_empty_file_rejected(self, auth_client: TestClient):
        """Empty files are rejected with 400 Bad Request."""
        files = [
            ("files", ("empty.md", io.BytesIO(b""), "text/markdown"))
        ]
        res = auth_client.post("/api/documents/upload", files=files)
        assert res.status_code == 400
        assert "empty" in res.json()["detail"].lower()

    def test_upload_path_traversal_sanitized(self, auth_client: TestClient):
        """Path traversal sequences (../../evil.md) are sanitized to simple filename."""
        files = [
            ("files", ("../../traversal_test.md", io.BytesIO(b"# Sanitized\n"), "text/markdown"))
        ]
        res = auth_client.post("/api/documents/upload", files=files)
        assert res.status_code == 201
        data = res.json()
        assert data[0]["filename"] == "traversal_test.md"

        # Verify it was saved strictly within documents_dir
        target_file = settings.documents_dir / "traversal_test.md"
        assert target_file.exists()
        target_file.unlink(missing_ok=True)

    def test_delete_document_and_cascade(self, auth_client: TestClient):
        """Deleting a document cascades annotations/comments and removes disk file."""
        # 1. Create document via upload
        files = [
            ("files", ("to_delete.md", io.BytesIO(b"# To Delete\nContent here.\n"), "text/markdown"))
        ]
        res = auth_client.post("/api/documents/upload", files=files)
        assert res.status_code == 201
        doc_id = res.json()[0]["id"]

        # 2. Add annotation and comment
        ann_res = auth_client.post(
            f"/api/documents/{doc_id}/annotations",
            json={
                "start_offset": 2,
                "end_offset": 8,
                "selected_text": "Delete",
                "comment_content": "Annotation to be cascaded",
            },
        )
        assert ann_res.status_code == 201
        ann_id = ann_res.json()["id"]

        # Verify annotation exists in db
        with get_db() as db:
            ann_row = db.execute("SELECT id FROM annotations WHERE id = ?", (ann_id,)).fetchone()
            assert ann_row is not None

        # 3. Delete document
        del_res = auth_client.delete(f"/api/documents/{doc_id}")
        assert del_res.status_code == 200
        assert del_res.json()["deleted"] is True

        # 4. Verify DB row and cascading annotations are deleted
        with get_db() as db:
            doc_row = db.execute("SELECT id FROM documents WHERE id = ?", (doc_id,)).fetchone()
            assert doc_row is None
            ann_row = db.execute("SELECT id FROM annotations WHERE id = ?", (ann_id,)).fetchone()
            assert ann_row is None

        # 5. Verify file is unlinked from disk
        target_file = settings.documents_dir / "to_delete.md"
        assert not target_file.exists()

    def test_delete_nonexistent_document_returns_404(self, auth_client: TestClient):
        """Deleting a document with non-existent ID returns 404 Not Found."""
        res = auth_client.delete("/api/documents/999999")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_unauthenticated_mutations_rejected(self, client: TestClient):
        """Unauthenticated requests to upload or delete are rejected with 401."""
        files = [
            ("files", ("unauth.md", io.BytesIO(b"# Unauthorized"), "text/markdown"))
        ]
        res_upload = client.post("/api/documents/upload", files=files)
        assert res_upload.status_code in (401, 403)

        res_delete = client.delete("/api/documents/1")
        assert res_delete.status_code in (401, 403)

    def test_reviewer_forbidden_on_admin_endpoints(self, client: TestClient, auth_headers_reviewer1: dict):
        """Reviewers without admin privileges are rejected with 403 on upload, delete, open-folder, sync-folder, feedback export."""
        files = [
            ("files", ("forbidden.md", io.BytesIO(b"# Forbidden"), "text/markdown"))
        ]
        res_upload = client.post("/api/documents/upload", files=files, headers=auth_headers_reviewer1)
        assert res_upload.status_code == 403

        res_delete = client.delete("/api/documents/1", headers=auth_headers_reviewer1)
        assert res_delete.status_code == 403

        res_open = client.post("/api/documents/open-folder", headers=auth_headers_reviewer1)
        assert res_open.status_code == 403

        res_sync = client.post("/api/documents/sync-folder", headers=auth_headers_reviewer1)
        assert res_sync.status_code == 403

        res_export = client.post("/api/documents/1/export-feedback", headers=auth_headers_reviewer1)
        assert res_export.status_code == 403

        res_fb = client.get("/api/documents/1/feedback", headers=auth_headers_reviewer1)
        assert res_fb.status_code == 403

    def test_static_frontend_elements_and_m3_tokens(self, client: TestClient):
        """Verify HTML, CSS, and JS file explorer components and M3 tokens."""
        # 1. HTML elements
        res_html = client.get("/")
        assert res_html.status_code == 200
        html = res_html.text
        assert 'id="btn-open-folder"' in html
        assert 'id="btn-open-folder-action"' not in html
        assert 'onclick="handleOpenFolder()"' in html
        assert 'id="btn-pick-file"' in html
        assert 'id="file-picker-input"' in html
        assert 'id="doc-search-input"' not in html
        assert 'id="btn-sync-drawer"' not in html
        assert 'id="btn-sync-top"' not in html
        assert 'id="delete-doc-dialog"' in html
        assert 'id="btn-confirm-delete-doc"' in html
        assert 'id="file-dropzone"' not in html
        assert 'id="btn-upload-file"' not in html
        assert 'id="nav-drawer-toc-section"' in html
        assert 'id="document-toc-nav"' in html

        # 2. CSS classes
        res_css = client.get("/static/css/m3_theme.css")
        assert res_css.status_code == 200
        css = res_css.text
        assert ".nav-drawer__headline-btn" in css
        assert ".document-nav-item__delete" in css
        assert ".file-dropzone" not in css
        assert ".m3-table-wrapper" in css
        assert ".m3-table" in css
        assert ".m3-callout" in css
        assert ".nav-drawer__toc-section" in css
        assert ".m3-toc-link" in css
        assert "@media print" in css

        # 3. JS Explorer & focus-sync logic
        res_js = client.get("/static/js/app.js")
        assert res_js.status_code == 200
        js = res_js.text
        assert "initFolderExplorer" in js
        assert "handleOpenFolder" in js
        assert "handleFileSelected" in js
        assert "isOpeningFolder" in js
        assert "debouncedFocusSync" in js
        assert "handleConfirmDelete" in js
        assert "openDeleteModal" in js
        assert "generateTableOfContents" in js
        assert "initCodeCopyButtons" in js

    def test_markdown_presentation_and_m3_layout(self, client: TestClient):
        """Verify markdown.js and selection.js contracts for GFM tables, callouts, and AST isolation."""
        res_md = client.get("/static/js/markdown.js")
        assert res_md.status_code == 200
        md_js = res_md.text
        assert "renderTable" in md_js
        assert "renderCalloutOrQuote" in md_js
        assert "m3-table-wrapper" in md_js
        assert "m3-callout" in md_js
        assert "m3-code-copy-btn" in md_js
        assert 'data-doc-review-ignore="true"' in md_js

        res_sel = client.get("/static/js/selection.js")
        assert res_sel.status_code == 200
        sel_js = res_sel.text
        assert "TableCell" in sel_js
        assert "Callout" in sel_js
        assert 'data-doc-review-ignore="true"' in sel_js

    def test_backup_document_comments_to_archive(self, auth_client: TestClient, tmp_path: Path):
        """Verify document comments and annotations are safely archived to JSON and Markdown."""
        from doc_review_app.database import get_db
        from doc_review_app.services.document_service import upsert_document, backup_document_comments_to_archive

        # 1. Seed document
        with get_db() as db:
            doc = upsert_document(
                filename="archival_test_doc.md",
                content="# Archival Test Document\n\nContent for testing.",
                format="markdown",
                db=db,
            )
        doc_id = doc["id"]

        # 2. Add annotation & comment
        auth_client.post(
            f"/api/documents/{doc_id}/annotations",
            json={
                "start_offset": 0,
                "end_offset": 24,
                "selected_text": "# Archival Test Document",
                "comment_content": "Belangrijke review opmerking over de titel.",
                "badge_color": "#FF6D00",
                "ast_path": "Heading 1",
                "node_type": "Heading",
            },
        )

        # 3. Archive to tmp_path
        res = backup_document_comments_to_archive(
            filename="archival_test_doc.md",
            archive_dir=tmp_path,
        )
        assert res["status"] == "success"
        assert res["annotations_count"] >= 1
        assert res["comments_count"] >= 1

        json_p = Path(res["json_path"])
        md_p = Path(res["markdown_path"])
        assert json_p.exists()
        assert md_p.exists()

        md_content = md_p.read_text(encoding="utf-8")
        assert "Belangrijke review opmerking over de titel" in md_content
        assert "# Archival Test Document" in md_content
