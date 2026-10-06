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


def list_documents(db: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    """Return list of all ingested documents with metadata and total comment count."""
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

    def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
        cursor = conn.execute(query)
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "filename": row["filename"],
                "title": row["title"],
                "format": row["format"],
                "size_bytes": row["size_bytes"],
                "updated_at": row["updated_at"],
                "comment_count": row["comment_count"],
            }
            for row in rows
        ]

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

        return {
            "id": ann_id,
            "document_id": doc_id,
            "author_id": author_id,
            "start_offset": start_offset,
            "end_offset": end_offset,
            "selected_text": selected_text,
            "badge_color": badge_color,
            "status": "open",
            "created_at": now_iso,
            "comments": comments,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def delete_document(doc_id: int, db: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
    """Delete a document by ID, cascading annotations and comments, and unlinking from disk."""
    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = conn.execute("SELECT id, filename FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {doc_id} not found."
            )
        filename = row["filename"]
        
        # Foreign keys will cascade delete annotations and comments
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        
        # Remove file from local_documents directory if present
        from doc_review_app.config import settings
        file_path = (settings.documents_dir / filename).resolve()
        try:
            if file_path.is_relative_to(settings.documents_dir.resolve()):
                file_path.unlink(missing_ok=True)
        except Exception:
            pass

        return {
            "id": doc_id,
            "filename": filename,
            "deleted": True,
            "message": f"Document '{filename}' successfully deleted."
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


def sync_local_directory_with_db(db: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
    """Synchronize physical files in settings.documents_dir with SQLite.
    
    1. Scans settings.documents_dir for .md and .txt files.
    2. Normalizes CRLF to LF and calculates SHA-256 for each disk file.
    3. Inserts or updates documents whose content_hash changed.
    4. Deletes database records whose physical file is no longer on disk.
    5. Gracefully handles file locks (PermissionError/OSError).
    """
    import logging
    from doc_review_app.config import settings

    logger = logging.getLogger(__name__)
    folder = settings.documents_dir.resolve()
    folder.mkdir(parents=True, exist_ok=True)

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
            entries = list(os.scandir(str(folder)))
        except (OSError, PermissionError) as exc:
            logger.error(f"Cannot scan documents_dir '{folder}': {exc}")
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
                file_on_disk = folder / db_name
                if not file_on_disk.exists():
                    delete_document(doc_id=db_info["id"], db=conn)
                    removed.append(db_name)

        cursor.execute("SELECT COUNT(*) as cnt FROM documents")
        total_count = cursor.fetchone()["cnt"]

        return {
            "added": added,
            "updated": updated,
            "removed": removed,
            "errors": errors,
            "total_documents": total_count,
        }

    if db is not None:
        return _execute_sync(db)
    else:
        with get_db() as conn:
            return _execute_sync(conn)


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
