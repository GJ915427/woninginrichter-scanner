"""Test suite for Native OS Folder Explorer opening and directory synchronization."""

import os
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from doc_review_app.config import settings
from doc_review_app.services import document_service


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


@pytest.fixture
def isolated_docs_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Isolate settings.documents_dir in tmp_path to prevent mutating production documents."""
    test_docs = tmp_path / "test_local_docs"
    test_docs.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "documents_dir", test_docs)
    return test_docs


class TestFolderExplorerSync:
    """Verifies OS folder opening and two-way directory synchronization."""

    def test_open_folder_api_endpoint(self, auth_client: TestClient, isolated_docs_dir: Path):
        """POST /api/documents/open-folder calls OS launcher and returns 200."""
        with patch.object(document_service, "_open_folder_windows", return_value=True), \
             patch("os.startfile", create=True) as mock_startfile, \
             patch("subprocess.Popen") as mock_popen:
            res = auth_client.post("/api/documents/open-folder")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] in ("opened", "fallback")
            assert str(isolated_docs_dir.resolve()) in data["path"]

    def test_open_folder_unauthenticated_rejected(self, client: TestClient):
        """Unauthenticated requests to open folder are rejected with 401."""
        res = client.post("/api/documents/open-folder")
        assert res.status_code in (401, 403)

    def test_open_folder_cross_platform_graceful_fallback(self, isolated_docs_dir: Path):
        """open_local_documents_folder handles exceptions without crashing."""
        with patch.object(document_service, "_open_folder_windows", side_effect=OSError("Windows COM error")), \
             patch("os.startfile", side_effect=OSError("Access denied"), create=True), \
             patch("subprocess.Popen", side_effect=OSError("No such file")):
            result = document_service.open_local_documents_folder()
            assert result["status"] == "fallback"
            assert "error" in result

    def test_sync_folder_api_endpoint(self, auth_client: TestClient, isolated_docs_dir: Path):
        """POST /api/documents/sync-folder returns sync summary structure."""
        res = auth_client.post("/api/documents/sync-folder")
        assert res.status_code == 200
        data = res.json()
        assert "added" in data
        assert "updated" in data
        assert "removed" in data
        assert "total_documents" in data

    def test_sync_directory_lifecycle(self, auth_client: TestClient, isolated_docs_dir: Path):
        """Full directory sync lifecycle: add, update, delete, ignore unsupported."""
        # 1. Add files on disk
        doc1 = isolated_docs_dir / "guide.md"
        doc1.write_text("# User Guide\nWelcome to review.", encoding="utf-8")

        doc2 = isolated_docs_dir / "notes.txt"
        doc2.write_text("Meeting notes.\nAction items.", encoding="utf-8")

        ignored = isolated_docs_dir / "script.exe"
        ignored.write_bytes(b"binary-data")

        # Sync
        res1 = auth_client.post("/api/documents/sync-folder")
        assert res1.status_code == 200
        data1 = res1.json()
        assert "guide.md" in data1["added"]
        assert "notes.txt" in data1["added"]
        assert "script.exe" not in data1["added"]

        # Verify listing
        list_res = auth_client.get("/api/documents")
        filenames = [d["filename"] for d in list_res.json()]
        assert "guide.md" in filenames
        assert "notes.txt" in filenames
        assert "script.exe" not in filenames

        # 2. Modify a file on disk
        doc1.write_text("# User Guide (Updated)\nNew section added.", encoding="utf-8")
        res2 = auth_client.post("/api/documents/sync-folder")
        assert res2.status_code == 200
        data2 = res2.json()
        assert "guide.md" in data2["updated"]

        # 3. Delete a file from disk
        doc2.unlink()
        res3 = auth_client.post("/api/documents/sync-folder")
        assert res3.status_code == 200
        data3 = res3.json()
        assert "notes.txt" in data3["removed"]

        # Verify final listing
        list_res2 = auth_client.get("/api/documents")
        final_names = [d["filename"] for d in list_res2.json()]
        assert "guide.md" in final_names
        assert "notes.txt" not in final_names

    def test_sync_crlf_normalization_and_hash_stability(
        self, auth_client: TestClient, isolated_docs_dir: Path
    ):
        """Windows CRLF line endings are normalized to LF without false update loops."""
        crlf_file = isolated_docs_dir / "crlf_doc.md"
        crlf_file.write_bytes(b"# Title\r\nLine 1\r\nLine 2\r\n")

        # Initial sync adds file
        res1 = auth_client.post("/api/documents/sync-folder")
        assert res1.status_code == 200
        assert "crlf_doc.md" in res1.json()["added"]

        # Verify stored content is normalized LF
        list_docs = auth_client.get("/api/documents").json()
        doc_id = next(d["id"] for d in list_docs if d["filename"] == "crlf_doc.md")
        doc_detail = auth_client.get(f"/api/documents/{doc_id}").json()
        assert "\r\n" not in doc_detail["content"]
        assert "\n" in doc_detail["content"]

        # Second sync pass should be a no-op (hash matches, no false updates)
        res2 = auth_client.post("/api/documents/sync-folder")
        assert res2.status_code == 200
        assert "crlf_doc.md" not in res2.json()["updated"]
        assert "crlf_doc.md" not in res2.json()["added"]

    def test_sync_unauthenticated_rejected(self, client: TestClient):
        """Unauthenticated requests to sync folder are rejected with 401."""
        res = client.post("/api/documents/sync-folder")
        assert res.status_code in (401, 403)

    def test_open_local_documents_folder_service(self, isolated_docs_dir: Path):
        """open_local_documents_folder tests both Windows COM route and subprocess fallback."""
        # 1. Windows with successful _open_folder_windows
        with patch("sys.platform", "win32"), \
             patch.object(document_service, "_open_folder_windows", return_value=True) as mock_win_open, \
             patch("subprocess.Popen") as mock_popen:
            res = document_service.open_local_documents_folder()
            assert res["status"] == "opened"
            mock_win_open.assert_called_once()
            mock_popen.assert_not_called()

        # 2. Windows with _open_folder_windows falling back to subprocess.Popen
        with patch("sys.platform", "win32"), \
             patch.object(document_service, "_open_folder_windows", return_value=False), \
             patch("subprocess.Popen") as mock_popen, \
             patch("os.startfile", create=True) as mock_startfile:
            res = document_service.open_local_documents_folder()
            assert res["status"] == "fallback"
            mock_startfile.assert_not_called()

        # 3. Darwin (macOS)
        with patch("sys.platform", "darwin"), \
             patch("subprocess.Popen") as mock_popen:
            res = document_service.open_local_documents_folder()
            assert res["status"] == "opened"
            mock_popen.assert_called_once_with(["open", str(isolated_docs_dir.resolve())])

        # 4. Linux
        with patch("sys.platform", "linux"), \
             patch("subprocess.Popen") as mock_popen:
            res = document_service.open_local_documents_folder()
            assert res["status"] == "opened"
            mock_popen.assert_called_once_with(["xdg-open", str(isolated_docs_dir.resolve())])

    def test_static_cache_control_headers(self, client: TestClient):
        """Verify anti-cache headers are present on / and /static/*."""
        res_root = client.get("/")
        assert res_root.status_code == 200
        assert "no-cache" in res_root.headers.get("cache-control", "")
        assert "no-store" in res_root.headers.get("cache-control", "")

        res_js = client.get("/static/js/app.js")
        assert res_js.status_code == 200
        assert "no-cache" in res_js.headers.get("cache-control", "")
        assert "no-store" in res_js.headers.get("cache-control", "")

    def test_frontend_static_contracts(self, client: TestClient):
        """Verify index.html has single button UX, inline onclick, and cache busters."""
        res = client.get("/")
        assert res.status_code == 200
        html = res.text
        assert 'id="btn-open-folder"' in html
        assert 'onclick="handleOpenFolder()"' in html
        assert 'id="btn-pick-file"' in html
        assert 'id="file-picker-input"' in html
        assert 'id="doc-search-input"' not in html
        assert 'id="btn-sync-drawer"' not in html
        assert 'id="btn-open-folder-action"' not in html
        assert "app.js?v=" in html

    def test_local_documents_dir_unpolluted(self):
        """Verify production settings.documents_dir contains no test residue files."""
        target_dir = settings.documents_dir.resolve()
        if target_dir.exists():
            polluted_files = [
                f.name for f in target_dir.iterdir()
                if f.is_file() and f.name.endswith(".feedback.md")
            ]
            assert not polluted_files, f"Unwanted test feedback residue found in documents dir: {polluted_files}"
