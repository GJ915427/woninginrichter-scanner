"""JSON Sidecar Storage Engine for Document Review.

Provides thread-safe atomic reading, writing, and mutating of per-document
.comments.json sidecar files with Windows NTFS retry-backoff and RLock protection.
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from doc_review_app.config import settings


class LockManager:
    """Manages per-document re-entrant locks for thread-safe mutations."""

    _global_lock = threading.Lock()
    _locks: Dict[str, threading.RLock] = {}

    @classmethod
    def get_lock(cls, sidecar_path: Path) -> threading.RLock:
        """Get or create an RLock uniquely keyed by the normalized absolute path."""
        norm_key = str(sidecar_path.resolve()).lower()
        with cls._global_lock:
            if norm_key not in cls._locks:
                cls._locks[norm_key] = threading.RLock()
            return cls._locks[norm_key]


def get_sidecar_path(filename: str, documents_dir: Optional[Path] = None) -> Path:
    """Determine the sidecar path for a given document filename.
    
    Prefers <stem>.comments.json, and supports <filename>.comments.json if already on disk.
    """
    base_dir = documents_dir or settings.documents_dir
    clean_name = os.path.basename(filename)
    stem = Path(clean_name).stem
    
    # If <filename>.comments.json already exists, use it
    full_ext_path = base_dir / f"{clean_name}.comments.json"
    stem_path = base_dir / f"{stem}.comments.json"
    
    if full_ext_path.exists() and not stem_path.exists():
        return full_ext_path
    return stem_path


def default_sidecar_data(filename: str) -> Dict[str, Any]:
    """Generate empty sidecar structure conforming to schema v1."""
    return {
        "document_filename": filename,
        "schema_version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "annotations": [],
        "audit_logs": [],
    }


def read_sidecar(sidecar_path: Path, filename_hint: str = "") -> Dict[str, Any]:
    """Read sidecar JSON file or return default empty schema if non-existent."""
    if not sidecar_path.exists():
        hint = filename_hint or sidecar_path.stem.replace(".comments", "")
        return default_sidecar_data(hint)

    lock = LockManager.get_lock(sidecar_path)
    with lock:
        try:
            with open(sidecar_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return default_sidecar_data(filename_hint)
            data.setdefault("annotations", [])
            data.setdefault("audit_logs", [])
            data.setdefault("schema_version", 1)
            return data
        except (json.JSONDecodeError, OSError):
            return default_sidecar_data(filename_hint)


def write_sidecar_atomic(sidecar_path: Path, data: Dict[str, Any]) -> None:
    """Write sidecar data atomically using a .tmp file and os.replace with Windows retry backoff."""
    sidecar_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = sidecar_path.with_name(f"{sidecar_path.name}.{os.getpid()}.{threading.get_ident()}.tmp")

    payload = json.dumps(data, indent=2, ensure_ascii=False)
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())

    max_retries = 5
    for attempt in range(max_retries):
        try:
            os.replace(tmp_path, sidecar_path)
            try:
                from doc_review_app.storage.cloud_sync import push_sidecar_to_cloud
                push_sidecar_to_cloud(sidecar_path.name, data, background=True)
            except Exception:
                pass
            return
        except (PermissionError, OSError) as exc:
            if attempt == max_retries - 1:
                if tmp_path.exists():
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass
                raise exc
            time.sleep(0.025 * (2 ** attempt))


def atomic_modify_sidecar(
    sidecar_path: Path,
    modifier_func: Callable[[Dict[str, Any]], Any],
    filename_hint: str = "",
) -> Any:
    """Execute complete Read-Modify-Write cycle inside a per-document threading.RLock."""
    lock = LockManager.get_lock(sidecar_path)
    with lock:
        data = read_sidecar(sidecar_path, filename_hint=filename_hint)
        result = modifier_func(data)
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        write_sidecar_atomic(sidecar_path, data)
        return result


def get_next_annotation_id(data: Dict[str, Any]) -> int:
    """Calculate the next integer ID for an annotation within the sidecar."""
    existing_ids = [ann.get("id", 0) for ann in data.get("annotations", []) if isinstance(ann, dict)]
    return (max(existing_ids) + 1) if existing_ids else 1


def get_next_comment_id(data: Dict[str, Any]) -> int:
    """Calculate the next integer ID for a comment across all annotations in the sidecar."""
    existing_ids: List[int] = []
    for ann in data.get("annotations", []):
        if isinstance(ann, dict):
            for c in ann.get("comments", []):
                if isinstance(c, dict) and "id" in c:
                    existing_ids.append(c["id"])
    return (max(existing_ids) + 1) if existing_ids else 1


def get_next_audit_id(data: Dict[str, Any]) -> int:
    """Calculate the next integer ID for an audit log entry in the sidecar."""
    existing_ids = [log.get("id", 0) for log in data.get("audit_logs", []) if isinstance(log, dict)]
    return (max(existing_ids) + 1) if existing_ids else 1


def save_annotation_to_sidecar(
    filename: str,
    annotation: Dict[str, Any],
    audit_entry: Optional[Dict[str, Any]] = None,
    documents_dir: Optional[Path] = None,
) -> None:
    """Save an annotation and optional audit log to the document's sidecar atomically."""
    sidecar_path = get_sidecar_path(filename, documents_dir)

    def _modify(data: Dict[str, Any]) -> None:
        anns = data.setdefault("annotations", [])
        for i, existing in enumerate(anns):
            if existing.get("id") == annotation.get("id"):
                anns[i] = annotation
                break
        else:
            anns.append(annotation)
        if audit_entry:
            data.setdefault("audit_logs", []).append(audit_entry)

    atomic_modify_sidecar(sidecar_path, _modify, filename_hint=filename)


def save_comment_reply_to_sidecar(
    filename: str,
    annotation_id: int,
    comment: Dict[str, Any],
    audit_entry: Optional[Dict[str, Any]] = None,
    documents_dir: Optional[Path] = None,
) -> None:
    """Save a comment reply and optional audit log to the document's sidecar atomically."""
    sidecar_path = get_sidecar_path(filename, documents_dir)

    def _modify(data: Dict[str, Any]) -> None:
        for ann in data.setdefault("annotations", []):
            if ann.get("id") == annotation_id:
                comments = ann.setdefault("comments", [])
                for i, existing in enumerate(comments):
                    if existing.get("id") == comment.get("id"):
                        comments[i] = comment
                        break
                else:
                    comments.append(comment)
                break
        if audit_entry:
            data.setdefault("audit_logs", []).append(audit_entry)

    atomic_modify_sidecar(sidecar_path, _modify, filename_hint=filename)


def save_comment_edit_to_sidecar(
    filename: str,
    comment_id: int,
    new_content: str,
    is_edited: bool,
    updated_at: str,
    audit_entry: Optional[Dict[str, Any]] = None,
    documents_dir: Optional[Path] = None,
) -> None:
    """Update a comment's content in the document's sidecar atomically."""
    sidecar_path = get_sidecar_path(filename, documents_dir)

    def _modify(data: Dict[str, Any]) -> None:
        for ann in data.setdefault("annotations", []):
            for c in ann.get("comments", []):
                if c.get("id") == comment_id:
                    c["content"] = new_content
                    c["is_edited"] = is_edited
                    c["updated_at"] = updated_at
                    break
        if audit_entry:
            data.setdefault("audit_logs", []).append(audit_entry)

    atomic_modify_sidecar(sidecar_path, _modify, filename_hint=filename)


def save_comment_delete_to_sidecar(
    filename: str,
    comment_id: int,
    deleted_at: str,
    audit_entry: Optional[Dict[str, Any]] = None,
    documents_dir: Optional[Path] = None,
) -> None:
    """Soft delete a comment in the document's sidecar atomically, marking annotation deleted if all comments deleted."""
    sidecar_path = get_sidecar_path(filename, documents_dir)

    def _modify(data: Dict[str, Any]) -> None:
        for ann in data.setdefault("annotations", []):
            for c in ann.get("comments", []):
                if c.get("id") == comment_id:
                    c["is_deleted"] = True
                    c["deleted_at"] = deleted_at
                    c["content"] = "[Opmerking verwijderd]"
                    active_comments = [
                        comm for comm in ann.get("comments", [])
                        if not comm.get("is_deleted", False)
                    ]
                    if not active_comments:
                        ann["is_deleted"] = True
                        ann["deleted_at"] = deleted_at
                        ann["status"] = "deleted"
                    break
        if audit_entry:
            data.setdefault("audit_logs", []).append(audit_entry)

    atomic_modify_sidecar(sidecar_path, _modify, filename_hint=filename)
