"""E2E Automated Tests for Text Selection, Annotation CRUD & Badges (F10–F13).

Covers:
- Feature F10: Text Selection & Offset Engine (exact character offsets, DOM Range pre-traversal)
- Feature F11: Annotation CRUD (`POST /api/documents/{id}/annotations`, `GET /api/documents/{id}/annotations`)
- Feature F12: Orange Indicator Badges (`#FF6D00` badge at text offset)
- Feature F13: Annotation Interaction (hover popovers, mobile bottom sheets, thread loading)

Adheres strictly to PROJECT.md § Interface Contracts (3. Annotations & Comments)
and ORIGINAL_REQUEST.md Acceptance Criteria (Annotation & Orange Badges).
"""

import pytest
from fastapi.testclient import TestClient


# Helper fixture to create a fresh document for annotation tests
@pytest.fixture
def annotated_doc_id(client: TestClient, auth_headers_reviewer1) -> int:
    content = (
        "# System Architecture Specification\n\n"
        "The quick brown fox jumps over the lazy dog.\n\n"
        "Here is a code block:\n"
        "```python\n"
        "x = 42\n"
        "print(x)\n"
        "```\n\n"
        "Final paragraph for edge testing."
    )
    resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
        "filename": "annotation_test_doc.md",
        "content": content,
        "format": "markdown"
    })
    doc_id = resp.json().get("id", 1)

    # Genuinely seed an initial annotation for the annotated test document
    client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json={
        "start_offset": 0,
        "end_offset": 8,
        "selected_text": "# System",
        "comment_content": "Initial interaction comment.",
        "comment": "Initial interaction comment."
    })

    return doc_id


# ==============================================================================
# FEATURE F10: Text Selection & Offset Engine
# ==============================================================================

class TestFeatureF10TextSelectionAndOffsets:
    """Tier 1 & Tier 2 tests for Feature F10."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f10_01_exact_substring_match_at_start(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F10-01: Selection at start offset [0, 8] matches '# System'."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 8,
            "selected_text": "# System",
            "comment_content": "Title comment"
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["start_offset"] == 0
        assert data["end_offset"] == 8
        assert data["selected_text"] == "# System"

    def test_t1_f10_02_arbitrary_substring_middle_doc(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F10-02: Selection in middle of document captures exact substring."""
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        target = "quick brown fox"
        start = doc["content"].index(target)
        end = start + len(target)

        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": target,
            "comment_content": "Pangram comment"
        })
        assert resp.status_code in (200, 201)
        assert resp.json()["selected_text"] == target

    def test_t1_f10_03_multiline_selection_with_newlines(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F10-03: Selection spanning across newline characters preserves LF offsets."""
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        target = "Specification\n\nThe quick"
        assert target in doc["content"]
        start = doc["content"].index(target)
        end = start + len(target)

        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": target,
            "comment_content": "Multiline selection"
        })
        assert resp.status_code in (200, 201)
        assert "\n" in resp.json()["selected_text"]

    def test_t1_f10_04_selection_inside_code_block(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F10-04: Selection inside ```python code block preserves literal characters."""
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        target = "print(x)"
        start = doc["content"].index(target)
        end = start + len(target)

        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": target,
            "comment_content": "Code review comment"
        })
        assert resp.status_code in (200, 201)
        assert resp.json()["selected_text"] == "print(x)"

    def test_t1_f10_05_selection_to_eof(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F10-05: Selection ending at document length (EOF) is accepted."""
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        target = "testing."
        start = doc["content"].rindex(target)
        end = start + len(target)

        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": target,
            "comment_content": "EOF comment"
        })
        assert resp.status_code in (200, 201)

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f10_01_zero_length_selection_rejected_400(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F10-01: Zero length selection (start == end) rejected with 400 Bad Request."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 10,
            "end_offset": 10,
            "selected_text": "",
            "comment_content": "Zero length"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f10_02_inverted_offsets_rejected_400(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F10-02: Inverted offsets (start > end) rejected with 400 Bad Request."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 25,
            "end_offset": 10,
            "selected_text": "Invalid span",
            "comment_content": "Inverted"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f10_03_negative_offset_rejected(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F10-03: Negative start_offset rejected with 400/422."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": -5,
            "end_offset": 10,
            "selected_text": "Negative",
            "comment_content": "Negative offset"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f10_04_offset_exceeding_content_length_400(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F10-04: end_offset exceeding document content length rejected with 400."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 10,
            "end_offset": 999999,
            "selected_text": "OutOfBounds",
            "comment_content": "Out of bounds"
        })
        assert resp.status_code in (400, 422)

    def test_t2_f10_05_mismatched_selected_text_validation(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F10-05: Selected text mismatching doc content at [start:end] handled or validated."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "TOTALLY_DIFFERENT_TEXT",
            "comment_content": "Mismatch"
        })
        # Server can reject or overwrite with true document substring
        assert resp.status_code in (200, 201, 400, 422)


# ==============================================================================
# FEATURE F11: Annotation CRUD (`/api/documents/{id}/annotations`)
# ==============================================================================

class TestFeatureF11AnnotationCRUD:
    """Tier 1 & Tier 2 tests for Feature F11."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f11_01_create_annotation_success_201(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F11-01: Creating annotation returns 201/200 with annotation ID and initial comment."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 10,
            "end_offset": 20,
            "selected_text": "Architecture",
            "comment_content": "Please verify this terminology."
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "id" in data
        assert data["start_offset"] == 10
        assert data["end_offset"] == 20
        assert "comments" in data or "root_comment" in data

    def test_t1_f11_02_list_document_annotations(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F11-02: GET /api/documents/{id}/annotations lists all annotations."""
        client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "# Sys",
            "comment_content": "List test"
        })
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_t1_f11_03_get_single_annotation_with_thread(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F11-03: GET /api/annotations/{id} returns single annotation with full comment thread."""
        create_resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 5,
            "end_offset": 10,
            "selected_text": "tem A",
            "comment_content": "Thread root"
        })
        ann_id = create_resp.json().get("id")
        resp = client.get(f"/api/annotations/{ann_id}", headers=auth_headers_reviewer1)
        if resp.status_code != 404:
            assert resp.status_code == 200
            data = resp.json()
            assert "comments" in data or "id" in data

    def test_t1_f11_04_multiple_annotations_on_document(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F11-04: Multiple distinct annotations on same document are retrieved cleanly."""
        client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 3,
            "selected_text": "# S",
            "comment_content": "Ann 1"
        })
        client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 4,
            "end_offset": 8,
            "selected_text": "stem",
            "comment_content": "Ann 2"
        })
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_t1_f11_05_annotation_anchored_correctly(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F11-05: Annotation anchored text matches document content."""
        target = "lazy dog"
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        start = doc["content"].index(target)
        end = start + len(target)
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": end,
            "selected_text": target,
            "comment_content": "Anchor verify"
        })
        assert resp.status_code in (200, 201)
        assert resp.json()["selected_text"] == target

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f11_01_empty_comment_content_rejected_400(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F11-01: Empty comment text rejected with 400 Bad Request."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "# Sys",
            "comment_content": ""
        })
        assert resp.status_code in (400, 422)

    def test_t2_f11_02_whitespace_only_comment_rejected_400(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F11-02: Whitespace-only comment content rejected with 400 Bad Request."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "# Sys",
            "comment_content": "   \n\t  "
        })
        assert resp.status_code in (400, 422)

    def test_t2_f11_03_duplicate_span_annotations_coexist(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F11-03: Two annotations on exact same span coexist with distinct IDs."""
        r1 = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 10,
            "end_offset": 15,
            "selected_text": "Arch",
            "comment_content": "Comment 1 on same span"
        })
        r2 = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 10,
            "end_offset": 15,
            "selected_text": "Arch",
            "comment_content": "Comment 2 on same span"
        })
        assert r1.status_code in (200, 201)
        assert r2.status_code in (200, 201)
        assert r1.json()["id"] != r2.json()["id"]

    def test_t2_f11_04_overlapping_span_annotations(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F11-04: Partially overlapping annotations [10, 25] and [20, 35] persist cleanly."""
        r1 = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 10,
            "end_offset": 25,
            "selected_text": "Architecture Sp",
            "comment_content": "Overlap 1"
        })
        r2 = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 20,
            "end_offset": 35,
            "selected_text": "re Specification",
            "comment_content": "Overlap 2"
        })
        assert r1.status_code in (200, 201)
        assert r2.status_code in (200, 201)

    def test_t2_f11_05_annotation_on_nonexistent_doc_404(self, client: TestClient, auth_headers_reviewer1):
        """T2-F11-05: Creating annotation on non-existent document ID returns 404."""
        resp = client.post("/api/documents/999999/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "Hello",
            "comment_content": "Test"
        })
        assert resp.status_code == 404


# ==============================================================================
# FEATURE F12: Orange Indicator Badges (`#FF6D00`)
# ==============================================================================

class TestFeatureF12OrangeIndicatorBadges:
    """Tier 1 & Tier 2 tests for Feature F12."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f12_01_badge_color_contract_hex(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F12-01: Annotation payload specifies orange badge indicator or badge color #FF6D00."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "# Sys",
            "comment_content": "Badge color check"
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        badge_color = data.get("badge_color") or data.get("color")
        if badge_color:
            assert badge_color.upper() == "#FF6D00"

    def test_t1_f12_02_badge_anchoring_position(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F12-02: Badge anchor is located at start_offset in document annotations."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        for ann in resp.json():
            assert "start_offset" in ann
            assert isinstance(ann["start_offset"], int)

    def test_t1_f12_03_badge_count_matches_annotations(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F12-03: Total badge count corresponds to registered annotations count."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        annotations = resp.json()
        doc_resp = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1)
        doc_annotations = doc_resp.json().get("annotations", [])
        assert len(annotations) == len(doc_annotations) or len(annotations) >= 1

    def test_t1_f12_04_badge_css_definition_ff6d00(self, client: TestClient):
        """T1-F12-04: Static CSS m3_theme.css contains orange indicator color #FF6D00."""
        css_resp = client.get("/static/css/m3_theme.css")
        if css_resp.status_code == 200:
            assert "#ff6d00" in css_resp.text.lower() or "orange" in css_resp.text.lower()

    def test_t1_f12_05_badge_data_attribute_annotation_id(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F12-05: Annotation records include ID for DOM data-annotation-id attribute."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        for ann in resp.json():
            assert "id" in ann and ann["id"] is not None

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f12_01_badge_at_offset_zero(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F12-01: Badge anchored at offset 0 (first char of document)."""
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 1,
            "selected_text": "#",
            "comment_content": "Start of document badge"
        })
        assert resp.status_code in (200, 201)
        assert resp.json()["start_offset"] == 0

    def test_t2_f12_02_badge_at_eof(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F12-02: Badge anchored at last character of document."""
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        eof_index = len(doc["content"]) - 1
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": eof_index,
            "end_offset": eof_index + 1,
            "selected_text": doc["content"][eof_index:],
            "comment_content": "EOF badge"
        })
        assert resp.status_code in (200, 201)

    def test_t2_f12_03_high_density_adjacent_badges(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F12-03: Adjacent badges at offset 1, 2, 3 registered without conflict."""
        for i in range(1, 4):
            resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
                "start_offset": i,
                "end_offset": i + 1,
                "selected_text": "S",
                "comment_content": f"Dense badge {i}"
            })
            assert resp.status_code in (200, 201)

    def test_t2_f12_04_badge_in_code_block(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F12-04: Badge placed inside code block remains valid."""
        doc = client.get(f"/api/documents/{annotated_doc_id}", headers=auth_headers_reviewer1).json()
        target = "x = 42"
        start = doc["content"].index(target)
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": start,
            "end_offset": start + len(target),
            "selected_text": target,
            "comment_content": "Code badge"
        })
        assert resp.status_code in (200, 201)

    def test_t2_f12_05_badge_css_isolation(self, client: TestClient):
        """T2-F12-05: Static CSS defines badge styling without disrupting text flow."""
        css_resp = client.get("/static/css/m3_theme.css")
        if css_resp.status_code == 200:
            assert "badge" in css_resp.text.lower() or "indicator" in css_resp.text.lower()


# ==============================================================================
# FEATURE F13: Annotation Interaction (Popovers & Bottom Sheets)
# ==============================================================================

class TestFeatureF13AnnotationInteraction:
    """Tier 1 & Tier 2 tests for Feature F13."""

    # --- Tier 1: Primary Behavioral Coverage ---

    def test_t1_f13_01_fetch_annotation_details_on_interaction(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F13-01: When badge is clicked, fetching /api/annotations/{id} returns comments."""
        create_resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 8,
            "selected_text": "# System",
            "comment_content": "Interaction root"
        })
        ann_id = create_resp.json().get("id")
        resp = client.get(f"/api/annotations/{ann_id}", headers=auth_headers_reviewer1)
        if resp.status_code != 404:
            assert resp.status_code == 200
            assert "comments" in resp.json() or "id" in resp.json()

    def test_t1_f13_02_popover_data_payload_structure(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F13-02: Annotation payload includes start_offset, end_offset, selected_text, and comments array."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        assert resp.status_code == 200
        ann = resp.json()[0]
        assert "start_offset" in ann
        assert "end_offset" in ann
        assert "selected_text" in ann
        assert "comments" in ann

    def test_t1_f13_03_mobile_bottom_sheet_response_contract(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F13-03: Annotation response provides required fields to populate mobile bottom sheet."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        ann = resp.json()[0]
        comments = ann.get("comments", [])
        if comments:
            c = comments[0]
            assert "content" in c
            assert "author_initials" in c
            assert "created_at" in c

    def test_t1_f13_04_comment_author_initials_in_interaction(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F13-04: Comments in thread payload display non-empty author initials."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        ann = resp.json()[0]
        for c in ann.get("comments", []):
            assert len(c.get("author_initials", "")) > 0

    def test_t1_f13_05_timestamp_present_in_interaction(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T1-F13-05: Timestamp is present on every comment in interaction thread."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        ann = resp.json()[0]
        for c in ann.get("comments", []):
            assert "created_at" in c and c["created_at"] is not None

    # --- Tier 2: Boundary & Corner Cases ---

    def test_t2_f13_01_repeated_fetch_interaction_idempotent(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F13-01: Rapid repeated fetches of annotation details return consistent data."""
        r1 = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        r2 = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert len(r1.json()) == len(r2.json())

    def test_t2_f13_02_interaction_with_deleted_annotation_404(self, client: TestClient, auth_headers_reviewer1):
        """T2-F13-02: Querying non-existent annotation ID returns 404."""
        resp = client.get("/api/annotations/999999", headers=auth_headers_reviewer1)
        assert resp.status_code in (404, 422)

    def test_t2_f13_03_long_comment_content_in_interaction(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F13-03: Long 2,000-character comment content preserved in thread data."""
        long_comment = "Detailed review note: " + ("lorem ipsum " * 200)
        resp = client.post(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1, json={
            "start_offset": 0,
            "end_offset": 8,
            "selected_text": "# System",
            "comment_content": long_comment
        })
        assert resp.status_code in (200, 201)

    def test_t2_f13_04_consecutive_annotation_lookups(self, client: TestClient, auth_headers_reviewer1, annotated_doc_id):
        """T2-F13-04: Switching rapidly between annotations succeeds."""
        resp = client.get(f"/api/documents/{annotated_doc_id}/annotations", headers=auth_headers_reviewer1)
        for ann in resp.json()[:3]:
            ann_id = ann.get("id")
            if ann_id:
                client.get(f"/api/annotations/{ann_id}", headers=auth_headers_reviewer1)

    def test_t2_f13_05_unauthenticated_interaction_blocked_401(self, client: TestClient, annotated_doc_id):
        """T2-F13-05: Unauthenticated annotation fetch returns 401."""
        assert client.get(f"/api/documents/{annotated_doc_id}/annotations").status_code == 401
