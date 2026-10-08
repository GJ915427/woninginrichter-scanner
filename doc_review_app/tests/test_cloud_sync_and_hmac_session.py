import hashlib
import hmac
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from doc_review_app.config import settings
from doc_review_app.database import SCHEMA_DDL
from doc_review_app.services import user_service
from doc_review_app.storage.cloud_sync import _execute_push, pull_sidecars_from_cloud, push_sidecar_to_cloud


@pytest.fixture
def test_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_DDL)
    yield conn
    conn.close()


@pytest.fixture
def seeded_user(test_db):
    user = user_service.create_user(
        db=test_db,
        username="guy.wolters",
        password="TestPassword123!",
        full_name="Guy Wolters",
        initials="GW",
        email="guy.wolters@groterinwonen.nl",
        is_admin=False,
    )
    return user


def test_hmac_signed_session_creation_and_validation(test_db, seeded_user):
    user_id = seeded_user["id"]
    token = user_service.create_session(test_db, user_id=user_id, duration_days=30)

    # Assert token has 4 dot-separated components: user_id.ts.salt.sig
    parts = token.split(".")
    assert len(parts) == 4
    token_user_id, ts, salt, sig = parts
    assert int(token_user_id) == user_id
    assert len(salt) == 16  # 8 bytes hex = 16 chars
    assert len(sig) == 32

    # Fast-path validation from SQLite
    validated = user_service.lookup_and_validate_session(test_db, token)
    assert validated is not None
    assert validated["id"] == user_id
    assert validated["username"] == "guy.wolters"
    assert validated["initials"] == "GW"


def test_hmac_session_survives_sqlite_wipe(test_db, seeded_user):
    """Simulates Render container restart where ephemeral SQLite database was wiped."""
    user_id = seeded_user["id"]
    token = user_service.create_session(test_db, user_id=user_id, duration_days=30)

    # Wipe the sessions table completely
    test_db.execute("DELETE FROM sessions")
    test_db.commit()

    count = test_db.execute("SELECT count(*) FROM sessions").fetchone()[0]
    assert count == 0

    # Fallback validation should verify HMAC signature and restore session to DB
    validated = user_service.lookup_and_validate_session(test_db, token)
    assert validated is not None
    assert validated["id"] == user_id
    assert validated["username"] == "guy.wolters"

    # Verify session was re-cached in SQLite
    re_cached_count = test_db.execute("SELECT count(*) FROM sessions WHERE token = ?", (token,)).fetchone()[0]
    assert re_cached_count == 1


def test_tampered_or_expired_hmac_token_rejected(test_db, seeded_user):
    user_id = seeded_user["id"]
    token = user_service.create_session(test_db, user_id=user_id, duration_days=30)

    # Wipe DB so it relies on fallback check
    test_db.execute("DELETE FROM sessions")
    test_db.commit()

    parts = token.split(".")

    # 1. Tampered signature
    tampered_sig_token = f"{parts[0]}.{parts[1]}.{parts[2]}.deadbeefdeadbeefdeadbeefdeadbeef"
    assert user_service.lookup_and_validate_session(test_db, tampered_sig_token) is None

    # 2. Tampered user ID
    tampered_user_token = f"9999.{parts[1]}.{parts[2]}.{parts[3]}"
    assert user_service.lookup_and_validate_session(test_db, tampered_user_token) is None

    # 3. Expired timestamp (31 days ago)
    past_ts = int((datetime.now(timezone.utc) - timedelta(days=31)).timestamp())
    salt = "1234567812345678"
    payload = f"{user_id}:{past_ts}:{salt}"
    valid_sig_but_expired = hmac.new(
        settings.session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    expired_token = f"{user_id}.{past_ts}.{salt}.{valid_sig_but_expired}"
    assert user_service.lookup_and_validate_session(test_db, expired_token) is None


def test_cloud_sync_push_mocked(tmp_path):
    sidecar_data = {
        "version": 1,
        "target_file": "sample.md",
        "annotations": [{"id": "ann-1", "selected_text": "Hello"}],
    }

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.status = 201
        mock_urlopen.return_value.__enter__.return_value = mock_response

        # Execute push with .comments.json filename
        success = _execute_push("sample.comments.json", sidecar_data)
        assert success is True
        assert mock_urlopen.called
        req = mock_urlopen.call_args[0][0]
        assert "document_sidecars" in req.full_url
        assert req.get_method() == "POST"
        body = json.loads(req.data.decode("utf-8"))
        # Standardized to .md document identifier in Supabase
        assert body["filename"] == "sample.md"
        assert body["sidecar_json"]["version"] == 1


def test_cloud_sync_pull_mocked(tmp_path):
    fake_rows = [
        {
            "filename": "domeinmodel_woninginrichting.md",
            "sidecar_json": {
                "version": 1,
                "target_file": "domeinmodel_woninginrichting.md",
                "annotations": [{"id": "cloud-ann-1", "comments": [{"content": "Cloud restored"}]}],
            },
            "updated_at": "2026-10-08T12:00:00Z",
        }
    ]

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(fake_rows).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        pulled = pull_sidecars_from_cloud(tmp_path)
        assert pulled == 1

        restored_file = tmp_path / "domeinmodel_woninginrichting.comments.json"
        assert restored_file.exists()
        saved_content = json.loads(restored_file.read_text(encoding="utf-8"))
        assert saved_content["annotations"][0]["id"] == "cloud-ann-1"
