"""Unit and Concurrency Tests for JSON Sidecar Storage Engine.
[SPEC-CHANGE-AUTHORIZED: verify bidirectional audio fields migration and startup hydration]

Validates atomic file replacement, thread-safe RLock concurrency,
Windows NTFS retry-with-backoff behavior, and SQLite-to-Sidecar migration.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import pytest

from doc_review_app.storage.json_storage import (
    get_sidecar_path,
    read_sidecar,
    write_sidecar_atomic,
    atomic_modify_sidecar,
    save_annotation_to_sidecar,
    save_comment_reply_to_sidecar,
    save_comment_edit_to_sidecar,
    save_comment_delete_to_sidecar,
    get_next_annotation_id,
    get_next_comment_id,
    get_next_audit_id,
)
from doc_review_app.storage.migration import (
    migrate_sqlite_annotations_to_sidecars,
    hydrate_sidecars_to_sqlite,
)


def test_sidecar_path_resolution(tmp_path: Path):
    """Test sidecar path naming preference and fallback."""
    p1 = get_sidecar_path("domeinmodel_woninginrichting.md", tmp_path)
    assert p1.name == "domeinmodel_woninginrichting.comments.json"
    assert p1.parent == tmp_path

    # If full filename sidecar exists, it is honored
    legacy_full = tmp_path / "custom.txt.comments.json"
    legacy_full.write_text("{}", encoding="utf-8")
    p2 = get_sidecar_path("custom.txt", tmp_path)
    assert p2 == legacy_full


def test_atomic_write_and_read(tmp_path: Path):
    """Test atomic writing and non-blocking reading with UTF-8 support."""
    sidecar_path = tmp_path / "test_doc.comments.json"
    data = {
        "document_filename": "test_doc.md",
        "schema_version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "annotations": [
            {
                "id": 1,
                "selected_text": "Speciale tekens: é, ü, ñ, 🚀",
                "color": "#FF6D00",
                "comments": [],
            }
        ],
        "audit_logs": [],
    }

    write_sidecar_atomic(sidecar_path, data)
    assert sidecar_path.exists()

    loaded = read_sidecar(sidecar_path)
    assert loaded["document_filename"] == "test_doc.md"
    assert loaded["annotations"][0]["selected_text"] == "Speciale tekens: é, ü, ñ, 🚀"


def test_atomic_modify_lifecycle(tmp_path: Path):
    """Test complete annotation and comment lifecycle using sidecar helpers."""
    filename = "review_spec.md"
    sidecar_path = tmp_path / "review_spec.comments.json"

    # 1. Create annotation
    ann_dict = {
        "id": 1,
        "start_offset": 10,
        "end_offset": 25,
        "selected_text": "Architectuur",
        "color": "#FF6D00",
        "ast_path": "h1[0]",
        "node_type": "Heading",
        "created_at": "2026-10-06T12:00:00Z",
        "author_id": 1229,
        "author_initials": "GJ",
        "author_name": "Gaspard Jaspars",
        "comments": [],
    }
    audit_ann = {
        "id": 1,
        "entity_type": "annotation",
        "entity_id": 1,
        "action": "CREATE",
        "actor_id": 1229,
        "actor_initials": "GJ",
        "old_value": None,
        "new_value": "Architectuur",
        "details": "Aangemaakt",
        "timestamp": "2026-10-06T12:00:00Z",
    }
    save_annotation_to_sidecar(filename, ann_dict, audit_ann, tmp_path)

    # 2. Add reply
    reply_dict = {
        "id": 101,
        "annotation_id": 1,
        "parent_comment_id": None,
        "author_id": 1229,
        "author_initials": "GJ",
        "author_name": "Gaspard Jaspars",
        "content": "Eerste reactie",
        "is_edited": False,
        "is_deleted": False,
        "created_at": "2026-10-06T12:01:00Z",
        "updated_at": "2026-10-06T12:01:00Z",
    }
    save_comment_reply_to_sidecar(filename, 1, reply_dict, None, tmp_path)

    # 3. Edit comment
    save_comment_edit_to_sidecar(filename, 101, "Aangepaste reactie", True, "2026-10-06T12:02:00Z", None, tmp_path)

    # 4. Read and verify
    data = read_sidecar(sidecar_path)
    assert len(data["annotations"]) == 1
    ann = data["annotations"][0]
    assert len(ann["comments"]) == 1
    com = ann["comments"][0]
    assert com["content"] == "Aangepaste reactie"
    assert com["is_edited"] is True
    assert com["is_deleted"] is False

    # 5. Soft delete comment
    save_comment_delete_to_sidecar(filename, 101, "2026-10-06T12:03:00Z", None, tmp_path)
    data_after_del = read_sidecar(sidecar_path)
    com_del = data_after_del["annotations"][0]["comments"][0]
    assert com_del["is_deleted"] is True
    assert com_del["content"] == "[Opmerking verwijderd]"


def test_concurrency_threadpool_safety(tmp_path: Path):
    """Test that concurrent writes across 25 worker threads result in zero Lost Updates."""
    filename = "concurrency_test.md"
    sidecar_path = tmp_path / "concurrency_test.comments.json"

    # Seed annotation
    ann_dict = {
        "id": 1,
        "start_offset": 0,
        "end_offset": 10,
        "selected_text": "Concurrent",
        "comments": [],
    }
    save_annotation_to_sidecar(filename, ann_dict, None, tmp_path)

    num_threads = 25

    def worker_post_comment(thread_idx: int):
        comment_dict = {
            "id": 1000 + thread_idx,
            "annotation_id": 1,
            "content": f"Bericht van thread {thread_idx}",
            "author_id": thread_idx,
            "author_initials": f"T{thread_idx}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        save_comment_reply_to_sidecar(filename, 1, comment_dict, None, tmp_path)

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(worker_post_comment, i) for i in range(num_threads)]
        for f in futures:
            f.result()

    data = read_sidecar(sidecar_path)
    comments = data["annotations"][0]["comments"]
    assert len(comments) == num_threads
    posted_ids = {c["id"] for c in comments}
    expected_ids = {1000 + i for i in range(num_threads)}
    assert posted_ids == expected_ids


def test_windows_retry_backoff_simulation(monkeypatch, tmp_path: Path):
    """Test that transient PermissionError is retried and successfully recovers."""
    sidecar_path = tmp_path / "retry_test.comments.json"
    original_replace = os.replace
    attempts = 0

    def mock_replace(src, dst):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise PermissionError("[WinError 32] The process cannot access the file")
        return original_replace(src, dst)

    monkeypatch.setattr(os, "replace", mock_replace)

    data = {"test": "value"}
    write_sidecar_atomic(sidecar_path, data)

    assert sidecar_path.exists()
    assert attempts == 3
    loaded = json.loads(sidecar_path.read_text(encoding="utf-8"))
    assert loaded["test"] == "value"


def test_sqlite_to_sidecar_migration(tmp_path: Path):
    """Test one-time migration of SQLite annotations and comments to sidecar JSON."""
    db_file = tmp_path / "mock_review.db"
    docs_dir = tmp_path / "local_docs"
    docs_dir.mkdir()

    # Create mock SQLite schema and data
    conn = sqlite3.connect(db_file)
    conn.execute(
        """
        CREATE TABLE documents (
            id INTEGER PRIMARY KEY,
            filename TEXT UNIQUE,
            hash TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE annotations (
            id INTEGER PRIMARY KEY,
            document_id INTEGER,
            start_offset INTEGER,
            end_offset INTEGER,
            selected_text TEXT,
            color TEXT,
            ast_path TEXT,
            node_type TEXT,
            user_id INTEGER,
            user_initials TEXT,
            user_name TEXT,
            created_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            annotation_id INTEGER,
            parent_comment_id INTEGER,
            user_id INTEGER,
            user_initials TEXT,
            user_name TEXT,
            content TEXT,
            is_deleted INTEGER,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY,
            document_id INTEGER,
            entity_type TEXT,
            entity_id INTEGER,
            action TEXT,
            user_id INTEGER,
            user_initials TEXT,
            old_value TEXT,
            new_value TEXT,
            metadata TEXT,
            created_at TEXT
        )
        """
    )

    # Insert test data
    conn.execute("INSERT INTO documents VALUES (1, 'domeinmodel_woninginrichting.md', 'abc123hash')")
    conn.execute(
        """
        INSERT INTO annotations VALUES (
            1, 1, 100, 150, 'Selectie', '#FF6D00', 'p[0]', 'Paragraph',
            1229, 'GJ', 'Gaspard Jaspars', '2026-10-06T10:00:00Z'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO comments VALUES (
            1, 1, NULL, 1229, 'GJ', 'Gaspard Jaspars', 'Belangrijke opmerking', 0, '2026-10-06T10:01:00Z', '2026-10-06T10:01:00Z'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO audit_logs VALUES (
            1, 1, 'annotation', 1, 'CREATE', 1229, 'GJ', NULL, 'Selectie', 'Details', '2026-10-06T10:00:00Z'
        )
        """
    )
    conn.commit()
    conn.close()

    # Execute migration
    migrated_count = migrate_sqlite_annotations_to_sidecars(db_path=db_file, documents_dir=docs_dir)
    assert migrated_count == 1

    # Verify sidecar created
    sidecar_path = docs_dir / "domeinmodel_woninginrichting.comments.json"
    assert sidecar_path.exists()
    sidecar_data = json.loads(sidecar_path.read_text(encoding="utf-8"))
    assert sidecar_data["document_filename"] == "domeinmodel_woninginrichting.md"
    assert len(sidecar_data["annotations"]) == 1
    assert sidecar_data["annotations"][0]["selected_text"] == "Selectie"
    assert sidecar_data["annotations"][0]["comments"][0]["content"] == "Belangrijke opmerking"
    assert len(sidecar_data["audit_logs"]) == 1
    assert sidecar_data["audit_logs"][0]["action"] == "CREATE"


def test_audio_fields_sidecar_roundtrip_and_hydration(tmp_path: Path):
    """Test that audio_file_id and audio_duration survive SQLite -> sidecar -> SQLite hydration."""
    docs_dir = tmp_path / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    db_file = tmp_path / "test_audio.db"

    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute(
        """
        CREATE TABLE documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            format TEXT NOT NULL DEFAULT 'markdown',
            content_hash TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL REFERENCES documents(id),
            author_id INTEGER NOT NULL,
            start_offset INTEGER NOT NULL,
            end_offset INTEGER NOT NULL,
            selected_text TEXT NOT NULL,
            badge_color TEXT NOT NULL DEFAULT '#FF6D00',
            status TEXT NOT NULL DEFAULT 'open',
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            annotation_id INTEGER NOT NULL REFERENCES annotations(id),
            parent_comment_id INTEGER,
            user_id INTEGER NOT NULL,
            author_initials TEXT NOT NULL,
            content TEXT NOT NULL,
            audio_file_id TEXT,
            audio_duration REAL,
            is_edited INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            initials TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'reviewer',
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        """
    )
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO users (id, username, full_name, initials, created_at) VALUES (1, 'reviewer', 'Reviewer User', 'RU', ?)",
        (now,),
    )
    conn.execute(
        "INSERT INTO documents (id, filename, content, format, content_hash, file_size, created_at, updated_at) VALUES (1, 'audio_doc.md', '# Doc', 'markdown', 'hash1', 5, ?, ?)",
        (now, now),
    )
    conn.execute(
        "INSERT INTO annotations (id, document_id, author_id, start_offset, end_offset, selected_text, badge_color, created_at, updated_at) VALUES (1, 1, 1, 0, 5, 'Audio', '#FF6D00', ?, ?)",
        (now, now),
    )
    audio_id = "abcd-1234-efgh-5678.mp3"
    audio_dur = 12.34
    conn.execute(
        "INSERT INTO comments (id, annotation_id, parent_comment_id, user_id, author_initials, content, audio_file_id, audio_duration, created_at, updated_at) VALUES (1, 1, NULL, 1, 'RU', 'Audio Comment', ?, ?, ?, ?)",
        (audio_id, audio_dur, now, now),
    )
    conn.commit()
    conn.close()

    # Step 1: Migrate SQLite to sidecar
    count = migrate_sqlite_annotations_to_sidecars(db_path=db_file, documents_dir=docs_dir)
    assert count == 1

    sidecar_path = docs_dir / "audio_doc.comments.json"
    assert sidecar_path.exists()
    sidecar_data = json.loads(sidecar_path.read_text(encoding="utf-8"))
    assert len(sidecar_data["annotations"]) == 1
    assert len(sidecar_data["annotations"][0]["comments"]) == 1
    comm = sidecar_data["annotations"][0]["comments"][0]
    assert comm.get("audio_file_id") == audio_id
    assert comm.get("audio_duration") == audio_dur

    # Step 2: Fresh database hydrate from sidecar
    fresh_db = tmp_path / "fresh_hydrated.db"
    fconn = sqlite3.connect(str(fresh_db))
    fconn.row_factory = sqlite3.Row
    fconn.execute("PRAGMA foreign_keys = ON;")
    fconn.execute(
        """
        CREATE TABLE documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            format TEXT NOT NULL DEFAULT 'markdown',
            content_hash TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    fconn.execute(
        """
        CREATE TABLE annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL REFERENCES documents(id),
            author_id INTEGER NOT NULL,
            start_offset INTEGER NOT NULL,
            end_offset INTEGER NOT NULL,
            selected_text TEXT NOT NULL,
            badge_color TEXT NOT NULL DEFAULT '#FF6D00',
            status TEXT NOT NULL DEFAULT 'open',
            is_deleted INTEGER NOT NULL DEFAULT 0,
            ast_path TEXT,
            node_type TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    fconn.execute(
        """
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            annotation_id INTEGER NOT NULL REFERENCES annotations(id),
            parent_comment_id INTEGER,
            user_id INTEGER NOT NULL,
            author_initials TEXT NOT NULL,
            content TEXT NOT NULL,
            audio_file_id TEXT,
            audio_duration REAL,
            is_edited INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    fconn.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            initials TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'reviewer',
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        """
    )
    fconn.execute(
        "INSERT INTO users (id, username, full_name, initials, created_at) VALUES (1, 'reviewer', 'Reviewer User', 'RU', ?)",
        (now,),
    )
    fconn.execute(
        "INSERT INTO documents (id, filename, content, format, content_hash, file_size, created_at, updated_at) VALUES (1, 'audio_doc.md', '# Doc', 'markdown', 'hash1', 5, ?, ?)",
        (now, now),
    )
    fconn.commit()

    # Hydrate sidecar into fresh DB
    hydrated = hydrate_sidecars_to_sqlite(db=fconn, documents_dir=docs_dir)
    assert hydrated >= 1

    row = fconn.execute("SELECT audio_file_id, audio_duration FROM comments WHERE id = 1").fetchone()
    assert row is not None
    assert row["audio_file_id"] == audio_id
    assert row["audio_duration"] == audio_dur
    fconn.close()

