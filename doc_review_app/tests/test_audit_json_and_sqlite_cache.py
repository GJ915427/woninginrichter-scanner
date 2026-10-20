"""Tests for JSON sidecar permissions, audit logs, and SQLite cache rehydration.

Validates that:
1. Document access permissions are stored as natural composite keys (allowed_usernames) in sidecars.
2. Cold boot with an empty SQLite cache 100% reconstructs document_access and audit_logs from sidecars.
3. Zombie grant guard prevents Kelly Schreurs from receiving access when permissions were explicitly cleared ([]).
4. Audit log entries are deduplicated across multiple rehydrations.
5. toggle_document_access and batch_update_document_access perform atomic dual-write to SQLite and sidecars.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import pytest

from doc_review_app.database import init_db
from doc_review_app.models import User
from doc_review_app.services import document_service, user_service, comment_service
from doc_review_app.storage import json_storage, migration


@pytest.fixture
def isolated_env(tmp_path: Path):
    """Create isolated directories and fresh SQLite database for test isolation."""
    db_path = tmp_path / "test_doc_review.db"
    docs_dir = tmp_path / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)

    init_db(db_path)

    # Seed users
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT OR IGNORE INTO users (id, username, initials, full_name, email, is_admin, is_active, password_hash, created_at, updated_at)
            VALUES 
                (1, 'admin', 'SA', 'System Administrator', 'admin@example.com', 1, 1, 'hash', ?, ?),
                (2, 'kelly.schreurs', 'KS', 'Kelly Schreurs', 'kelly@example.com', 0, 1, 'hash', ?, ?),
                (3, 'simon.bak', 'SB', 'Simon Bak', 'simon@example.com', 0, 1, 'hash', ?, ?)
            """,
            (now_iso, now_iso, now_iso, now_iso, now_iso, now_iso),
        )
        conn.commit()

    return {
        "db_path": db_path,
        "docs_dir": docs_dir,
    }


def test_sidecar_access_permissions_read_write(isolated_env):
    """Test reading and writing allowed_usernames in document sidecar."""
    docs_dir = isolated_env["docs_dir"]
    doc_filename = "test_doc.md"

    # Absent by default
    perms = json_storage.read_sidecar_access_permissions(doc_filename, documents_dir=docs_dir)
    assert perms is None

    # Write permissions
    json_storage.update_sidecar_access_permissions(
        doc_filename,
        ["kelly.schreurs", "simon.bak"],
        documents_dir=docs_dir,
    )

    perms = json_storage.read_sidecar_access_permissions(doc_filename, documents_dir=docs_dir)
    assert perms == ["kelly.schreurs", "simon.bak"]

    # Clear permissions to empty list
    json_storage.update_sidecar_access_permissions(
        doc_filename,
        [],
        documents_dir=docs_dir,
    )
    perms = json_storage.read_sidecar_access_permissions(doc_filename, documents_dir=docs_dir)
    assert perms == []


def test_rehydration_from_sidecar_to_sqlite(isolated_env):
    """Test that cold SQLite cache is populated with document_access and audit_logs from sidecars."""
    db_path = isolated_env["db_path"]
    docs_dir = isolated_env["docs_dir"]
    doc_filename = "model_a.md"

    # 1. Create document on disk and sidecar
    (docs_dir / doc_filename).write_text("# Test Model A\nContent here", encoding="utf-8")
    now_iso = datetime.now(timezone.utc).isoformat()

    sidecar_data = {
        "document_filename": doc_filename,
        "schema_version": 1,
        "updated_at": now_iso,
        "allowed_usernames": ["kelly.schreurs"],
        "annotations": [],
        "audit_logs": [
            {
                "entity_type": "document",
                "entity_id": 1,
                "action": "UPDATE",
                "user_id": 1,
                "user_initials": "SA",
                "created_at": now_iso,
                "metadata": json.dumps({"event": "ACCESS_GRANT", "granted_to": "kelly.schreurs"}),
            }
        ],
    }
    json_storage.write_sidecar_atomic(json_storage.get_sidecar_path(doc_filename, docs_dir), sidecar_data)

    # 2. Ingest document into SQLite
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            INSERT INTO documents (id, filename, title, content, format, content_hash, file_size, created_at, updated_at)
            VALUES (1, ?, 'Test Model A', 'Content here', 'markdown', 'hash123', 100, ?, ?)
            """,
            (doc_filename, now_iso, now_iso),
        )
        conn.commit()

        # Run rehydration
        count = migration.hydrate_sidecars_to_sqlite(conn, documents_dir=docs_dir)
        conn.commit()

        # Verify document_access in SQLite
        access_rows = conn.execute("SELECT * FROM document_access WHERE document_id = 1").fetchall()
        assert len(access_rows) == 1
        assert access_rows[0]["user_id"] == 2  # kelly.schreurs id is 2

        # Verify audit_logs in SQLite
        audit_rows = conn.execute("SELECT * FROM audit_logs WHERE document_id = 1").fetchall()
        assert len(audit_rows) == 1
        assert audit_rows[0]["action"] == "UPDATE"


def test_zombie_grant_guard_on_cold_boot(isolated_env):
    """Test that explicit revocation (allowed_usernames: []) prevents zombie bootstrap for Kelly Schreurs."""
    db_path = isolated_env["db_path"]
    docs_dir = isolated_env["docs_dir"]
    doc_filename = "revoked_model.md"

    (docs_dir / doc_filename).write_text("# Revoked Doc", encoding="utf-8")
    now_iso = datetime.now(timezone.utc).isoformat()

    # Admin explicitly revoked all users
    sidecar_data = {
        "document_filename": doc_filename,
        "schema_version": 1,
        "updated_at": now_iso,
        "allowed_usernames": [],  # Explicitly empty!
        "annotations": [],
        "audit_logs": [],
    }
    json_storage.write_sidecar_atomic(json_storage.get_sidecar_path(doc_filename, docs_dir), sidecar_data)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO documents (id, filename, title, content, format, content_hash, file_size, created_at, updated_at) "
            "VALUES (1, ?, 'Revoked Doc', 'Content', 'markdown', 'hash', 10, ?, ?)",
            (doc_filename, now_iso, now_iso),
        )
        conn.commit()

        # Run rehydration
        migration.hydrate_sidecars_to_sqlite(conn, documents_dir=docs_dir)

        # Check zombie guard condition:
        sidecar_has_permissions = False
        for doc_file in docs_dir.glob("*.md"):
            sc_path = json_storage.get_sidecar_path(doc_file.name, docs_dir)
            if sc_path.exists():
                sc_data = json_storage.read_sidecar(sc_path, filename_hint=doc_file.name)
                if "allowed_usernames" in sc_data and sc_data["allowed_usernames"] is not None:
                    sidecar_has_permissions = True
                    break

        assert sidecar_has_permissions is True  # Guard detects sidecar has permissions configured!

        # Since sidecar_has_permissions is True, bootstrap is SKIPPED
        access_rows = conn.execute("SELECT * FROM document_access WHERE document_id = 1").fetchall()
        assert len(access_rows) == 0  # No zombie grant!


def test_audit_log_deduplication(isolated_env):
    """Test that multiple rehydrations do not duplicate audit log entries."""
    db_path = isolated_env["db_path"]
    docs_dir = isolated_env["docs_dir"]
    doc_filename = "dedup_model.md"

    (docs_dir / doc_filename).write_text("# Dedup Doc", encoding="utf-8")
    now_iso = datetime.now(timezone.utc).isoformat()

    sidecar_data = {
        "document_filename": doc_filename,
        "schema_version": 1,
        "updated_at": now_iso,
        "allowed_usernames": ["simon.bak"],
        "annotations": [],
        "audit_logs": [
            {
                "entity_type": "document",
                "entity_id": 1,
                "action": "UPDATE",
                "user_id": 1,
                "user_initials": "SA",
                "created_at": now_iso,
                "metadata": None,
            }
        ],
    }
    json_storage.write_sidecar_atomic(json_storage.get_sidecar_path(doc_filename, docs_dir), sidecar_data)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO documents (id, filename, title, content, format, content_hash, file_size, created_at, updated_at) "
            "VALUES (1, ?, 'Dedup Doc', 'Content', 'markdown', 'hash', 10, ?, ?)",
            (doc_filename, now_iso, now_iso),
        )
        conn.commit()

        # Run rehydration twice
        migration.hydrate_sidecars_to_sqlite(conn, documents_dir=docs_dir)
        migration.hydrate_sidecars_to_sqlite(conn, documents_dir=docs_dir)

        # Audit logs count must be exactly 1
        rows = conn.execute("SELECT * FROM audit_logs WHERE document_id = 1").fetchall()
        assert len(rows) == 1


def test_toggle_and_batch_access_dual_write(isolated_env, monkeypatch):
    """Test toggle_document_access and batch_update_document_access dual-write to SQLite and sidecars."""
    db_path = isolated_env["db_path"]
    docs_dir = isolated_env["docs_dir"]
    doc_filename = "dual_write.md"

    from doc_review_app.config import settings
    monkeypatch.setattr(settings, "documents_dir", docs_dir)

    (docs_dir / doc_filename).write_text("# Dual Write", encoding="utf-8")
    now_iso = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("DROP TRIGGER IF EXISTS trg_legacy_test_auto_access_docs")
        conn.execute("DROP TRIGGER IF EXISTS trg_legacy_test_auto_access_users")
        conn.execute(
            "INSERT INTO documents (id, filename, title, content, format, content_hash, file_size, created_at, updated_at) "
            "VALUES (1, ?, 'Dual Write', 'Content', 'markdown', 'hash', 10, ?, ?)",
            (doc_filename, now_iso, now_iso),
        )
        conn.execute("DELETE FROM document_access WHERE document_id = 1")
        conn.commit()

        # 1. Toggle access for Simon Bak (user_id=3)
        res = document_service.toggle_document_access(
            document_id=1,
            user_id=3,
            granted=True,
            db=conn,
            actor_user_id=1,
        )
        assert res["success"] is True

        # Check SQLite
        rows = conn.execute("SELECT * FROM document_access WHERE document_id = 1 AND user_id = 3").fetchall()
        assert len(rows) == 1

        # Check Sidecar
        perms = json_storage.read_sidecar_access_permissions(doc_filename, documents_dir=docs_dir)
        assert perms == ["simon.bak"]

        # Check audit log in sidecar
        sidecar = json_storage.read_sidecar(json_storage.get_sidecar_path(doc_filename, docs_dir), filename_hint=doc_filename)
        assert len(sidecar.get("audit_logs", [])) >= 1
        assert sidecar["audit_logs"][-1]["action"] == "UPDATE"

        # 2. Batch update: set to Kelly Schreurs only
        batch_res = document_service.batch_update_document_access(
            access_map={1: [2]},
            db=conn,
            actor_user_id=1,
        )
        assert batch_res["success"] is True

        # Check SQLite
        rows = conn.execute("SELECT * FROM document_access WHERE document_id = 1").fetchall()
        assert len(rows) == 1
        assert rows[0]["user_id"] == 2

        # Check Sidecar
        perms = json_storage.read_sidecar_access_permissions(doc_filename, documents_dir=docs_dir)
        assert perms == ["kelly.schreurs"]
