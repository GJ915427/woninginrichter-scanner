"""Cloud synchronisatie en persistentie voor documenten en sidecars (Supabase PostgREST).

Biedt bidirectionele synchronisatie voor documenten (documents_store) en sidecars (document_sidecars)
ter bescherming tegen dataverlies bij Render ephemeral container restarts en anti-resurrection
van verwijderde Git-documenten via autoritaire cloud-tombstones.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import urllib.error
import urllib.parse
import urllib.request

from doc_review_app.config import settings

logger = logging.getLogger(__name__)

# Dynamische degradatievlag (geactiveerd bij netwerkfouten / cold-start haperingen)
cloud_sync_degraded: bool = False

# Achtergrond threadpool voor non-blocking sidecar pushes
_thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cloud_sync_")


def _get_cloud_headers() -> Dict[str, str]:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


def check_connection() -> bool:
    """Probe connectivity to Supabase and reset degradation flag if available."""
    global cloud_sync_degraded
    if not settings.supabase_url or not settings.supabase_anon_key:
        return False
    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/documents_store?select=filename&limit=1"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
    }
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status in (200, 204):
                cloud_sync_degraded = False
                return True
            return False
    except Exception as e:
        logger.debug("Supabase connectivity probe failed: %s", e)
        return False


def _execute_push(filename: str, sidecar_data: Dict[str, Any]) -> bool:
    """Execute raw HTTP POST upsert to Supabase document_sidecars."""
    global cloud_sync_degraded
    if not settings.supabase_url or not settings.supabase_anon_key:
        return False

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/document_sidecars"
    headers = _get_cloud_headers()

    # Basename sanitization & target doc resolution
    base_name = Path(filename).name
    stripped = base_name[:-14] if base_name.endswith(".comments.json") else base_name
    target_doc = sidecar_data.get("document_name") or sidecar_data.get("filename") or (stripped if "." in stripped else f"{stripped}.md")

    payload = {
        "filename": target_doc,
        "sidecar_json": sidecar_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201, 204):
                logger.debug("Successfully pushed sidecar '%s' to cloud.", target_doc)
                cloud_sync_degraded = False
                return True
            logger.warning("Cloud push for '%s' returned status %d", target_doc, resp.status)
            return False
    except Exception as e:
        logger.warning("Cloud push for '%s' failed: %s", target_doc, e)
        cloud_sync_degraded = True
        return False


def push_sidecar_to_cloud(filename: str, sidecar_data: Dict[str, Any], background: bool = True) -> bool:
    """Push document sidecar JSON to Supabase cloud storage.

    If background=True, offloads HTTP request to background daemon thread
    to guarantee zero latency on user requests.
    """
    if background:
        _thread_pool.submit(_execute_push, filename, sidecar_data)
        return True
    return _execute_push(filename, sidecar_data)


def push_document_to_cloud(filename: str, content: str, file_size: int, sha256_hash: str) -> bool:
    """Upsert full document content and metadata to Supabase documents_store."""
    global cloud_sync_degraded
    if not settings.supabase_url or not settings.supabase_anon_key:
        return False

    clean_name = Path(filename).name
    normalized_content = content.replace("\r\n", "\n").replace("\r", "\n")
    computed_hash = sha256_hash or hashlib.sha256(normalized_content.encode("utf-8")).hexdigest()

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/documents_store"
    headers = _get_cloud_headers()
    payload = {
        "filename": clean_name,
        "content": content,
        "sha256": computed_hash,
        "file_size": file_size,
        "is_deleted": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status in (200, 201, 204):
                logger.info("Successfully pushed document '%s' to Supabase cloud.", clean_name)
                cloud_sync_degraded = False
                return True
            logger.warning("Cloud document push for '%s' returned status %d", clean_name, resp.status)
            return False
    except Exception as e:
        logger.warning("Failed pushing document '%s' to Supabase cloud: %s", clean_name, e)
        cloud_sync_degraded = True
        return False


def delete_document_from_cloud(filename: str) -> bool:
    """Mark document as is_deleted=True (tombstone) and clean up sidecars in Supabase."""
    global cloud_sync_degraded
    if not settings.supabase_url or not settings.supabase_anon_key:
        return False

    clean_name = Path(filename).name
    headers = _get_cloud_headers()

    # 1. Post tombstone to documents_store
    store_url = f"{settings.supabase_url.rstrip('/')}/rest/v1/documents_store"
    tombstone_payload = {
        "filename": clean_name,
        "is_deleted": True,
        "content": "",
        "sha256": "",
        "file_size": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    success = False
    try:
        req = urllib.request.Request(
            store_url,
            data=json.dumps(tombstone_payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status in (200, 201, 204):
                logger.info("Tombstone registered for '%s' in Supabase documents_store.", clean_name)
                success = True
    except Exception as e:
        logger.warning("Failed creating tombstone for '%s' in Supabase: %s", clean_name, e)
        cloud_sync_degraded = True
        return False

    # 2. Delete corresponding sidecar from document_sidecars
    try:
        del_url = f"{settings.supabase_url.rstrip('/')}/rest/v1/document_sidecars?filename=eq.{urllib.parse.quote(clean_name, safe='')}"
        del_headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {settings.supabase_anon_key}",
        }
        del_req = urllib.request.Request(del_url, headers=del_headers, method="DELETE")
        with urllib.request.urlopen(del_req, timeout=5) as del_resp:
            logger.info("Purged sidecar for '%s' from Supabase (status %d).", clean_name, del_resp.status)
    except Exception as e:
        logger.debug("Sidecar deletion for '%s' in Supabase: %s", clean_name, e)

    cloud_sync_degraded = False
    return success


def pull_documents_from_cloud(documents_dir: Optional[Path] = None) -> Tuple[int, Set[str], Set[str]]:
    """Fetch all documents and tombstones from Supabase documents_store.

    Returns:
        Tuple[int, Set[str], Set[str]]: (pulled_count, tombstone_filenames_set, tombstone_stems_set)
    """
    global cloud_sync_degraded
    if not settings.supabase_url or not settings.supabase_anon_key:
        return 0, set(), set()

    target_dir = documents_dir or settings.documents_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/documents_store?select=filename,content,sha256,file_size,is_deleted,updated_at"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
    }

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                logger.warning("Cloud documents pull failed with status %d", resp.status)
                cloud_sync_degraded = True
                return 0, set(), set()
            rows: List[Dict[str, Any]] = json.loads(resp.read().decode("utf-8"))
            cloud_sync_degraded = False
    except Exception as e:
        logger.warning("Failed to pull documents from Supabase cloud: %s", e)
        cloud_sync_degraded = True
        return 0, set(), set()

    pulled_count = 0
    tombstone_filenames_set: Set[str] = set()
    tombstone_stems_set: Set[str] = set()

    for row in rows:
        raw_name = row.get("filename") or ""
        # Strict validation: document filename in cloud must be a clean basename without directory components
        if "/" in raw_name or "\\" in raw_name or ".." in raw_name or "\x00" in raw_name:
            logger.warning("Path traversal attempt blocked for document '%s'", raw_name)
            continue

        clean_name = Path(raw_name).name.strip()
        if not clean_name:
            continue

        target_path = (target_dir / clean_name).resolve()
        if not target_path.is_relative_to(target_dir.resolve()):
            logger.warning("Path traversal attempt blocked for document '%s'", raw_name)
            continue

        is_deleted = bool(row.get("is_deleted", False))
        stem = target_path.stem
        ext = target_path.suffix.lower()
        is_md = ext in [".md", ".markdown"]

        if is_deleted:
            tombstone_filenames_set.add(clean_name)

            # Check if an active markdown sibling exists
            has_active_md_sibling = any(
                r.get("filename") != clean_name
                and Path(str(r.get("filename", ""))).stem == stem
                and Path(str(r.get("filename", ""))).suffix.lower() in [".md", ".markdown"]
                and not r.get("is_deleted", False)
                for r in rows
            )

            # If deleted file is markdown, or if no active markdown sibling remains, tombstone stem
            if is_md or not has_active_md_sibling:
                tombstone_stems_set.add(stem)

            # Physically unlink local document from disk if present (anti-resurrection)
            if target_path.exists():
                try:
                    target_path.unlink()
                    logger.info("Unlinked resurrected Git document '%s' per cloud tombstone.", clean_name)
                except Exception as e:
                    logger.error("Failed unlinking tombstoned document '%s': %s", clean_name, e)

            # Unlink unique sidecar
            unique_sidecar = target_dir / f"{clean_name}.comments.json"
            if unique_sidecar.exists():
                try:
                    unique_sidecar.unlink()
                    logger.info("Unlinked sidecar '%s' per cloud tombstone.", unique_sidecar.name)
                except Exception as e:
                    logger.error("Failed unlinking unique sidecar '%s': %s", unique_sidecar.name, e)

            # Unlink stem sidecar only if is_md or no active markdown sibling
            if is_md or not has_active_md_sibling:
                stem_sidecar = target_dir / f"{stem}.comments.json"
                if stem_sidecar.exists():
                    try:
                        stem_sidecar.unlink()
                        logger.info("Unlinked stem sidecar '%s' per cloud tombstone.", stem_sidecar.name)
                    except Exception as e:
                        logger.error("Failed unlinking stem sidecar '%s': %s", stem_sidecar.name, e)
            continue

        # Active document: restore / sync from cloud
        content = row.get("content", "")
        cloud_sha256 = row.get("sha256", "")
        should_write = False

        if not target_path.exists():
            should_write = True
        else:
            try:
                disk_bytes = target_path.read_bytes()
                disk_norm = disk_bytes.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
                disk_sha256 = hashlib.sha256(disk_norm.encode("utf-8")).hexdigest()
                if cloud_sha256 and disk_sha256 != cloud_sha256:
                    should_write = True
            except Exception:
                should_write = True

        if should_write:
            try:
                target_path.write_text(content, encoding="utf-8")
                pulled_count += 1
                logger.info("Restored document '%s' from Supabase cloud.", clean_name)
            except Exception as e:
                logger.error("Failed writing restored document '%s': %s", clean_name, e)

    return pulled_count, tombstone_filenames_set, tombstone_stems_set


def pull_sidecars_from_cloud(
    documents_dir: Optional[Path] = None,
    *,
    tombstone_filenames: Optional[Set[str]] = None,
    tombstone_stems: Optional[Set[str]] = None,
) -> int:
    """Fetch all sidecars from Supabase and write to documents_dir if newer or missing.

    Called on server boot (lifespan) to restore user comments after Render container restarts.
    """
    global cloud_sync_degraded
    if not settings.supabase_url or not settings.supabase_anon_key:
        return 0

    target_dir = documents_dir or settings.documents_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    tombstone_filenames_set = tombstone_filenames or set()
    tombstone_stems_set = tombstone_stems or set()

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/document_sidecars?select=filename,sidecar_json,updated_at"
    headers = _get_cloud_headers()

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status != 200:
                logger.warning("Cloud pull failed with status %d", resp.status)
                cloud_sync_degraded = True
                return 0
            rows: List[Dict[str, Any]] = json.loads(resp.read().decode("utf-8"))
            cloud_sync_degraded = False
    except Exception as e:
        logger.warning("Failed to pull sidecars from Supabase cloud: %s", e)
        cloud_sync_degraded = True
        return 0

    pulled_count = 0
    from doc_review_app.storage.json_storage import get_sidecar_path, read_sidecar

    for row in rows:
        doc_filename = row.get("filename")
        sidecar_data = row.get("sidecar_json")
        if not doc_filename or not isinstance(sidecar_data, dict):
            continue

        # Check against tombstones
        stem = Path(doc_filename).stem
        if (
            doc_filename in tombstone_filenames_set
            or ("." not in doc_filename and doc_filename in tombstone_stems_set)
            or (stem in tombstone_stems_set and "." in doc_filename and Path(doc_filename).suffix.lower() in [".md", ".markdown"])
        ):
            # Clean up any local sidecar on disk if tombstoned
            sc_path = get_sidecar_path(doc_filename, target_dir)
            if sc_path.exists():
                try:
                    sc_path.unlink()
                except Exception:
                    pass
            continue

        sidecar_path = get_sidecar_path(doc_filename, target_dir)
        should_write = False

        if not sidecar_path.exists():
            should_write = True
        else:
            try:
                local_data = read_sidecar(sidecar_path, filename_hint=doc_filename)
                local_anns = local_data.get("annotations", [])
                cloud_anns = sidecar_data.get("annotations", [])
                if len(cloud_anns) > len(local_anns):
                    should_write = True
                elif len(cloud_anns) == len(local_anns) and len(cloud_anns) > 0:
                    cloud_total_comments = sum(len(a.get("comments", [])) for a in cloud_anns)
                    local_total_comments = sum(len(a.get("comments", [])) for a in local_anns)
                    if cloud_total_comments > local_total_comments:
                        should_write = True
            except Exception:
                should_write = True

        if should_write:
            try:
                temp_file = sidecar_path.with_suffix(".tmp.json")
                temp_file.write_text(json.dumps(sidecar_data, indent=2, ensure_ascii=False), encoding="utf-8")
                temp_file.replace(sidecar_path)
                pulled_count += 1
                logger.info("Restored sidecar from cloud for '%s' (%d annotations).", doc_filename, len(sidecar_data.get("annotations", [])))
            except Exception as e:
                logger.error("Failed writing restored sidecar for '%s': %s", doc_filename, e)

    return pulled_count
