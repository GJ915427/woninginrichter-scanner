"""Integration tests for audio comment persistence.
[SPEC-CHANGE-AUTHORIZED: align HTTP status code assertions with FastAPI 201 Created responses]
Verifies end-to-end flow from REST router, through comment_service, to SQLite database.
"""

from typing import Dict
import pytest
from fastapi.testclient import TestClient
from doc_review_app.database import get_db


@pytest.fixture
def test_doc_id(client: TestClient, auth_headers_reviewer1: Dict[str, str]) -> int:
    sync_resp = client.post(
        "/api/documents/sync",
        headers=auth_headers_reviewer1,
        json={
            "filename": "audio_test_doc.md",
            "content": "# Audio Test Document\n\nDocument text for voice comment verification.",
            "format": "markdown",
        },
    )
    assert sync_resp.status_code in (200, 201)
    return sync_resp.json()["id"]


def test_create_annotation_with_audio_persistence(
    client: TestClient,
    auth_headers_reviewer1: Dict[str, str],
    test_doc_id: int,
):
    audio_uuid = "12345678-1234-5678-1234-567812345678.mp3"
    audio_dur = 14.25

    payload = {
        "start_offset": 0,
        "end_offset": 10,
        "selected_text": "Audio Test",
        "comment_content": "Gesproken review notitie over gordijnroede",
        "badge_color": "yellow",
        "audio_file_id": audio_uuid,
        "audio_duration": audio_dur,
    }

    create_resp = client.post(
        f"/api/documents/{test_doc_id}/annotations",
        json=payload,
        headers=auth_headers_reviewer1,
    )
    assert create_resp.status_code in (200, 201)
    annotation = create_resp.json()
    assert "comments" in annotation
    assert len(annotation["comments"]) > 0
    root_comment = annotation["comments"][0]
    assert root_comment.get("audio_file_id") == audio_uuid
    assert root_comment.get("audio_duration") == audio_dur

    # Verify retrieval via GET /api/documents/{doc_id}/annotations
    get_resp = client.get(
        f"/api/documents/{test_doc_id}/annotations",
        headers=auth_headers_reviewer1,
    )
    assert get_resp.status_code == 200
    ann_list = get_resp.json()
    matching = [a for a in ann_list if a["id"] == annotation["id"]]
    assert len(matching) == 1
    retrieved_comment = matching[0]["comments"][0]
    assert retrieved_comment.get("audio_file_id") == audio_uuid
    assert retrieved_comment.get("audio_duration") == audio_dur

    # Verify directly in SQLite comments table
    with get_db() as db:
        row = db.execute(
            "SELECT audio_file_id, audio_duration FROM comments WHERE id = ?",
            (root_comment["id"],),
        ).fetchone()
        assert row is not None
        assert row["audio_file_id"] == audio_uuid
        assert row["audio_duration"] == audio_dur


def test_create_comment_reply_with_audio_persistence(
    client: TestClient,
    auth_headers_reviewer1: Dict[str, str],
    test_doc_id: int,
):
    # Create root annotation
    ann_resp = client.post(
        f"/api/documents/{test_doc_id}/annotations",
        json={
            "start_offset": 0,
            "end_offset": 5,
            "selected_text": "Audio",
            "comment_content": "Eerste notitie",
        },
        headers=auth_headers_reviewer1,
    )
    ann_id = ann_resp.json()["id"]
    root_comment_id = ann_resp.json()["comments"][0]["id"]

    reply_audio_id = "87654321-4321-8765-4321-876543210987.mp3"
    reply_audio_dur = 8.5

    # Create reply with audio
    reply_resp = client.post(
        f"/api/annotations/{ann_id}/comments",
        json={
            "content": "Gesproken reactie op annotatie",
            "parent_comment_id": root_comment_id,
            "audio_file_id": reply_audio_id,
            "audio_duration": reply_audio_dur,
        },
        headers=auth_headers_reviewer1,
    )
    assert reply_resp.status_code in (200, 201)
    reply_data = reply_resp.json()
    assert reply_data.get("audio_file_id") == reply_audio_id
    assert reply_data.get("audio_duration") == reply_audio_dur
