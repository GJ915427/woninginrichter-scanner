"""Unit tests for Supabase documents_store sync, anti-zombie tombstone enforcement, and degradation handling."""

import hashlib
import io
import json
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from doc_review_app.config import settings
from doc_review_app.storage import cloud_sync


class MockHTTPResponse:
    def __init__(self, status_code: int = 200, json_data: any = None):
        self.status = status_code
        self._data = json.dumps(json_data or {}).encode("utf-8")

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def test_push_document_to_cloud_mocked(monkeypatch):
    """Verify push_document_to_cloud formats payload correctly and handles status 201."""
    monkeypatch.setattr(settings, "supabase_url", "https://test.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "test-key")

    captured_req = []

    def mock_urlopen(req, timeout=None):
        captured_req.append(req)
        return MockHTTPResponse(201, {"status": "ok"})

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        success = cloud_sync.push_document_to_cloud(
            filename="beleid.md",
            content="# Beleid\nInhoud",
            file_size=15,
            sha256_hash="",
        )

    assert success is True
    assert len(captured_req) == 1
    req = captured_req[0]
    assert req.full_url == "https://test.supabase.co/rest/v1/documents_store"
    payload = json.loads(req.data.decode("utf-8"))
    assert payload["filename"] == "beleid.md"
    assert payload["content"] == "# Beleid\nInhoud"
    assert payload["is_deleted"] is False
    assert len(payload["sha256"]) == 64


def test_delete_document_from_cloud_tombstone_mocked(monkeypatch):
    """Verify delete_document_from_cloud registers tombstone in documents_store and purges document_sidecars."""
    monkeypatch.setattr(settings, "supabase_url", "https://test.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "test-key")

    requests = []

    def mock_urlopen(req, timeout=None):
        requests.append(req)
        return MockHTTPResponse(200, {})

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        success = cloud_sync.delete_document_from_cloud("beleid.md")

    assert success is True
    assert len(requests) == 2

    # Request 1: POST tombstone to documents_store
    tombstone_req = requests[0]
    assert tombstone_req.full_url == "https://test.supabase.co/rest/v1/documents_store"
    tombstone_data = json.loads(tombstone_req.data.decode("utf-8"))
    assert tombstone_data["filename"] == "beleid.md"
    assert tombstone_data["is_deleted"] is True
    assert tombstone_data["content"] == ""

    # Request 2: DELETE from document_sidecars
    sidecar_del_req = requests[1]
    assert sidecar_del_req.get_method() == "DELETE"
    assert "document_sidecars?filename=eq.beleid.md" in sidecar_del_req.full_url


def test_pull_documents_from_cloud_anti_zombie(tmp_path, monkeypatch):
    """Verify cloud tombstones physically remove resurrected Git files and sidecars from disk."""
    monkeypatch.setattr(settings, "supabase_url", "https://test.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "test-key")

    # Simulate resurrected Git file and existing sidecars on disk
    doc_path = tmp_path / "oud_bestand.md"
    doc_path.write_text("# Oud Bestand", encoding="utf-8")
    unique_sidecar = tmp_path / "oud_bestand.md.comments.json"
    unique_sidecar.write_text("{}", encoding="utf-8")
    stem_sidecar = tmp_path / "oud_bestand.comments.json"
    stem_sidecar.write_text("{}", encoding="utf-8")

    # Cloud response with tombstone for oud_bestand.md and new active file nieuw.md
    cloud_rows = [
        {
            "filename": "oud_bestand.md",
            "content": "",
            "sha256": "",
            "file_size": 0,
            "is_deleted": True,
            "updated_at": "2026-10-13T20:00:00Z",
        },
        {
            "filename": "nieuw.md",
            "content": "# Nieuw Document",
            "sha256": hashlib.sha256(b"# Nieuw Document").hexdigest(),
            "file_size": 16,
            "is_deleted": False,
            "updated_at": "2026-10-13T20:00:00Z",
        },
        {
            "filename": "../../../etc/passwd",
            "content": "hacked",
            "sha256": "abc",
            "file_size": 6,
            "is_deleted": False,
            "updated_at": "2026-10-13T20:00:00Z",
        },
    ]

    def mock_urlopen(req, timeout=None):
        return MockHTTPResponse(200, cloud_rows)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        count, tombstone_names, tombstone_stems = cloud_sync.pull_documents_from_cloud(tmp_path)

    assert count == 1
    assert "oud_bestand.md" in tombstone_names
    assert "oud_bestand" in tombstone_stems

    # Local tombstoned files must be unlinked
    assert not doc_path.exists()
    assert not unique_sidecar.exists()
    assert not stem_sidecar.exists()

    # Active file must be restored
    assert (tmp_path / "nieuw.md").exists()
    assert (tmp_path / "nieuw.md").read_text(encoding="utf-8") == "# Nieuw Document"

    # Path traversal file must NOT exist outside tmp_path
    assert not (tmp_path / "passwd").exists()


def test_pull_sidecars_with_tombstones(tmp_path, monkeypatch):
    """Verify pull_sidecars_from_cloud ignores tombstoned sidecars and removes local remnants."""
    monkeypatch.setattr(settings, "supabase_url", "https://test.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "test-key")

    # Local remnant of deleted file's sidecar
    zombie_sc = tmp_path / "verwijderd.comments.json"
    zombie_sc.write_text('{"annotations": [{"comments": ["old"]}]}', encoding="utf-8")

    cloud_sidecars = [
        {
            "filename": "verwijderd.md",
            "sidecar_json": {"annotations": [{"comments": ["cloud"]}]},
            "updated_at": "2026-10-13T20:00:00Z",
        },
        {
            "filename": "actief.md",
            "sidecar_json": {"annotations": [{"id": 1, "comments": [{"text": "keep"}]}]},
            "updated_at": "2026-10-13T20:00:00Z",
        },
    ]

    def mock_urlopen(req, timeout=None):
        return MockHTTPResponse(200, cloud_sidecars)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        count = cloud_sync.pull_sidecars_from_cloud(
            tmp_path,
            tombstone_filenames={"verwijderd.md"},
            tombstone_stems={"verwijderd"},
        )

    assert count == 1
    # Zombie sidecar must be unlinked
    assert not zombie_sc.exists()
    # Active sidecar must be written
    assert (tmp_path / "actief.comments.json").exists()


def test_connectivity_probe_and_degradation(monkeypatch):
    """Verify check_connection updates degradation flag dynamically."""
    monkeypatch.setattr(settings, "supabase_url", "https://test.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "test-key")

    cloud_sync.cloud_sync_degraded = True

    def mock_probe_success(req, timeout=None):
        return MockHTTPResponse(200, [{"filename": "sample.md"}])

    with patch("urllib.request.urlopen", side_effect=mock_probe_success):
        is_up = cloud_sync.check_connection()

    assert is_up is True
    assert cloud_sync.cloud_sync_degraded is False

    # Simulate network error
    def mock_probe_fail(req, timeout=None):
        raise TimeoutError("WAN connection timed out")

    with patch("urllib.request.urlopen", side_effect=mock_probe_fail):
        is_up = cloud_sync.check_connection()

    assert is_up is False
