"""Document management and synchronization service.

Handles document normalization, hashing, ingestion (upsert),
listing with comment counts, and retrieval with embedded annotations.
"""

from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from doc_review_app.database import get_db


def normalize_line_endings(content: str) -> str:
    """Normalize line endings by standardizing CRLF (\\r\\n) and CR (\\r) to LF (\\n).
    
    Ensures character offsets are strictly uniform between disk and browser DOM.
    """
    if not content:
        return ""
    return content.replace("\r\n", "\n").replace("\r", "\n")


def compute_sha256(content: str) -> str:
    """Calculate SHA-256 hex digest of string content (UTF-8 encoded)."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _extract_title(filename: str, content: str) -> str:
    """Extract human-readable document title from content or fallback to filename."""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            if title:
                return title
    # Fallback to filename without extension, or filename itself
    stem = Path(filename).stem
    return stem if stem else filename


def validate_filename_and_format(filename: str, fmt: Optional[str] = None) -> Tuple[str, str]:
    """Validate filename and format constraints.
    
    Sanitizes path traversal, checks for null bytes, enforces supported extensions
    (.md and .txt) and format types ('markdown' and 'text').
    """
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty",
        )

    # Check for null bytes
    if "\x00" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename contains invalid null byte character",
        )

    # Sanitize path traversal: strip directory components to prevent traversal
    clean_filename = os.path.basename(filename)
    if not clean_filename or clean_filename in (".", ".."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or empty filename after path sanitization",
        )

    # Enforce supported extensions (.md and .txt)
    suffix = Path(clean_filename).suffix.lower()
    if suffix not in (".md", ".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{suffix}'. Only .md and .txt are supported.",
        )

    # Determine or validate format
    expected_format = "markdown" if suffix == ".md" else "text"
    if fmt:
        fmt_clean = fmt.lower().strip()
        if fmt_clean not in ("markdown", "text"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format '{fmt}'. Only 'markdown' and 'text' are supported.",
            )
        resolved_format = fmt_clean
    else:
        resolved_format = expected_format

    return clean_filename, resolved_format


def upsert_document(
    filename: str,
    content: str,
    format: Optional[str] = None,
    user_id: Optional[int] = None,
    is_admin: bool = False,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Insert or update a document record in SQLite documents table.
    
    Standardizes line endings to LF, computes SHA-256 hash, and updates or creates
    the document row. Returns dict with id, filename, action ('created'|'updated'), and sha256.
    """
    clean_filename, resolved_format = validate_filename_and_format(filename, format)
    normalized_content = normalize_line_endings(content)
    sha256_hash = compute_sha256(normalized_content)
    file_size = len(normalized_content.encode("utf-8"))
    title = _extract_title(clean_filename, normalized_content)
    now_iso = datetime.now(timezone.utc).isoformat()

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = conn.execute(
            "SELECT id, content_hash FROM documents WHERE filename = ?",
            (clean_filename,),
        )
        existing = cursor.fetchone()

        if existing:
            doc_id = existing["id"]
            conn.execute(
                """
                UPDATE documents
                SET title = ?,
                    content = ?,
                    format = ?,
                    content_hash = ?,
                    file_size = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (title, normalized_content, resolved_format, sha256_hash, file_size, now_iso, doc_id),
            )
            action = "updated"
        else:
            cursor = conn.execute(
                """
                INSERT INTO documents (
                    filename, title, content, format, content_hash, file_size, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (clean_filename, title, normalized_content, resolved_format, sha256_hash, file_size, now_iso, now_iso),
            )
            doc_id = cursor.lastrowid
            action = "created"

        if user_id is not None and not is_admin:
            conn.execute(
                "INSERT OR IGNORE INTO document_access (document_id, user_id, granted_at) VALUES (?, ?, ?)",
                (doc_id, user_id, now_iso),
            )

        return {
            "id": doc_id,
            "filename": clean_filename,
            "action": action,
            "sha256": sha256_hash,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def list_documents(
    user_id: Optional[int] = None,
    is_admin: bool = False,
    db: Optional[sqlite3.Connection] = None,
) -> List[Dict[str, Any]]:
    """Return list of all ingested documents with metadata and total comment count."""
    if not is_admin and user_id is not None:
        query = """
            SELECT
                d.id,
                d.filename,
                d.title,
                d.format,
                d.file_size AS size_bytes,
                d.updated_at,
                COUNT(c.id) AS comment_count
            FROM documents d
            JOIN document_access da ON da.document_id = d.id AND da.user_id = ?
            LEFT JOIN annotations a ON a.document_id = d.id AND a.is_deleted = 0
            LEFT JOIN comments c ON c.annotation_id = a.id AND c.is_deleted = 0
            GROUP BY d.id
            ORDER BY d.id ASC
        """
        params: tuple = (user_id,)
    else:
        query = """
            SELECT
                d.id,
                d.filename,
                d.title,
                d.format,
                d.file_size AS size_bytes,
                d.updated_at,
                COUNT(c.id) AS comment_count
            FROM documents d
            LEFT JOIN annotations a ON a.document_id = d.id AND a.is_deleted = 0
            LEFT JOIN comments c ON c.annotation_id = a.id AND c.is_deleted = 0
            GROUP BY d.id
            ORDER BY d.id ASC
        """
        params = ()

    def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        from doc_review_app.storage.json_storage import get_sidecar_path, read_sidecar
        result = []
        for row in rows:
            comment_count = row["comment_count"]
            sidecar_path = get_sidecar_path(row["filename"])
            if sidecar_path.exists():
                sidecar_data = read_sidecar(sidecar_path, filename_hint=row["filename"])
                sidecar_comments = sum(
                    1 for ann in sidecar_data.get("annotations", [])
                    if not ann.get("is_deleted", False)
                    for c in ann.get("comments", [])
                    if not c.get("is_deleted", False)
                )
                if sidecar_comments > 0 or comment_count == 0:
                    comment_count = sidecar_comments

            result.append({
                "id": row["id"],
                "filename": row["filename"],
                "title": row["title"],
                "format": row["format"],
                "size_bytes": row["size_bytes"],
                "updated_at": row["updated_at"],
                "comment_count": comment_count,
            })
        return result

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def get_document_by_id(doc_id: int, db: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
    """Retrieve full document record with content and anchored annotations.
    
    Returns None if document not found or invalid id.
    """
    if doc_id <= 0:
        return None

    def _execute(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
        doc_cursor = conn.execute(
            """
            SELECT id, filename, title, content, format, content_hash, file_size, created_at, updated_at
            FROM documents
            WHERE id = ?
            """,
            (doc_id,),
        )
        doc = doc_cursor.fetchone()
        if not doc:
            return None

        # Fetch all annotations for this document
        ann_cursor = conn.execute(
            """
            SELECT id, document_id, author_id, start_offset, end_offset, selected_text, badge_color, status, created_at
            FROM annotations
            WHERE document_id = ? AND is_deleted = 0
            ORDER BY start_offset ASC, id ASC
            """,
            (doc_id,),
        )
        ann_rows = ann_cursor.fetchall()

        annotations_list = []
        for ann in ann_rows:
            # Fetch comments for this annotation
            com_cursor = conn.execute(
                """
                SELECT id, annotation_id, parent_comment_id, user_id, author_initials, content, is_edited, is_deleted, created_at, updated_at
                FROM comments
                WHERE annotation_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (ann["id"],),
            )
            comments = [
                {
                    "id": c["id"],
                    "annotation_id": c["annotation_id"],
                    "parent_comment_id": c["parent_comment_id"],
                    "user_id": c["user_id"],
                    "author_initials": c["author_initials"],
                    "content": "[Opmerking verwijderd]" if c["is_deleted"] else c["content"],
                    "is_edited": bool(c["is_edited"]),
                    "is_deleted": bool(c["is_deleted"]),
                    "created_at": c["created_at"],
                    "updated_at": c["updated_at"],
                }
                for c in com_cursor.fetchall()
            ]

            annotations_list.append({
                "id": ann["id"],
                "document_id": ann["document_id"],
                "author_id": ann["author_id"],
                "start_offset": ann["start_offset"],
                "end_offset": ann["end_offset"],
                "selected_text": ann["selected_text"],
                "badge_color": ann["badge_color"],
                "status": ann["status"],
                "created_at": ann["created_at"],
                "comments": comments,
            })

        return {
            "id": doc["id"],
            "filename": doc["filename"],
            "title": doc["title"],
            "content": doc["content"],
            "format": doc["format"],
            "content_hash": doc["content_hash"],
            "file_size": doc["file_size"],
            "created_at": doc["created_at"],
            "updated_at": doc["updated_at"],
            "annotations": annotations_list,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def create_annotation_for_document(
    doc_id: int,
    author_id: int,
    author_initials: str,
    start_offset: int,
    end_offset: int,
    selected_text: str,
    comment_content: Optional[str] = None,
    badge_color: str = "#FF6D00",
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Helper to create an annotation and optional attached comment."""
    if doc_id <= 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if start_offset < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_offset must be >= 0")
    if end_offset <= start_offset:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_offset must be > start_offset")

    now_iso = datetime.now(timezone.utc).isoformat()

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        # Verify document exists
        doc = conn.execute("SELECT id, content FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

        content = doc["content"]
        if end_offset > len(content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"end_offset ({end_offset}) exceeds document length ({len(content)})",
            )

        cursor = conn.execute(
            """
            INSERT INTO annotations (
                document_id, author_id, start_offset, end_offset, selected_text, badge_color, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (doc_id, author_id, start_offset, end_offset, selected_text, badge_color, "open", now_iso, now_iso),
        )
        ann_id = cursor.lastrowid

        comments = []
        if comment_content and comment_content.strip():
            c_cursor = conn.execute(
                """
                INSERT INTO comments (
                    annotation_id, parent_comment_id, user_id, author_initials, content, is_edited, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (ann_id, None, author_id, author_initials, comment_content.strip(), 0, now_iso, now_iso),
            )
            comments.append({
                "id": c_cursor.lastrowid,
                "annotation_id": ann_id,
                "parent_comment_id": None,
                "user_id": author_id,
                "author_initials": author_initials,
                "content": comment_content.strip(),
                "is_edited": False,
                "created_at": now_iso,
                "updated_at": now_iso,
            })

        ann_dict = {
            "id": ann_id,
            "document_id": doc_id,
            "author_id": author_id,
            "author_initials": author_initials,
            "start_offset": start_offset,
            "end_offset": end_offset,
            "selected_text": selected_text,
            "badge_color": badge_color,
            "color": badge_color,
            "status": "open",
            "is_deleted": False,
            "created_at": now_iso,
            "comments": comments,
        }
        try:
            from doc_review_app.storage.json_storage import save_annotation_to_sidecar
            save_annotation_to_sidecar(filename=doc["filename"], annotation=ann_dict)
        except Exception:
            pass

        return ann_dict

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def delete_document(doc_id: int, db: Optional[sqlite3.Connection] = None, *, sync_cloud: bool = False) -> Dict[str, Any]:
    """Delete a document by ID, cascading annotations and comments, unlinking from disk, and conditionally tombstones in cloud."""
    from doc_review_app.config import settings
    from doc_review_app.storage.json_storage import get_sidecar_path

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = conn.execute("SELECT id, filename FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {doc_id} not found."
            )
        filename = row["filename"]
        
        # Foreign keys will cascade delete annotations and comments in SQLite
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        
        # Remove file from local_documents directory if present
        clean_name = Path(filename).name
        target_dir = settings.documents_dir
        file_path = (target_dir / clean_name).resolve()
        
        try:
            if file_path.is_relative_to(target_dir.resolve()):
                file_path.unlink(missing_ok=True)
        except Exception:
            pass

        # Handle sidecar unlinking:
        # 1. Unlink unique sidecar (<filename>.comments.json)
        unique_sidecar = target_dir / f"{clean_name}.comments.json"
        try:
            if unique_sidecar.is_relative_to(target_dir.resolve()):
                unique_sidecar.unlink(missing_ok=True)
        except Exception:
            pass

        # 2. Check if stem sidecar should be unlinked
        # If there's an active sibling on disk with the same stem, keep stem sidecar for that sibling!
        stem = Path(clean_name).stem
        ext = Path(clean_name).suffix.lower()
        is_md = ext in [".md", ".markdown"]
        
        has_active_stem_sibling = any(
            f.is_file()
            and f.name != clean_name
            and f.suffix.lower() in [".md", ".markdown", ".txt"]
            and f.stem == stem
            for f in target_dir.iterdir()
        ) if target_dir.exists() else False

        if is_md or not has_active_stem_sibling:
            stem_sidecar = target_dir / f"{stem}.comments.json"
            try:
                if stem_sidecar.is_relative_to(target_dir.resolve()):
                    stem_sidecar.unlink(missing_ok=True)
            except Exception:
                pass

        return {
            "id": doc_id,
            "filename": filename,
            "deleted": True,
            "message": f"Document '{filename}' successfully deleted."
        }

    # Execute SQLite transaction strictly bounded
    if db is not None:
        result = _execute(db)
    else:
        with get_db() as conn:
            result = _execute(conn)

    # Cloud sync happens OUTSIDE the SQLite write lock!
    if sync_cloud:
        try:
            from doc_review_app.storage import cloud_sync
            cloud_sync.delete_document_from_cloud(result["filename"])
        except Exception as e:
            logger.warning("Cloud tombstone creation failed for '%s': %s", result["filename"], e)

    return result


# ============================================================================
# Document Access Control & Permissions Matrix
# ============================================================================


def check_document_access(
    document_id: int,
    user_id: int,
    is_admin: bool,
    db: Optional[sqlite3.Connection] = None,
) -> bool:
    """Verify if a user has access to a given document. Admin has full access."""
    if is_admin:
        return True

    def _execute(conn: sqlite3.Connection) -> bool:
        cursor = conn.execute(
            "SELECT 1 FROM document_access WHERE document_id = ? AND user_id = ?",
            (document_id, user_id),
        )
        return cursor.fetchone() is not None

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def check_document_access_by_annotation(
    annotation_id: int,
    user_id: int,
    is_admin: bool,
    db: Optional[sqlite3.Connection] = None,
) -> Tuple[bool, bool]:
    """Check existence of annotation and access permissions to parent document. Returns (exists, has_access)."""
    def _execute(conn: sqlite3.Connection) -> Tuple[bool, bool]:
        cursor = conn.execute(
            "SELECT document_id FROM annotations WHERE id = ?",
            (annotation_id,),
        )
        row = cursor.fetchone()
        if not row:
            return False, False
        if is_admin:
            return True, True
        has_access = check_document_access(row["document_id"], user_id, is_admin=False, db=conn)
        return True, has_access

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def check_document_access_by_comment(
    comment_id: int,
    user_id: int,
    is_admin: bool,
    db: Optional[sqlite3.Connection] = None,
) -> Tuple[bool, bool]:
    """Check existence of comment and access permissions to parent document. Returns (exists, has_access)."""
    def _execute(conn: sqlite3.Connection) -> Tuple[bool, bool]:
        cursor = conn.execute(
            """
            SELECT a.document_id
            FROM comments c
            JOIN annotations a ON a.id = c.annotation_id
            WHERE c.id = ?
            """,
            (comment_id,),
        )
        row = cursor.fetchone()
        if not row:
            return False, False
        if is_admin:
            return True, True
        has_access = check_document_access(row["document_id"], user_id, is_admin=False, db=conn)
        return True, has_access

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def get_document_access_matrix(db: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
    """Retrieve full 2D matrix of documents x active reviewer users with granted status."""
    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        users_cur = conn.execute(
            """
            SELECT id, username, full_name
            FROM users
            WHERE is_active = 1 AND is_admin = 0
            ORDER BY full_name ASC, username ASC
            """
        )
        users = users_cur.fetchall()

        docs_cur = conn.execute(
            "SELECT id, filename FROM documents ORDER BY filename ASC"
        )
        docs = docs_cur.fetchall()

        access_cur = conn.execute(
            "SELECT document_id, user_id FROM document_access"
        )
        access_set = {(r["document_id"], r["user_id"]) for r in access_cur.fetchall()}

        user_list = [
            {
                "id": u["id"],
                "name": u["full_name"] if u["full_name"] else u["username"],
                "username": u["username"],
            }
            for u in users
        ]

        document_list = [
            {
                "id": d["id"],
                "filename": d["filename"],
                "access": {
                    str(u["id"]): (d["id"], u["id"]) in access_set
                    for u in users
                },
            }
            for d in docs
        ]

        return {
            "users": user_list,
            "documents": document_list,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def toggle_document_access(
    document_id: int,
    user_id: int,
    granted: bool,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Toggle access for a single user to a document. Validates document and user existence."""
    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        doc = conn.execute("SELECT id FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {document_id} not found.",
            )

        user = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found.",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        if granted:
            conn.execute(
                "INSERT OR IGNORE INTO document_access (document_id, user_id, granted_at) VALUES (?, ?, ?)",
                (document_id, user_id, now_iso),
            )
        else:
            conn.execute(
                "DELETE FROM document_access WHERE document_id = ? AND user_id = ?",
                (document_id, user_id),
            )

        return {
            "document_id": document_id,
            "user_id": user_id,
            "granted": granted,
            "success": True,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def batch_update_document_access(
    access_map: Dict[Any, List[int]],
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Batch update document access for multiple documents and users.
    
    access_map: {doc_id: [user_id_1, user_id_2, ...]}
    Empty list clears all access for that doc_id.
    """
    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        updated_docs = 0
        total_grants = 0

        for doc_id_raw, user_ids in access_map.items():
            try:
                doc_id = int(doc_id_raw)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid document ID: {doc_id_raw}",
                )

            doc = conn.execute("SELECT id FROM documents WHERE id = ?", (doc_id,)).fetchone()
            if not doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document with ID {doc_id} not found.",
                )

            for u_id_raw in user_ids:
                try:
                    u_id = int(u_id_raw)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid user ID: {u_id_raw}",
                    )
                u = conn.execute("SELECT id FROM users WHERE id = ?", (u_id,)).fetchone()
                if not u:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"User with ID {u_id} not found.",
                    )

            conn.execute("DELETE FROM document_access WHERE document_id = ?", (doc_id,))
            for u_id in user_ids:
                conn.execute(
                    "INSERT INTO document_access (document_id, user_id, granted_at) VALUES (?, ?, ?)",
                    (doc_id, int(u_id), now_iso),
                )
            updated_docs += 1
            total_grants += len(user_ids)

        return {
            "success": True,
            "updated_documents": updated_docs,
            "total_grants": total_grants,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def save_uploaded_file(
    filename: str,
    content_bytes: bytes,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Validate, save to disk in documents_dir, and upsert into database."""
    from doc_review_app.config import settings
    
    if not filename or not filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty."
        )

    # Clean and sanitize filename against path traversal
    clean_name = Path(filename.replace("\\", "/")).name
    clean_name = clean_name.replace("\x00", "").strip()
    if not clean_name or clean_name in (".", ".."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename."
        )

    # Validate extension
    lower_name = clean_name.lower()
    if lower_name.endswith(".md"):
        fmt = "markdown"
    elif lower_name.endswith(".txt"):
        fmt = "text"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension for '{clean_name}'. Only .md and .txt files are allowed."
        )

    # Decode UTF-8
    try:
        content_str = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{clean_name}' is not valid UTF-8 text."
        )

    # Normalize line endings
    content_str = normalize_line_endings(content_str)

    # Save to disk in settings.documents_dir
    target_path = (settings.documents_dir / clean_name).resolve()
    if not target_path.is_relative_to(settings.documents_dir.resolve()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path traversal attempt detected."
        )

    settings.documents_dir.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content_str, encoding="utf-8")

    # Upsert in database
    res = upsert_document(
        filename=clean_name,
        content=content_str,
        format=fmt,
        db=db,
    )
    return res


def _bring_window_to_foreground(hwnd: int, user32, kernel32) -> None:
    """Safely brings the specified window to top and foreground on Windows."""
    try:
        current_thread = kernel32.GetCurrentThreadId()
        fg_hwnd = user32.GetForegroundWindow()
        fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0

        if fg_thread and fg_thread != current_thread:
            user32.AttachThreadInput(current_thread, fg_thread, True)

        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.BringWindowToTop(hwnd)

        # Bypass Windows ForegroundLockTimeout via simulated Alt key event
        VK_MENU = 0x12
        KEYEVENTF_KEYUP = 0x0002
        user32.keybd_event(VK_MENU, 0, 0, 0)
        user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)

        user32.SetForegroundWindow(hwnd)

        if fg_thread and fg_thread != current_thread:
            user32.AttachThreadInput(current_thread, fg_thread, False)
    except Exception:
        pass


def _open_folder_windows(folder: Path) -> bool:
    """Windows-specific folder opening with dedicated thread, desktop station awareness,
    Shell COM, tab deduplication, and foreground elevation.
    """
    import ctypes
    import subprocess
    import threading
    import time

    def _com_worker(target_folder: Path, result_box: list):
        hdesk = None
        user32 = None
        kernel32 = None
        try:
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            hdesk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)

            import pythoncom
            import win32com.client

            pythoncom.CoInitialize()
            try:
                shell = win32com.client.Dispatch("Shell.Application")
                folder_url = f"file:///{str(target_folder).replace('\\', '/')}"
                windows = list(shell.Windows())
                target_hwnd = None

                # P2.2 Tab deduplication: check if already open in an existing tab
                for w in windows:
                    try:
                        loc = getattr(w, "LocationURL", "")
                        if loc and loc.rstrip("/").lower() == folder_url.rstrip("/").lower():
                            target_hwnd = getattr(w, "HWND", None)
                            break
                    except Exception:
                        pass

                if target_hwnd is None:
                    if windows:
                        win = windows[0]
                        win.Navigate2(folder_url, 0x0800)  # navOpenInNewTab
                        target_hwnd = getattr(win, "HWND", None)
                    else:
                        shell.Open(str(target_folder))
                        # P2.3 Polling loop (max 1.5s) to capture new window HWND
                        for _ in range(15):
                            time.sleep(0.1)
                            cur_windows = list(shell.Windows())
                            if cur_windows:
                                target_hwnd = getattr(cur_windows[0], "HWND", None)
                                break

                if target_hwnd and hdesk:
                    _bring_window_to_foreground(target_hwnd, user32, kernel32)

                result_box.append(True)
            finally:
                pythoncom.CoUninitialize()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).debug(f"Windows Shell COM launch exception: {exc}")
        finally:
            if user32 and hdesk:
                try:
                    user32.CloseDesktop(hdesk)
                except Exception:
                    pass

    # 1. Shell COM via dedicated one-shot thread
    res_box: list = []
    t = threading.Thread(target=_com_worker, args=(folder, res_box), daemon=True)
    t.start()
    t.join(timeout=3.0)

    if res_box and res_box[0] is True:
        return True

    # 2. Fallback to subprocess.Popen with explicit lpDesktop
    try:
        si = subprocess.STARTUPINFO()
        si.lpDesktop = r"WinSta0\Default"
        subprocess.Popen(["explorer.exe", str(folder)], startupinfo=si)
        return True
    except Exception:
        pass

    # 3. Standard subprocess.Popen fallback
    try:
        subprocess.Popen(["explorer.exe", str(folder)])
        return True
    except Exception:
        if hasattr(os, "startfile"):
            os.startfile(str(folder))
            return True
        raise


def open_local_documents_folder() -> Dict[str, Any]:
    """Open the local documents directory in the OS file explorer.
    
    Cross-platform support: Windows (Interactive WinSta0\\Default COM/Explorer + Popen fallback),
    macOS (open), Linux (xdg-open). Catches OSError, AttributeError, and other exceptions gracefully.
    """
    import logging
    import subprocess
    import sys
    from doc_review_app.config import settings

    logger = logging.getLogger(__name__)
    folder = settings.documents_dir.resolve()
    folder.mkdir(parents=True, exist_ok=True)

    opened = False
    error_msg = None
    try:
        if sys.platform == "win32":
            opened = _open_folder_windows(folder)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])
            opened = True
        else:
            subprocess.Popen(["xdg-open", str(folder)])
            opened = True
    except (OSError, AttributeError, Exception) as exc:
        logger.warning(f"Could not open file explorer for '{folder}': {exc}")
        error_msg = str(exc)

    return {
        "status": "opened" if opened else "fallback",
        "path": str(folder),
        "error": error_msg,
    }


def sync_local_directory_with_db(
    db: Optional[sqlite3.Connection] = None,
    *,
    sync_cloud: bool = False,
    folder: Optional[Path] = None,
) -> Dict[str, Any]:
    """Synchronize physical files in settings.documents_dir with SQLite.
    
    1. Pre-scan: if sync_cloud=True, probe Supabase and pull latest documents/tombstones.
    2. Scans documents_dir for .md and .txt files.
    3. Normalizes CRLF to LF and calculates SHA-256 for each disk file.
    4. Inserts or updates documents whose content_hash changed in bounded SQLite transaction.
    5. Deletes database records whose physical file is no longer on disk (sync_cloud=False).
    6. Post-commit: if sync_cloud=True, pushes added/updated documents to Supabase outside DB lock.
    """
    import logging
    from doc_review_app.config import settings

    logger = logging.getLogger(__name__)
    target_folder = (folder or settings.documents_dir).resolve()
    target_folder.mkdir(parents=True, exist_ok=True)

    # Pre-Scan Connectivity Probe & Cloud Pull (if sync_cloud=True)
    if sync_cloud:
        try:
            from doc_review_app.storage import cloud_sync
            if cloud_sync.check_connection():
                logger.info("Supabase connectivity verified; pulling cloud state before local scan.")
                try:
                    cloud_sync.pull_documents_from_cloud(target_folder)
                except Exception as e:
                    logger.warning("Cloud pull failed during pre-scan: %s", e)
        except Exception as e:
            logger.debug("Pre-scan probe warning: %s", e)

    added: List[str] = []
    updated: List[str] = []
    removed: List[str] = []
    errors: List[Dict[str, str]] = []

    def _execute_sync(conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = conn.cursor()
        cursor.execute("SELECT id, filename, content_hash FROM documents")
        existing_docs = {
            row["filename"]: {"id": row["id"], "hash": row["content_hash"]}
            for row in cursor.fetchall()
        }

        disk_filenames = set()

        try:
            entries = list(os.scandir(str(target_folder)))
        except (OSError, PermissionError) as exc:
            logger.error(f"Cannot scan documents_dir '{target_folder}': {exc}")
            return {
                "added": [],
                "updated": [],
                "removed": [],
                "errors": [{"filename": "", "error": str(exc)}],
                "total_documents": len(existing_docs),
            }

        for entry in entries:
            if not entry.is_file():
                continue
            lower_name = entry.name.lower()
            if not (lower_name.endswith(".md") or lower_name.endswith(".markdown") or lower_name.endswith(".txt")):
                continue

            clean_name = entry.name
            disk_filenames.add(clean_name)
            fmt = "markdown" if (lower_name.endswith(".md") or lower_name.endswith(".markdown")) else "text"

            try:
                raw_bytes = Path(entry.path).read_bytes()
                content_str = raw_bytes.decode("utf-8")
            except (UnicodeDecodeError, PermissionError, OSError) as exc:
                logger.warning(f"Skipping file '{clean_name}' during sync: {exc}")
                errors.append({"filename": clean_name, "error": str(exc)})
                continue

            content_str = normalize_line_endings(content_str)
            computed_hash = compute_sha256(content_str)

            if clean_name not in existing_docs:
                upsert_document(
                    filename=clean_name,
                    content=content_str,
                    format=fmt,
                    db=conn,
                )
                added.append(clean_name)
            else:
                existing_hash = existing_docs[clean_name]["hash"]
                if existing_hash != computed_hash:
                    upsert_document(
                        filename=clean_name,
                        content=content_str,
                        format=fmt,
                        db=conn,
                    )
                    updated.append(clean_name)

        for db_name, db_info in existing_docs.items():
            if db_name not in disk_filenames:
                file_on_disk = target_folder / db_name
                if not file_on_disk.exists():
                    delete_document(doc_id=db_info["id"], db=conn, sync_cloud=False)
                    removed.append(db_name)

        cursor.execute("SELECT COUNT(*) as cnt FROM documents")
        total_count = cursor.fetchone()["cnt"]

        # Ensure any sidecars on disk are hydrated into SQLite
        try:
            from doc_review_app.storage.migration import hydrate_sidecars_to_sqlite
            hydrate_sidecars_to_sqlite(db=conn)
        except Exception as e:
            logger.warning(f"Sidecar hydration during folder sync encountered warning: {e}")

        return {
            "added": added,
            "updated": updated,
            "removed": removed,
            "errors": errors,
            "total_documents": total_count,
        }

    # Bounded SQLite transaction
    if db is not None:
        sync_result = _execute_sync(db)
    else:
        with get_db() as conn:
            sync_result = _execute_sync(conn)

    # Post-Commit Cloud Sync (Strictly OUTSIDE SQLite lock)
    if sync_cloud:
        try:
            from doc_review_app.storage import cloud_sync
            if not cloud_sync.cloud_sync_degraded:
                for name in added + updated:
                    if cloud_sync.cloud_sync_degraded:
                        break
                    try:
                        fpath = target_folder / name
                        if fpath.exists():
                            fcontent = fpath.read_text(encoding="utf-8")
                            cloud_sync.push_document_to_cloud(
                                filename=name,
                                content=fcontent,
                                file_size=len(fcontent.encode("utf-8")),
                                sha256_hash="",
                            )
                    except Exception as e:
                        logger.warning("Post-sync cloud push failed for '%s': %s", name, e)
            sync_result["cloud_sync_degraded"] = cloud_sync.cloud_sync_degraded
        except Exception as e:
            logger.debug("Post-sync cloud push warning: %s", e)
            sync_result["cloud_sync_degraded"] = True
    else:
        sync_result["cloud_sync_degraded"] = False

    return sync_result


def backup_document_comments_to_archive(
    filename: str = "domeinmodel_woninginrichting.md",
    db: Optional[sqlite3.Connection] = None,
    archive_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Export and archive all annotations and comments of a document prior to deletion."""
    import json
    from pathlib import Path
    from doc_review_app.config import settings

    target_archive = archive_dir if archive_dir is not None else (settings.base_dir / "archive")
    target_archive.mkdir(parents=True, exist_ok=True)

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Find document
        cursor.execute(
            "SELECT id, filename, title, content FROM documents WHERE filename = ? OR id = 356",
            (filename,)
        )
        doc_row = cursor.fetchone()
        if not doc_row:
            return {
                "status": "not_found",
                "filename": filename,
                "annotations_count": 0,
                "comments_count": 0,
                "json_path": None,
                "markdown_path": None,
            }

        doc_id = doc_row["id"]
        doc_title = doc_row["title"]
        actual_filename = doc_row["filename"]

        # Fetch annotations with author info
        cursor.execute(
            """
            SELECT a.id, a.start_offset, a.end_offset, a.selected_text, a.badge_color,
                   a.status, a.ast_path, a.node_type, a.created_at, u.username, u.full_name, u.initials
            FROM annotations a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.document_id = ?
            ORDER BY a.start_offset ASC
            """,
            (doc_id,)
        )
        annotations = [dict(r) for r in cursor.fetchall()]

        # Fetch all comments for these annotations
        anno_ids = [a["id"] for a in annotations]
        comments_by_anno: Dict[int, List[Dict[str, Any]]] = {aid: [] for aid in anno_ids}
        total_comments = 0

        if anno_ids:
            placeholders = ",".join("?" for _ in anno_ids)
            cursor.execute(
                f"""
                SELECT c.id, c.annotation_id, c.parent_comment_id, c.user_id, c.author_initials,
                       c.content, c.is_edited, c.created_at, c.updated_at, u.username, u.full_name
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.annotation_id IN ({placeholders})
                ORDER BY c.created_at ASC
                """,
                anno_ids
            )
            for c in cursor.fetchall():
                cdict = dict(c)
                comments_by_anno[cdict["annotation_id"]].append(cdict)
                total_comments += 1

        payload = {
            "document_id": doc_id,
            "filename": actual_filename,
            "title": doc_title,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "annotations_count": len(annotations),
            "comments_count": total_comments,
            "annotations": [
                {**a, "comments": comments_by_anno.get(a["id"], [])}
                for a in annotations
            ]
        }

        # 1. JSON Export
        stem = Path(actual_filename).stem
        json_file = target_archive / f"{stem}_opmerkingen_backup.json"
        json_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        # 2. Markdown Human-Readable Report
        md_lines = [
            f"# Archief Review-Opmerkingen: {doc_title}",
            f"- **Oorspronkelijk Bestand:** `{actual_filename}`",
            f"- **Gearchiveerd op:** {payload['archived_at']}",
            f"- **Aantal Tekstmarkeringen:** {len(annotations)}",
            f"- **Totaal Aantal Reacties:** {total_comments}",
            "",
            "---",
            ""
        ]

        for idx, a in enumerate(annotations, start=1):
            md_lines.append(f"## {idx}. Tekstpassage: \"{a['selected_text']}\"")
            if a.get("ast_path"):
                md_lines.append(f"- **AST Sectie:** `{a['ast_path']}`")
            if a.get("node_type"):
                md_lines.append(f"- **Type:** `{a['node_type']}`")
            md_lines.append(f"- **Aangemaakt door:** {a.get('full_name') or a.get('initials')} op {a['created_at']}")
            md_lines.append("")

            c_list = comments_by_anno.get(a["id"], [])
            if c_list:
                md_lines.append("### Geplaatste Opmerkingen:")
                for c in c_list:
                    author = f"{c.get('full_name')} ({c.get('author_initials')})" if c.get("full_name") else c.get("author_initials")
                    md_lines.append(f"> **{author}** ({c['created_at']}):")
                    md_lines.append(f"> {c['content']}")
                    md_lines.append("")
            md_lines.append("---")
            md_lines.append("")

        md_file = target_archive / f"{stem}_opmerkingen_backup.md"
        md_file.write_text("\n".join(md_lines), encoding="utf-8")

        return {
            "status": "success",
            "filename": actual_filename,
            "annotations_count": len(annotations),
            "comments_count": total_comments,
            "json_path": str(json_file),
            "markdown_path": str(md_file),
        }

    if db is not None:
        return _execute(db)
    else:
        with get_db() as conn:
            return _execute(conn)
