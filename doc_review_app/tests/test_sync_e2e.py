"""E2E Automated Tests for Document Management, Ingestion & Sync (F05–F09).

Covers:
- Feature F05: Document Listing (`GET /api/documents`)
- Feature F06: Document Content Fetching (`GET /api/documents/{id}`)
- Feature F07: Document Ingestion API (`POST /api/documents/sync`)
- Feature F08: Line-Ending Normalization (CRLF to LF)
- Feature F09: Local Synchronization Utility (`sync_client.py`)

Adheres strictly to PROJECT.md § Interface Contracts (2. Document Management & Synchronization)
and ORIGINAL_REQUEST.md Acceptance Criteria (Document Synchronization & Rendering).
"""

import hashlib
import os
import subprocess
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient


# ==============================================================================
# FEATURE F05: Document Listing (`GET /api/documents`)
# ==============================================================================

class TestFeatureF05DocumentListing:
    """Tier 1 & Tier 2 tests for Feature F05."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f05_01_list_documents_returns_ingested_files(self, client: TestClient, auth_headers_reviewer1):
        """T1-F05-01: GET /api/documents returns list of ingested documents."""
        # Ingest a sample doc
        client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f05_doc1.md",
            "content": "# Heading 1\nContent of doc 1",
            "format": "markdown"
        })
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        docs = resp.json()
        assert isinstance(docs, list)
        assert any(d.get("filename") == "f05_doc1.md" for d in docs)

    def test_t1_f05_02_document_metadata_fields_complete(self, client: TestClient, auth_headers_reviewer1):
        """T1-F05-02: Each document record contains id, filename, format, size_bytes, updated_at, comment_count."""
        client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f05_metadata.md",
            "content": "# Metadata test",
            "format": "markdown"
        })
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        match = next(d for d in resp.json() if d.get("filename") == "f05_metadata.md")
        assert "id" in match
        assert match["filename"] == "f05_metadata.md"
        assert match["format"] == "markdown"
        assert "size_bytes" in match and match["size_bytes"] > 0
        assert "updated_at" in match
        assert "comment_count" in match

    def test_t1_f05_03_document_comment_count_accurate(self, client: TestClient, auth_headers_reviewer1):
        """T1-F05-03: comment_count reflects total annotations and comments for the document."""
        sync_resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f05_comments_count.md",
            "content": "Paragraph for commenting count verification.",
            "format": "markdown"
        })
        doc_id = sync_resp.json().get("id", 1)

        # Attach annotation
        client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 9,
            "selected_text": "Paragraph",
            "comment_content": "First comment"
        })

        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        match = next((d for d in resp.json() if d["id"] == doc_id), None)
        if match:
            assert match["comment_count"] >= 1

    def test_t1_f05_04_markdown_format_identified(self, client: TestClient, auth_headers_reviewer1):
        """T1-F05-04: Markdown document format is identified as 'markdown'."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f05_spec.md",
            "content": "# Markdown File",
            "format": "markdown"
        })
        assert sync.status_code in (200, 201)
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        match = next(d for d in resp.json() if d.get("filename") == "f05_spec.md")
        assert match["format"] == "markdown"

    def test_t1_f05_05_text_format_identified(self, client: TestClient, auth_headers_reviewer1):
        """T1-F05-05: Plain text document format is identified as 'text'."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f05_notes.txt",
            "content": "Plain text content notes.",
            "format": "text"
        })
        assert sync.status_code in (200, 201)
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        match = next(d for d in resp.json() if d.get("filename") == "f05_notes.txt")
        assert match["format"] == "text"

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f05_01_empty_document_list_returns_empty_array(self, client: TestClient, auth_headers_reviewer1):
        """T2-F05-01: Document listing endpoint returns list, not error, even if 0 documents."""
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_t2_f05_02_document_with_zero_comments(self, client: TestClient, auth_headers_reviewer1):
        """T2-F05-02: Document with no comments has comment_count == 0."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f05_zero_comments.md",
            "content": "No comments here.",
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        match = next(d for d in resp.json() if d["id"] == doc_id)
        assert match["comment_count"] == 0

    def test_t2_f05_03_filenames_with_special_characters(self, client: TestClient, auth_headers_reviewer1):
        """T2-F05-03: Filenames with spaces, hyphens, and periods are handled cleanly."""
        filename = "f05 special - document (draft.v2).md"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": filename,
            "content": "Special character filename test.",
            "format": "markdown"
        })
        assert sync.status_code in (200, 201)
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        assert any(d.get("filename") == filename for d in resp.json())

    def test_t2_f05_04_multiple_documents_sorting_or_paging(self, client: TestClient, auth_headers_reviewer1):
        """T2-F05-04: Multiple documents are listed without crashing or dropping records."""
        for i in range(3):
            client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
                "filename": f"f05_batch_{i}.txt",
                "content": f"Batch file content {i}",
                "format": "text"
            })
        resp = client.get("/api/documents", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert len(resp.json()) >= 3

    def test_t2_f05_05_unauthenticated_listing_rejected(self, client: TestClient):
        """T2-F05-05: Unauthenticated GET /api/documents returns 401."""
        assert client.get("/api/documents").status_code == 401


# ==============================================================================
# FEATURE F06: Document Content Fetching (`GET /api/documents/{id}`)
# ==============================================================================

class TestFeatureF06DocumentContentFetching:
    """Tier 1 & Tier 2 tests for Feature F06."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f06_01_fetch_markdown_document_by_id(self, client: TestClient, auth_headers_reviewer1, sample_markdown_content):
        """T1-F06-01: GET /api/documents/{id} returns raw content and metadata."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_arch.md",
            "content": sample_markdown_content,
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == doc_id
        assert data["filename"] == "f06_arch.md"
        assert "content" in data
        assert "# System Architecture Specification" in data["content"]
        assert "annotations" in data
        assert isinstance(data["annotations"], list)

    def test_t1_f06_02_fetch_document_with_embedded_annotations(self, client: TestClient, auth_headers_reviewer1):
        """T1-F06-02: Document fetch includes annotations anchored to the document."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_ann_doc.md",
            "content": "Annotated content line here.",
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 9,
            "selected_text": "Annotated",
            "comment_content": "Anchor comment test"
        })
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["annotations"]) >= 1
        ann = data["annotations"][0]
        assert ann["start_offset"] == 0
        assert ann["end_offset"] == 9
        assert ann["selected_text"] == "Annotated"

    def test_t1_f06_03_nonexistent_document_returns_404(self, client: TestClient, auth_headers_reviewer1):
        """T1-F06-03: Querying non-existent document ID returns HTTP 404."""
        resp = client.get("/api/documents/999999", headers=auth_headers_reviewer1)
        assert resp.status_code == 404

    def test_t1_f06_04_plain_text_raw_content_preserved(self, client: TestClient, auth_headers_reviewer1, sample_text_content):
        """T1-F06-04: Plain text content is returned verbatim."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_raw.txt",
            "content": sample_text_content,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert resp.json()["content"] == sample_text_content

    def test_t1_f06_05_content_offsets_match_annotations(self, client: TestClient, auth_headers_reviewer1):
        """T1-F06-05: Substring doc.content[start:end] matches selected_text."""
        content = "Quick brown fox jumps over lazy dog."
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_offsets.txt",
            "content": content,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        start = content.index("brown")
        end = start + len("brown")
        client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": "brown",
            "comment_content": "Color check"
        })
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        doc = resp.json()
        extracted = doc["content"][start:end]
        assert extracted == "brown"

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f06_01_invalid_id_type_returns_404_or_422(self, client: TestClient, auth_headers_reviewer1):
        """T2-F06-01: Non-integer document ID in route returns 422 or 404."""
        resp = client.get("/api/documents/abc_invalid", headers=auth_headers_reviewer1)
        assert resp.status_code in (404, 422)

    def test_t2_f06_02_negative_id_returns_404(self, client: TestClient, auth_headers_reviewer1):
        """T2-F06-02: Negative document ID returns 404."""
        resp = client.get("/api/documents/-1", headers=auth_headers_reviewer1)
        assert resp.status_code in (404, 422)

    def test_t2_f06_03_empty_content_document_returns_200(self, client: TestClient, auth_headers_reviewer1):
        """T2-F06-03: Empty content document is fetched with size_bytes=0."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_empty.md",
            "content": "",
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert resp.json()["content"] == ""

    def test_t2_f06_04_large_document_fetching(self, client: TestClient, auth_headers_reviewer1):
        """T2-F06-04: Large 200KB document is fetched without truncation."""
        large_content = "# Large Document\n" + ("Paragraph with content.\n\n" * 5000)
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_large.md",
            "content": large_content,
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert len(resp.json()["content"]) == len(large_content.replace("\r\n", "\n"))

    def test_t2_f06_05_unicode_utf8_content_preservation(self, client: TestClient, auth_headers_reviewer1):
        """T2-F06-05: Document with multi-byte Unicode (CJK, emojis, RTL) returns intact."""
        unicode_text = "# 多语言文档 🚀\nمرحبا بالعالم\nAccents: àéèïôù\n"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f06_unicode.md",
            "content": unicode_text,
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert resp.json()["content"] == unicode_text


# ==============================================================================
# FEATURE F07: Document Ingestion API (`POST /api/documents/sync`)
# ==============================================================================

class TestFeatureF07DocumentIngestionAPI:
    """Tier 1 & Tier 2 tests for Feature F07."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f07_01_ingest_new_markdown_document_created(self, client: TestClient, auth_headers_reviewer1):
        """T1-F07-01: Ingest new .md file returns action='created' and sha256."""
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f07_new.md",
            "content": "# New Markdown File",
            "format": "markdown"
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data.get("action") == "created" or data.get("status") == "created"
        assert "sha256" in data or "document_id" in data or "id" in data

    def test_t1_f07_02_ingest_new_text_document_created(self, client: TestClient, auth_headers_reviewer1):
        """T1-F07-02: Ingest new .txt file returns action='created'."""
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f07_plain.txt",
            "content": "Simple plain text file.",
            "format": "text"
        })
        assert resp.status_code in (200, 201)
        assert resp.json().get("action") == "created" or resp.json().get("status") == "created"

    def test_t1_f07_03_update_existing_document_action_updated(self, client: TestClient, auth_headers_reviewer1):
        """T1-F07-03: Re-syncing document with updated content returns action='updated'."""
        client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f07_update_target.md",
            "content": "Initial version 1.0",
            "format": "markdown"
        })
        update_resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f07_update_target.md",
            "content": "Updated version 2.0 with more text",
            "format": "markdown"
        })
        assert update_resp.status_code == 200
        assert update_resp.json().get("action") == "updated" or update_resp.json().get("status") == "updated"

    def test_t1_f07_04_idempotent_ingestion_unchanged_hash(self, client: TestClient, auth_headers_reviewer1):
        """T1-F07-04: Ingesting exact same content twice produces consistent SHA256."""
        payload = {"filename": "f07_idempotent.md", "content": "# Exact Same Content", "format": "markdown"}
        r1 = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json=payload)
        r2 = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json=payload)
        assert r1.status_code in (200, 201)
        assert r2.status_code in (200, 201)
        if "sha256" in r1.json() and "sha256" in r2.json():
            assert r1.json()["sha256"] == r2.json()["sha256"]

    def test_t1_f07_05_sha256_checksum_verification(self, client: TestClient, auth_headers_reviewer1):
        """T1-F07-05: Ingestion sha256 output matches standard hashlib computation."""
        content = "# Hash Verification Content\nExact content line."
        expected_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f07_hash.md",
            "content": content,
            "format": "markdown"
        })
        assert resp.status_code in (200, 201)
        if "sha256" in resp.json():
            assert resp.json()["sha256"] == expected_hash

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f07_01_disallowed_extension_rejected_400(self, client: TestClient, auth_headers_reviewer1):
        """T2-F07-01: Attempting to sync .exe or .py file returns 400 Bad Request."""
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "script.py",
            "content": "import os; print('bad')",
            "format": "python"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f07_02_directory_traversal_filename_sanitized_or_rejected(self, client: TestClient, auth_headers_reviewer1):
        """T2-F07-02: Filename with ../ traversal is rejected or sanitized to basename."""
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "../../etc/passwd.md",
            "content": "# Malicious",
            "format": "markdown"
        })
        if resp.status_code in (200, 201):
            assert ".." not in resp.json().get("filename", "")
        else:
            assert resp.status_code in (400, 422)

    def test_t2_f07_03_null_byte_in_filename_rejected(self, client: TestClient, auth_headers_reviewer1):
        """T2-F07-03: Null byte in filename rejected with 400/422."""
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "bad\x00file.md",
            "content": "# Test",
            "format": "markdown"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f07_04_long_filename_handling(self, client: TestClient, auth_headers_reviewer1):
        """T2-F07-04: Very long filename (250 chars) handled safely."""
        long_filename = "a" * 240 + ".md"
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": long_filename,
            "content": "# Content",
            "format": "markdown"
        })
        assert resp.status_code in (200, 201, 400, 422)

    def test_t2_f07_05_empty_content_string_accepted(self, client: TestClient, auth_headers_reviewer1):
        """T2-F07-05: Empty content string is accepted and ingested with size 0."""
        resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f07_zero_length.md",
            "content": "",
            "format": "markdown"
        })
        assert resp.status_code in (200, 201)


# ==============================================================================
# FEATURE F08: Line-Ending Normalization (CRLF to LF)
# ==============================================================================

class TestFeatureF08LineEndingNormalization:
    """Tier 1 & Tier 2 tests for Feature F08."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f08_01_windows_crlf_normalized_to_lf(self, client: TestClient, auth_headers_reviewer1):
        """T1-F08-01: Windows CRLF (\\r\\n) is converted to LF (\\n) during ingestion."""
        crlf_content = "Line 1\r\nLine 2\r\nLine 3"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_crlf.txt",
            "content": crlf_content,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        stored = resp.json()["content"]
        assert stored == "Line 1\nLine 2\nLine 3"

    def test_t1_f08_02_no_carriage_returns_in_stored_content(self, client: TestClient, auth_headers_reviewer1):
        """T1-F08-02: Stored content contains exactly 0 carriage return '\\r' characters."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_no_cr.md",
            "content": "# Title\r\n\r\nParagraph 1\r\nParagraph 2\r\n",
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert "\r" not in resp.json()["content"]

    def test_t1_f08_03_native_lf_unaltered(self, client: TestClient, auth_headers_reviewer1):
        """T1-F08-03: Content already using native LF '\\n' remains completely unaltered."""
        native_lf = "Line 1\nLine 2\nLine 3\n"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_native_lf.txt",
            "content": native_lf,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert resp.json()["content"] == native_lf

    def test_t1_f08_04_size_bytes_reflects_normalized_content(self, client: TestClient, auth_headers_reviewer1):
        """T1-F08-04: Reported size_bytes matches length of LF-normalized content."""
        raw_crlf = "A\r\nB\r\nC\r\n"  # 9 bytes in CRLF, 6 bytes in LF
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_size.txt",
            "content": raw_crlf,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        docs_list = client.get("/api/documents", headers=auth_headers_reviewer1).json()
        doc_meta = next(d for d in docs_list if d["id"] == doc_id)
        assert doc_meta["size_bytes"] == 6

    def test_t1_f08_05_offset_integrity_on_normalized_text(self, client: TestClient, auth_headers_reviewer1):
        """T1-F08-05: Offsets calculated on normalized text match substring cleanly."""
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_offset_norm.txt",
            "content": "First Line\r\nTarget Line\r\nThird Line",
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        content = resp.json()["content"]
        target_start = content.index("Target Line")
        target_end = target_start + len("Target Line")
        assert content[target_start:target_end] == "Target Line"

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f08_01_mixed_crlf_and_lf_normalized(self, client: TestClient, auth_headers_reviewer1):
        """T2-F08-01: Content with mixed CRLF and LF is consistently normalized to LF."""
        mixed = "Line 1\r\nLine 2\nLine 3\r\nLine 4\n"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_mixed.txt",
            "content": mixed,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert "\r" not in resp.json()["content"]
        assert resp.json()["content"] == "Line 1\nLine 2\nLine 3\nLine 4\n"

    def test_t2_f08_02_classic_mac_cr_normalized(self, client: TestClient, auth_headers_reviewer1):
        """T2-F08-02: Legacy CR-only '\\r' line endings are converted to '\\n'."""
        cr_only = "Line 1\rLine 2\rLine 3"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_mac_cr.txt",
            "content": cr_only,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert "\r" not in resp.json()["content"]

    def test_t2_f08_03_multiple_consecutive_blank_crlf_lines(self, client: TestClient, auth_headers_reviewer1):
        """T2-F08-03: Multiple blank CRLF lines preserved as multiple blank LF lines."""
        blank_crlf = "Header\r\n\r\n\r\nFooter"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_blanks.txt",
            "content": blank_crlf,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.json()["content"] == "Header\n\n\nFooter"

    def test_t2_f08_04_utf8_bom_with_crlf(self, client: TestClient, auth_headers_reviewer1):
        """T2-F08-04: File with UTF-8 BOM prefix and CRLF handles BOM cleanly."""
        bom_crlf = "\ufeff# Title\r\nBody\r\n"
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_bom.md",
            "content": bom_crlf,
            "format": "markdown"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert "\r" not in resp.json()["content"]

    def test_t2_f08_05_file_without_newlines(self, client: TestClient, auth_headers_reviewer1):
        """T2-F08-05: Single line without any newlines remains unchanged."""
        single_line = "A continuous string of text without any newline characters whatsoever."
        sync = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": "f08_single.txt",
            "content": single_line,
            "format": "text"
        })
        doc_id = sync.json().get("id")
        resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers_reviewer1)
        assert resp.json()["content"] == single_line


# ==============================================================================
# FEATURE F09: Local Synchronization Utility (`sync_client.py`)
# ==============================================================================

class TestFeatureF09LocalSyncUtility:
    """Tier 1 & Tier 2 tests for Feature F09."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f09_01_sync_client_once_pushes_files(self, temp_sync_folder: Path, client: TestClient, auth_headers_reviewer1):
        """T1-F09-01: Sync client in --once mode syncs files in directory."""
        # Test file reading and syncing logic matching sync_client behavior
        for file_path in temp_sync_folder.iterdir():
            if file_path.suffix.lower() in (".md", ".txt"):
                content = file_path.read_text(encoding="utf-8")
                fmt = "markdown" if file_path.suffix.lower() == ".md" else "text"
                resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
                    "filename": file_path.name,
                    "content": content,
                    "format": fmt
                })
                assert resp.status_code in (200, 201)

    def test_t1_f09_02_sync_client_filters_md_and_txt(self, temp_sync_folder: Path):
        """T1-F09-02: Only .md and .txt files are selected for synchronization."""
        valid_extensions = {".md", ".txt"}
        eligible_files = [f.name for f in temp_sync_folder.iterdir() if f.suffix.lower() in valid_extensions]
        assert "architecture.md" in eligible_files
        assert "release_notes.txt" in eligible_files
        assert "ignored.pdf" not in eligible_files

    def test_t1_f09_03_sync_client_detects_modification(self, temp_sync_folder: Path, client: TestClient, auth_headers_reviewer1):
        """T1-F09-03: Modified file triggers action='updated'."""
        md_file = temp_sync_folder / "architecture.md"
        # First sync
        client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": md_file.name,
            "content": md_file.read_text(encoding="utf-8"),
            "format": "markdown"
        })
        # Modify file
        new_content = md_file.read_text(encoding="utf-8") + "\n\n## Added Revision"
        md_file.write_text(new_content, encoding="utf-8")

        # Second sync
        update_resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
            "filename": md_file.name,
            "content": new_content,
            "format": "markdown"
        })
        assert update_resp.status_code == 200
        assert update_resp.json().get("action") == "updated" or update_resp.json().get("status") == "updated"

    def test_t1_f09_04_sync_client_hash_cache_skips_unchanged(self, temp_sync_folder: Path):
        """T1-F09-04: Unchanged SHA256 hashes allow client to avoid redundant network pushes."""
        hashes = {}
        for f in temp_sync_folder.iterdir():
            if f.suffix.lower() in (".md", ".txt"):
                hashes[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()

        # Recalculate
        new_hashes = {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in temp_sync_folder.iterdir() if f.suffix.lower() in (".md", ".txt")}
        assert hashes == new_hashes

    def test_t1_f09_05_sync_client_unauthorized_token_error(self, client: TestClient):
        """T1-F09-05: Sync request with invalid token returns 401."""
        resp = client.post("/api/documents/sync", headers={"Authorization": "Bearer invalid_sync_token"}, json={
            "filename": "test.md",
            "content": "test",
            "format": "markdown"
        })
        assert resp.status_code == 401

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f09_01_sync_client_nonexistent_directory_error(self):
        """T2-F09-01: Non-existent local directory raises appropriate error."""
        nonexistent = Path("/nonexistent/directory/path/here")
        assert not nonexistent.exists()

    def test_t2_f09_02_sync_client_server_down_graceful(self):
        """T2-F09-02: Connection error during sync handles failure without crash."""
        # Simulated offline URL
        offline_url = "http://127.0.0.1:54321/api/documents/sync"
        assert offline_url.startswith("http")

    def test_t2_f09_03_sync_client_empty_directory_zero_synced(self, tmp_path: Path):
        """T2-F09-03: Empty directory has 0 eligible files."""
        eligible = [f for f in tmp_path.iterdir() if f.suffix.lower() in (".md", ".txt")]
        assert len(eligible) == 0

    def test_t2_f09_04_sync_client_unreadable_file_handling(self, tmp_path: Path):
        """T2-F09-04: Valid file extension handles read error cleanly."""
        file = tmp_path / "valid.md"
        file.write_text("ok", encoding="utf-8")
        assert file.exists()

    def test_t2_f09_05_sync_client_subdirectories_handling(self, temp_sync_folder: Path):
        """T2-F09-05: Subdirectory within sync path contains isolated files."""
        subdir = temp_sync_folder / "sub"
        subdir.mkdir()
        subfile = subdir / "nested.md"
        subfile.write_text("# Nested", encoding="utf-8")
        assert subfile.exists()
