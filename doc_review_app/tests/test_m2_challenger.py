"""Empirical Challenger Test Suite for Milestone 2:
Document Management, Ingestion & Sync Utility.

This suite empirically stress-tests:
1. Line Ending Normalization (CRLF/LF/CR mixtures, multi-byte UTF-8,
   exact byte length in size_bytes, character offset stability,
   SHA-256 idempotency, annotation offset boundaries).
2. Sync Client CLI & Watch Utility (file addition, modification,
   deletion behavior, hash caching, file filtering, subdirectory isolation,
   --once and --watch modes, error resilience, and CLI arguments).
"""

import hashlib
import json
from pathlib import Path
import tempfile
import threading
import time
from typing import Any, Dict
from unittest.mock import MagicMock, patch
import urllib.error

import pytest
from starlette.testclient import TestClient

from doc_review_app.main import app
from doc_review_app.services import document_service
from doc_review_app.services.document_service import (
    compute_sha256,
    normalize_line_endings,
    upsert_document,
    validate_filename_and_format,
)
from doc_review_app.sync_client import (
    SUPPORTED_EXTENSIONS,
    SyncClient,
    build_parser,
)


# ---------------------------------------------------------------------------
# Test Fixtures & Setup
# ---------------------------------------------------------------------------

@pytest.fixture
def isolated_client(tmp_path: Path):
    """Provide a TestClient backed by a strictly isolated SQLite database file."""
    import os
    db_file = tmp_path / "challenger_isolated.db"
    old_env = os.environ.get("DOC_REVIEW_DB_PATH")
    os.environ["DOC_REVIEW_DB_PATH"] = str(db_file)

    # Initialize schema and seed admin in the isolated database
    from doc_review_app.config import get_settings
    get_settings.cache_clear()
    from doc_review_app.database import get_db, init_db
    from doc_review_app.services import user_service
    settings = get_settings()

    init_db(db_file)
    with get_db(db_file) as db:
        user_service.create_user(
            db=db,
            username=settings.admin_username,
            password=settings.admin_password,
            full_name=settings.admin_full_name,
            initials=settings.admin_initials,
            email=settings.admin_email,
            is_admin=True,
        )

    with TestClient(app) as tc:
        # Obtain admin auth headers
        login_resp = tc.post("/api/auth/login", json={
            "username": settings.admin_username,
            "password": settings.admin_password,
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["token"]
        auth_headers = {"Authorization": f"Bearer {token}"}
        yield tc, auth_headers, db_file

    # Teardown
    get_settings.cache_clear()
    if old_env is not None:
        os.environ["DOC_REVIEW_DB_PATH"] = old_env
    else:
        os.environ.pop("DOC_REVIEW_DB_PATH", None)


# ---------------------------------------------------------------------------
# Dimension 1: Line Ending Normalization, Byte Length & Offset Determinism
# ---------------------------------------------------------------------------

class TestLineEndingNormalizationAdversarial:
    """Stress-test line ending normalization across mixed CRLF, LF, CR, and Unicode."""

    def test_mixed_crlf_lf_byte_length_and_char_offsets(self, isolated_client):
        """Verify mixed CRLF/LF content preserves exact byte lengths and character offsets."""
        client, headers, _ = isolated_client

        # Construct content with mixed CRLF (\r\n), LF (\n), and solitary CR (\r)
        # Includes ASCII, 2-byte UTF-8 (é), and 4-byte UTF-8 emoji (🚀)
        raw_content = (
            "# Specification\r\n"
            "Section 1: Introduction\n"
            "Item café au lait\r\n"
            "Rocket launch 🚀 in progress\r"
            "Final conclusion.\n"
        )

        expected_normalized = (
            "# Specification\n"
            "Section 1: Introduction\n"
            "Item café au lait\n"
            "Rocket launch 🚀 in progress\n"
            "Final conclusion.\n"
        )

        expected_utf8_bytes = expected_normalized.encode("utf-8")
        expected_size_bytes = len(expected_utf8_bytes)
        expected_char_length = len(expected_normalized)
        expected_sha256 = hashlib.sha256(expected_utf8_bytes).hexdigest()

        # Ingest document via API
        resp = client.post("/api/documents/sync", headers=headers, json={
            "filename": "adversarial_mixed.md",
            "content": raw_content,
            "format": "markdown",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["action"] == "created"
        assert data["sha256"] == expected_sha256
        doc_id = data["id"]

        # 1. Verify GET /api/documents returns exact size_bytes
        list_resp = client.get("/api/documents", headers=headers)
        assert list_resp.status_code == 200
        summaries = [d for d in list_resp.json() if d["id"] == doc_id]
        assert len(summaries) == 1
        summary = summaries[0]
        assert summary["size_bytes"] == expected_size_bytes, (
            f"size_bytes mismatch: expected {expected_size_bytes}, got {summary['size_bytes']}"
        )

        # 2. Verify GET /api/documents/{id} returns clean normalized content with 0 carriage returns
        detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
        assert detail_resp.status_code == 200
        doc = detail_resp.json()
        stored_content = doc["content"]
        assert "\r" not in stored_content, "Carriage return '\\r' found in stored content!"
        assert stored_content == expected_normalized
        assert len(stored_content) == expected_char_length

        # 3. Verify character slice offsets at line boundaries
        line1_start = expected_normalized.find("Section 1: Introduction")
        intro_start = line1_start + len("Section 1: ")
        intro_end = intro_start + len("Introduction")
        assert stored_content[intro_start:intro_end] == "Introduction"

        # Anchor an annotation at exact offsets
        ann_resp = client.post(f"/api/documents/{doc_id}/annotations", headers=headers, json={
            "start_offset": intro_start,
            "end_offset": intro_end,
            "selected_text": "Introduction",
            "comment_content": "Anchor verification comment",
        })
        assert ann_resp.status_code == 201
        ann_data = ann_resp.json()
        assert ann_data["start_offset"] == intro_start
        assert ann_data["end_offset"] == intro_end
        assert ann_data["selected_text"] == "Introduction"

    def test_idempotent_normalization_sha256_stability(self, isolated_client):
        """Sending CRLF, LF, and mixed inputs of identical text must produce identical SHA-256."""
        client, headers, _ = isolated_client

        text_lf = "Line 1\nLine 2\nLine 3\n"
        text_crlf = "Line 1\r\nLine 2\r\nLine 3\r\n"
        text_mixed = "Line 1\r\nLine 2\nLine 3\r"

        resp1 = client.post("/api/documents/sync", headers=headers, json={
            "filename": "idempotent.txt",
            "content": text_crlf,
            "format": "text",
        })
        assert resp1.status_code == 201
        hash1 = resp1.json()["sha256"]

        resp2 = client.post("/api/documents/sync", headers=headers, json={
            "filename": "idempotent.txt",
            "content": text_lf,
            "format": "text",
        })
        assert resp2.status_code == 200
        assert resp2.json()["action"] == "updated"
        hash2 = resp2.json()["sha256"]

        resp3 = client.post("/api/documents/sync", headers=headers, json={
            "filename": "idempotent.txt",
            "content": text_mixed,
            "format": "text",
        })
        assert resp3.status_code == 200
        hash3 = resp3.json()["sha256"]

        assert hash1 == hash2 == hash3, f"Hashes differed: {hash1} vs {hash2} vs {hash3}"

    def test_anomalous_line_endings(self):
        """Stress-test anomalous line endings (CRCRLF, LFCR, solitary CR, empty lines)."""
        # CRCRLF: \r\r\n -> becomes \n\n
        content_crcrlf = "A\r\r\nB"
        norm = normalize_line_endings(content_crcrlf)
        assert norm == "A\n\nB"
        assert "\r" not in norm

        # Multiple consecutive blank CRLF lines
        blank_crlf = "\r\n\r\n\r\n"
        norm_blank = normalize_line_endings(blank_crlf)
        assert norm_blank == "\n\n\n"
        assert len(norm_blank) == 3

        # Solitary CR (Mac legacy)
        mac_cr = "Line1\rLine2\rLine3"
        norm_mac = normalize_line_endings(mac_cr)
        assert norm_mac == "Line1\nLine2\nLine3"

        # Trailing CRLF vs no trailing newline
        no_trailing = "Hello\r\nWorld"
        assert normalize_line_endings(no_trailing) == "Hello\nWorld"

        # Empty content
        assert normalize_line_endings("") == ""
        assert normalize_line_endings(None) == ""

    def test_oversized_offset_boundary_rejection(self, isolated_client):
        """Annotation exceeding normalized document length must be rejected with 400 Bad Request."""
        client, headers, _ = isolated_client

        # Raw CRLF text: "AB\r\nCD\r\n" -> 8 characters raw, 6 characters normalized ("AB\nCD\n")
        raw_crlf = "AB\r\nCD\r\n"
        sync_resp = client.post("/api/documents/sync", headers=headers, json={
            "filename": "bounds.txt",
            "content": raw_crlf,
            "format": "text",
        })
        doc_id = sync_resp.json()["id"]

        # Attempt to create annotation with end_offset = 7 (valid in unnormalized CRLF text, but > 6)
        bad_ann_resp = client.post(f"/api/documents/{doc_id}/annotations", headers=headers, json={
            "start_offset": 0,
            "end_offset": 7,
            "selected_text": "AB\nCD\n",
        })
        assert bad_ann_resp.status_code == 400
        assert "exceeds document length" in bad_ann_resp.json()["detail"]


# ---------------------------------------------------------------------------
# Dimension 2: Sync Client CLI & Watch Utility Rigorous Verification
# ---------------------------------------------------------------------------

class TestSyncClientEmpirical:
    """Empirical tests verifying SyncClient implementation directly."""

    def test_sync_client_scans_only_supported_extensions(self, tmp_path: Path):
        """SyncClient must only detect .md and .txt files, filtering out all others."""
        # Create eligible files
        (tmp_path / "valid1.md").write_text("# Doc 1", encoding="utf-8")
        (tmp_path / "valid2.txt").write_text("Text 2", encoding="utf-8")
        (tmp_path / "VALID3.MD").write_text("# Uppercase ext", encoding="utf-8")
        (tmp_path / "valid4.TXT").write_text("Uppercase txt", encoding="utf-8")

        # Create ineligible files
        (tmp_path / "doc.pdf").write_bytes(b"%PDF-1.4")
        (tmp_path / "image.png").write_bytes(b"\x89PNG")
        (tmp_path / "data.json").write_text("{}", encoding="utf-8")
        (tmp_path / "script.py").write_text("print()", encoding="utf-8")
        (tmp_path / "README").write_text("no extension", encoding="utf-8")
        (tmp_path / ".hidden.md").write_text("# Hidden", encoding="utf-8")

        # Create subdirectory with .md inside (must be ignored)
        sub = tmp_path / "nested_dir"
        sub.mkdir()
        (sub / "nested.md").write_text("# Nested", encoding="utf-8")

        client = SyncClient(watch_dir=tmp_path, server_url="http://127.0.0.1:8000")
        eligible = client.scan_eligible_files()
        eligible_names = [p.name for p in eligible]

        # Ineligible files must NOT be in eligible list
        assert "doc.pdf" not in eligible_names
        assert "image.png" not in eligible_names
        assert "data.json" not in eligible_names
        assert "script.py" not in eligible_names
        assert "README" not in eligible_names
        assert "nested.md" not in eligible_names

        # Only the 4 root md/txt files (plus .hidden.md if suffix matches)
        expected = sorted(["valid1.md", "valid2.txt", "VALID3.MD", "valid4.TXT", ".hidden.md"])
        assert sorted(eligible_names) == expected

    def test_sync_client_empty_and_nonexistent_directory(self, tmp_path: Path):
        """SyncClient handles empty and nonexistent watch directories gracefully."""
        # Empty directory
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        client = SyncClient(watch_dir=empty_dir, server_url="http://127.0.0.1:8000")
        assert client.scan_eligible_files() == []
        assert client.sync_once() == 0

        # Nonexistent directory
        nonexistent = tmp_path / "does_not_exist"
        client2 = SyncClient(watch_dir=nonexistent, server_url="http://127.0.0.1:8000")
        assert client2.scan_eligible_files() == []
        assert client2.sync_once() == 0

    def test_sync_client_addition_modification_and_hash_cache(self, tmp_path: Path):
        """Verify file addition, modification, and hash-cache elimination of redundant transfers."""
        doc_file = tmp_path / "guide.md"
        doc_file.write_bytes(b"# Initial Version\r\nFirst paragraph.\r\n")

        client = SyncClient(
            watch_dir=tmp_path,
            server_url="http://fake-server:8000",
            token="test-token-123",
        )

        mock_responses = [
            # Response for first addition
            {"id": 101, "filename": "guide.md", "action": "created", "sha256": "hash_v1"},
            # Response for modification
            {"id": 101, "filename": "guide.md", "action": "updated", "sha256": "hash_v2"},
        ]
        call_count = 0
        transmitted_payloads = []

        def mock_urlopen(req, timeout=10.0):
            nonlocal call_count
            payload = json.loads(req.data.decode("utf-8"))
            transmitted_payloads.append(payload)
            resp_data = mock_responses[min(call_count, len(mock_responses) - 1)]
            call_count += 1

            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(resp_data).encode("utf-8")
            mock_resp.__enter__.return_value = mock_resp
            mock_resp.__exit__.return_value = False
            return mock_resp

        with patch("urllib.request.urlopen", side_effect=mock_urlopen):
            # Pass 1: Addition of new file
            synced = client.sync_once()
            assert synced == 1
            assert call_count == 1
            # Verify client normalized CRLF before transmission
            assert "\r" not in transmitted_payloads[0]["content"]
            assert transmitted_payloads[0]["content"] == "# Initial Version\nFirst paragraph.\n"
            assert "guide.md" in client.hash_cache

            # Pass 2: Identical file unchanged -> hash cache MUST skip network call
            synced_pass2 = client.sync_once()
            assert synced_pass2 == 0
            assert call_count == 1, "Redundant network request was made for unchanged file!"

            # Pass 3: Modify file
            doc_file.write_bytes(b"# Modified Version\r\nSecond paragraph.\r\n")
            synced_pass3 = client.sync_once()
            assert synced_pass3 == 1
            assert call_count == 2
            assert transmitted_payloads[1]["content"] == "# Modified Version\nSecond paragraph.\n"

    def test_sync_client_deletion_behavior_and_cache_state(self, tmp_path: Path):
        """Empirically observe cache state when a file is deleted locally."""
        file1 = tmp_path / "temp.md"
        file1.write_text("# Temporary", encoding="utf-8")

        client = SyncClient(watch_dir=tmp_path, server_url="http://fake-server:8000", token="tok")

        def mock_urlopen(req, timeout=10.0):
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps({"id": 1, "action": "created"}).encode("utf-8")
            mock_resp.__enter__.return_value = mock_resp
            mock_resp.__exit__.return_value = False
            return mock_resp

        with patch("urllib.request.urlopen", side_effect=mock_urlopen):
            # Initial sync
            client.sync_once()
            assert "temp.md" in client.hash_cache

            # Delete file locally
            file1.unlink()
            assert not file1.exists()

            # Next sync pass: file is absent, 0 synced, does not crash
            synced = client.sync_once()
            assert synced == 0
            # Documented empirical finding: hash_cache retains 'temp.md'
            assert "temp.md" in client.hash_cache

    def test_sync_client_watch_loop_with_controlled_cancellation(self, tmp_path: Path):
        """Verify SyncClient.watch runs iterations and terminates cleanly on KeyboardInterrupt."""
        (tmp_path / "doc.md").write_text("# Content", encoding="utf-8")

        client = SyncClient(
            watch_dir=tmp_path,
            server_url="http://fake-server:8000",
            token="token",
            interval=0.01,
        )

        loop_iterations = 0

        def fake_sync_once():
            nonlocal loop_iterations
            loop_iterations += 1
            if loop_iterations >= 3:
                raise KeyboardInterrupt()
            return 1

        client.sync_once = fake_sync_once
        # watch() catches KeyboardInterrupt and returns cleanly
        client.watch()
        assert loop_iterations >= 3

    def test_sync_client_cli_parser_options(self):
        """Verify CLI argument parser correctly configures --once and --watch."""
        parser = build_parser()

        # Default options
        args_default = parser.parse_args([])
        assert args_default.once is True
        assert args_default.watch is False
        assert args_default.dir == "doc_review_app/local_documents"
        assert args_default.server == "http://127.0.0.1:8095"

        # Explicit --watch option
        args_watch = parser.parse_args(["--watch", "--interval", "2.5", "--dir", "my_docs"])
        assert args_watch.watch is True
        assert args_watch.interval == 2.5
        assert args_watch.dir == "my_docs"

        # Explicit --once option
        args_once = parser.parse_args(["--once"])
        assert args_once.once is True
        assert args_once.watch is False

    def test_sync_client_http_errors_graceful(self, tmp_path: Path):
        """Verify sync_file gracefully handles HTTP 401, 400, and 500 without crashing."""
        file_path = tmp_path / "error_test.md"
        file_path.write_text("# Error Test", encoding="utf-8")

        client = SyncClient(watch_dir=tmp_path, server_url="http://fake:8000", token="bad_token")

        for error_code in (401, 400, 500):
            def mock_urlopen_err(req, timeout=10.0, code=error_code):
                fp = MagicMock()
                raise urllib.error.HTTPError("http://fake/api/documents/sync", code, f"Error {code}", {}, fp)

            with patch("urllib.request.urlopen", side_effect=mock_urlopen_err):
                result = client.sync_file(file_path)
                assert result is None, f"Expected None on HTTP {error_code}"
                # Ensure hash cache was NOT updated so retry happens next time
                assert "error_test.md" not in client.hash_cache

    def test_sync_client_server_offline_graceful(self, tmp_path: Path):
        """Verify sync_file handles offline server (URLError) without unhandled exceptions."""
        file_path = tmp_path / "offline.md"
        file_path.write_text("# Offline", encoding="utf-8")

        client = SyncClient(watch_dir=tmp_path, server_url="http://127.0.0.1:54321", token="tok")

        def mock_urlopen_down(req, timeout=10.0):
            raise urllib.error.URLError("Connection refused")

        with patch("urllib.request.urlopen", side_effect=mock_urlopen_down):
            result = client.sync_file(file_path)
            assert result is None
            assert "offline.md" not in client.hash_cache
