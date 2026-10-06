"""Migration utility from SQLite database to JSON sidecars.

Enables seamless transition of existing annotations, comments, and audit trails
from doc_review.db to per-document .comments.json sidecars without data loss.
"""

from datetime import datetime, timezone
import logging
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional

from doc_review_app.config import settings
from doc_review_app.storage.json_storage import (
    get_sidecar_path,
    read_sidecar,
    write_sidecar_atomic,
)

logger = logging.getLogger(__name__)


def migrate_sqlite_annotations_to_sidecars(
    db_path: Optional[Path] = None,
    documents_dir: Optional[Path] = None,
) -> int:
    """Migrate all annotations, comments, and audit logs from SQLite to JSON sidecars."""
    target_db = db_path or settings.db_path
    target_dir = documents_dir or settings.documents_dir

    if not target_db or not target_db.exists() or str(target_db) == ":memory:":
        return 0

    try:
        conn = sqlite3.connect(f"file:{target_db}?mode=ro", uri=True)
    except Exception:
        try:
            conn = sqlite3.connect(target_db)
        except Exception as exc:
            logger.warning(f"Could not connect to SQLite database for sidecar migration: {exc}")
            return 0

    conn.row_factory = sqlite3.Row
    migrated_annotations_count = 0

    try:
        # Check if tables exist
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        if "documents" not in tables or "annotations" not in tables:
            return 0

        # Fetch all documents
        doc_cols = [c[1] for c in conn.execute("PRAGMA table_info(documents)").fetchall()]
        hash_col = "content_hash" if "content_hash" in doc_cols else ("hash" if "hash" in doc_cols else None)
        query = f"SELECT id, filename{f', {hash_col}' if hash_col else ''} FROM documents"
        docs = conn.execute(query).fetchall()
        for doc in docs:
            doc_id = doc["id"]
            filename = doc["filename"]
            doc_hash = doc[hash_col] if hash_col and hash_col in doc.keys() else ""

            sidecar_path = get_sidecar_path(filename, target_dir)
            existing_data = read_sidecar(sidecar_path, filename_hint=filename)

            # Map existing annotation IDs to avoid duplicates
            existing_ann_ids = {a.get("id") for a in existing_data.get("annotations", [])}

            # Inspect annotation columns
            ann_cols = [c[1] for c in conn.execute("PRAGMA table_info(annotations)").fetchall()]
            user_id_col = "author_id" if "author_id" in ann_cols else "user_id"
            color_col = "badge_color" if "badge_color" in ann_cols else ("color" if "color" in ann_cols else "NULL")
            node_type_col = "node_type" if "node_type" in ann_cols else "NULL"
            ast_path_col = "ast_path" if "ast_path" in ann_cols else "NULL"

            # Fetch annotations for this document
            ann_rows = conn.execute(
                f"""
                SELECT id, start_offset, end_offset, selected_text, {color_col} AS color,
                       {ast_path_col} AS ast_path, {node_type_col} AS node_type,
                       {user_id_col} AS author_id, created_at
                FROM annotations WHERE document_id = ? ORDER BY id ASC
                """,
                (doc_id,),
            ).fetchall()

            for ann in ann_rows:
                ann_id = ann["id"]
                if ann_id in existing_ann_ids:
                    continue

                # Fetch comments for this annotation
                com_cols = [c[1] for c in conn.execute("PRAGMA table_info(comments)").fetchall()]
                user_name_col = "user_name" if "user_name" in com_cols else "NULL"
                user_initials_col = "author_initials" if "author_initials" in com_cols else ("user_initials" if "user_initials" in com_cols else "NULL")
                updated_at_col = "updated_at" if "updated_at" in com_cols else "created_at"
                comments_rows = conn.execute(
                    f"""
                    SELECT id, parent_comment_id, user_id, {user_initials_col} AS user_initials, {user_name_col} AS user_name,
                           content, is_deleted, created_at, {updated_at_col} AS updated_at
                    FROM comments WHERE annotation_id = ? ORDER BY id ASC
                    """,
                    (ann_id,),
                ).fetchall()

                comments_list: List[Dict[str, Any]] = []
                for c in comments_rows:
                    comments_list.append(
                        {
                            "id": c["id"],
                            "annotation_id": ann_id,
                            "parent_comment_id": c["parent_comment_id"],
                            "author_id": c["user_id"],
                            "author_initials": c["user_initials"] or "??",
                            "author_name": c["user_name"] or "Reviewer",
                            "content": c["content"],
                            "is_deleted": bool(c["is_deleted"]),
                            "created_at": c["created_at"],
                            "updated_at": c["updated_at"] or c["created_at"],
                        }
                    )

                ann_obj = {
                    "id": ann_id,
                    "start_offset": ann["start_offset"],
                    "end_offset": ann["end_offset"],
                    "selected_text": ann["selected_text"],
                    "color": ann["color"] or "#FF6D00",
                    "ast_path": ann["ast_path"],
                    "node_type": ann["node_type"],
                    "created_at": ann["created_at"],
                    "author_id": ann["author_id"],
                    "author_initials": "GJ",
                    "author_name": "Reviewer",
                    "comments": comments_list,
                }
                existing_data["annotations"].append(ann_obj)
                migrated_annotations_count += 1

            # Fetch audit logs if table exists
            if "audit_logs" in tables:
                audit_rows = conn.execute(
                    """
                    SELECT id, entity_type, entity_id, action, user_id, user_initials,
                           old_value, new_value, metadata, created_at
                    FROM audit_logs WHERE document_id = ? ORDER BY id ASC
                    """,
                    (doc_id,),
                ).fetchall()
                existing_audit_ids = {l.get("id") for l in existing_data.get("audit_logs", [])}
                for log in audit_rows:
                    if log["id"] not in existing_audit_ids:
                        existing_data["audit_logs"].append(
                            {
                                "id": log["id"],
                                "entity_type": log["entity_type"],
                                "entity_id": log["entity_id"],
                                "action": log["action"],
                                "actor_id": log["user_id"],
                                "actor_initials": log["user_initials"] or "??",
                                "old_value": log["old_value"],
                                "new_value": log["new_value"],
                                "details": log["metadata"] or "",
                                "timestamp": log["created_at"],
                            }
                        )

            existing_data["document_filename"] = filename
            if doc_hash:
                existing_data["document_hash"] = doc_hash
            existing_data["updated_at"] = datetime.now(timezone.utc).isoformat()

            # Write sidecar if any annotations or audit logs exist
            if existing_data["annotations"] or existing_data.get("audit_logs"):
                write_sidecar_atomic(sidecar_path, existing_data)

    finally:
        conn.close()

    return migrated_annotations_count


def auto_migrate_if_needed() -> None:
    """Safe startup hook to auto-migrate SQLite annotations and restore archived backups to sidecars."""
    try:
        count = migrate_sqlite_annotations_to_sidecars()
        if count > 0:
            logger.info(f"Successfully migrated {count} annotations from SQLite to JSON sidecars.")

        # Check for archive backups if document has no sidecar yet
        archive_dir = settings.base_dir / "archive"
        if archive_dir.exists() and settings.documents_dir.exists():
            import json
            for doc_file in settings.documents_dir.glob("*.md"):
                sidecar_path = get_sidecar_path(doc_file.name)
                if not sidecar_path.exists():
                    backup_file = archive_dir / f"{doc_file.stem}_opmerkingen_backup.json"
                    if backup_file.exists():
                        try:
                            with open(backup_file, "r", encoding="utf-8") as f:
                                backup_data = json.load(f)
                            sidecar_data = {
                                "document_filename": doc_file.name,
                                "schema_version": 1,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                                "annotations": backup_data.get("annotations", []),
                                "audit_logs": backup_data.get("audit_logs", []),
                            }
                            write_sidecar_atomic(sidecar_path, sidecar_data)
                            logger.info(f"Restored sidecar from archive backup: {sidecar_path.name}")
                        except Exception as e:
                            logger.warning(f"Could not restore from archive backup {backup_file}: {e}")
    except Exception as exc:
        logger.warning(f"Auto-migration from SQLite to sidecars skipped or encountered error: {exc}")
