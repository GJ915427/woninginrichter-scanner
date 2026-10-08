"""Cloud Persistence and Synchronization Engine for Document Review Sidecars.

Synchronizes local .comments.json sidecars with Supabase PostgreSQL storage (document_sidecars table),
guaranteeing comment persistence across Render ephemeral container restarts and sleep cycles.
Uses pure Python standard library (urllib.request) to ensure zero new runtime dependencies.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

from doc_review_app.config import settings

logger = logging.getLogger(__name__)

# Dedicated daemon executor for non-blocking asynchronous cloud uploads
_cloud_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="cloud_sync_worker")


def _get_cloud_headers() -> Dict[str, str]:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


def _execute_push(filename: str, sidecar_data: Dict[str, Any]) -> bool:
    """Execute raw HTTP POST upsert to Supabase."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        return False

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/document_sidecars"
    headers = _get_cloud_headers()
    
    # Standardize filename to document name
    doc_filename = filename
    if doc_filename.endswith(".comments.json"):
        doc_filename = doc_filename.replace(".comments.json", ".md")

    payload = {
        "filename": doc_filename,
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
            if resp.status in (200, 201):
                logger.debug("Successfully pushed sidecar '%s' to cloud.", doc_filename)
                return True
            logger.warning("Cloud push for '%s' returned status %d", doc_filename, resp.status)
            return False
    except Exception as e:
        logger.warning("Cloud push for '%s' failed: %s", doc_filename, e)
        return False


def push_sidecar_to_cloud(
    filename: str,
    sidecar_data: Dict[str, Any],
    background: bool = True,
) -> bool:
    """Push document sidecar JSON to Supabase cloud storage.
    
    If background=True, offloads HTTP request to background daemon thread
    to guarantee zero latency on user requests.
    """
    if background:
        _cloud_executor.submit(_execute_push, filename, sidecar_data)
        return True
    return _execute_push(filename, sidecar_data)


def pull_sidecars_from_cloud(documents_dir: Optional[Path] = None) -> int:
    """Fetch all sidecars from Supabase and write to documents_dir if newer or missing.
    
    Called on server boot (lifespan) to restore user comments after Render container restarts.
    """
    if not settings.supabase_url or not settings.supabase_anon_key:
        return 0

    target_dir = documents_dir or settings.documents_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/document_sidecars?select=filename,sidecar_json,updated_at"
    headers = _get_cloud_headers()

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status != 200:
                logger.warning("Cloud pull failed with status %d", resp.status)
                return 0
            rows: List[Dict[str, Any]] = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning("Failed to pull sidecars from Supabase cloud: %s", e)
        return 0

    pulled_count = 0
    from doc_review_app.storage.json_storage import get_sidecar_path, read_sidecar, write_sidecar_atomic

    for row in rows:
        filename = row.get("filename")
        sidecar_data = row.get("sidecar_json")
        if not filename or not isinstance(sidecar_data, dict):
            continue

        sidecar_path = get_sidecar_path(filename, target_dir)
        should_write = False

        if not sidecar_path.exists():
            should_write = True
        else:
            try:
                local_data = read_sidecar(sidecar_path, filename_hint=filename)
                local_anns = local_data.get("annotations", [])
                cloud_anns = sidecar_data.get("annotations", [])
                # If cloud has more annotations, or local is empty, or cloud timestamp is newer
                if len(cloud_anns) > len(local_anns):
                    should_write = True
                elif len(cloud_anns) == len(local_anns) and len(cloud_anns) > 0:
                    # Compare comment counts within annotations
                    cloud_total_comments = sum(len(a.get("comments", [])) for a in cloud_anns)
                    local_total_comments = sum(len(a.get("comments", [])) for a in local_anns)
                    if cloud_total_comments > local_total_comments:
                        should_write = True
            except Exception:
                should_write = True

        if should_write:
            try:
                # Write to disk atomically without re-triggering cloud push loop
                temp_file = sidecar_path.with_suffix(".tmp.json")
                temp_file.write_text(json.dumps(sidecar_data, indent=2, ensure_ascii=False), encoding="utf-8")
                temp_file.replace(sidecar_path)
                pulled_count += 1
                logger.info("Restored sidecar from cloud for '%s' (%d annotations).", filename, len(sidecar_data.get("annotations", [])))
            except Exception as e:
                logger.error("Failed writing restored sidecar for '%s': %s", filename, e)

    return pulled_count
