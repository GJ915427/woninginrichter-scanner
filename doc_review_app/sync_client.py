"""Standalone Local Synchronization Utility for Document Review Web Application.

Monitors a local documents directory for Markdown (.md) and plain text (.txt) files,
normalizes line endings to LF, calculates SHA-256 digests, and synchronizes files
with the FastAPI server via POST /api/documents/sync.

Modes:
  --once  : Single scan and sync pass, then exits immediately.
  --watch : Continuous polling loop at specified interval (default 1.0s).

Usage:
  python doc_review_app/sync_client.py --once --dir ./local_documents --token <SESSION_TOKEN>
  python doc_review_app/sync_client.py --watch --server http://127.0.0.1:8000 --username reviewer1 --password secret
"""

import argparse
import hashlib
import logging
import os
from pathlib import Path
import sys
import time
from typing import Dict, List, Optional, Tuple
import urllib.error
import urllib.parse
import urllib.request
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("sync_client")

SUPPORTED_EXTENSIONS = {".md", ".txt"}


def normalize_line_endings(content: str) -> str:
    """Standardize CRLF (\\r\\n) and CR (\\r) line endings to LF (\\n)."""
    if not content:
        return ""
    return content.replace("\r\n", "\n").replace("\r", "\n")


def compute_sha256(content: str) -> str:
    """Calculate SHA-256 hex digest of UTF-8 content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class SyncClient:
    """Synchronization client tracking local file states and pushing updates to server."""

    def __init__(
        self,
        watch_dir: Path,
        server_url: str = "http://127.0.0.1:8000",
        token: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        interval: float = 1.0,
    ) -> None:
        self.watch_dir = Path(watch_dir)
        self.server_url = server_url.rstrip("/")
        self.token = token
        self.username = username
        self.password = password
        self.interval = interval
        self.hash_cache: Dict[str, str] = {}

    def authenticate_if_needed(self) -> bool:
        """Authenticate with username/password if bearer token is not provided."""
        if self.token:
            return True
        if not self.username or not self.password:
            logger.warning("No token or credentials provided. Requests may fail with 401.")
            return False

        login_url = f"{self.server_url}/api/auth/login"
        payload = json.dumps({"username": self.username, "password": self.password}).encode("utf-8")
        req = urllib.request.Request(
            login_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.token = data.get("token")
                logger.info(f"Authenticated successfully as '{self.username}'")
                return True
        except urllib.error.HTTPError as e:
            logger.error(f"Authentication failed (HTTP {e.code}): {e.reason}")
            return False
        except Exception as e:
            logger.error(f"Network error during authentication: {e}")
            return False

    def scan_eligible_files(self) -> List[Path]:
        """Scan directory for eligible .md and .txt files, ignoring subdirectories."""
        if not self.watch_dir.exists():
            logger.error(f"Directory does not exist: {self.watch_dir}")
            return []
        if not self.watch_dir.is_dir():
            logger.error(f"Specified path is not a directory: {self.watch_dir}")
            return []

        eligible = []
        for item in self.watch_dir.iterdir():
            if item.is_file() and item.suffix.lower() in SUPPORTED_EXTENSIONS:
                eligible.append(item)
        return sorted(eligible, key=lambda p: p.name)

    def sync_file(self, file_path: Path) -> Optional[Dict[str, str]]:
        """Read, normalize, check hash cache, and push file if changed."""
        try:
            raw_content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            try:
                # Fallback with error handling
                raw_content = file_path.read_text(encoding="latin-1")
            except Exception as e:
                logger.error(f"Could not read file '{file_path.name}': {e}")
                return None
        except Exception as e:
            logger.error(f"I/O error reading '{file_path.name}': {e}")
            return None

        normalized = normalize_line_endings(raw_content)
        content_hash = compute_sha256(normalized)

        # Check local hash cache to skip redundant network calls
        if self.hash_cache.get(file_path.name) == content_hash:
            logger.debug(f"Skipping unchanged file '{file_path.name}' ({content_hash[:8]})")
            return None

        fmt = "markdown" if file_path.suffix.lower() == ".md" else "text"
        payload_data = {
            "filename": file_path.name,
            "content": normalized,
            "format": fmt,
        }
        payload_bytes = json.dumps(payload_data).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        sync_url = f"{self.server_url}/api/documents/sync"
        req = urllib.request.Request(
            sync_url,
            data=payload_bytes,
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                action = resp_data.get("action", "synced")
                doc_id = resp_data.get("id")
                # Update hash cache
                self.hash_cache[file_path.name] = content_hash
                logger.info(
                    f"Successfully synced '{file_path.name}' (action={action}, id={doc_id}, hash={content_hash[:8]})"
                )
                return resp_data
        except urllib.error.HTTPError as e:
            if e.code == 401:
                logger.error(f"Unauthorized (401) syncing '{file_path.name}'. Check token/credentials.")
            elif e.code == 400:
                logger.error(f"Bad request (400) syncing '{file_path.name}': {e.reason}")
            else:
                logger.error(f"HTTP error {e.code} syncing '{file_path.name}': {e.reason}")
            return None
        except urllib.error.URLError as e:
            logger.warning(f"Server connection failed for '{file_path.name}': {e.reason}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error syncing '{file_path.name}': {e}")
            return None

    def sync_once(self) -> int:
        """Perform a single scan-and-sync pass across the monitored folder."""
        eligible_files = self.scan_eligible_files()
        if not eligible_files:
            logger.info(f"No eligible documents (.md, .txt) found in {self.watch_dir}")
            return 0

        synced_count = 0
        for f in eligible_files:
            result = self.sync_file(f)
            if result:
                synced_count += 1
        return synced_count

    def watch(self) -> None:
        """Run continuous monitoring loop."""
        logger.info(
            f"Starting sync_client watcher on directory '{self.watch_dir}' (interval={self.interval}s)"
        )
        self.authenticate_if_needed()
        try:
            while True:
                self.sync_once()
                time.sleep(self.interval)
        except KeyboardInterrupt:
            logger.info("Sync client watcher terminated by user.")


def build_parser() -> argparse.ArgumentParser:
    """Build and configure argument parser for CLI execution."""
    parser = argparse.ArgumentParser(
        description="Local document synchronization utility for Document Review Web Application."
    )
    parser.add_argument(
        "--dir",
        dest="dir",
        default="doc_review_app/local_documents",
        help="Path to monitored local documents directory (default: doc_review_app/local_documents)",
    )
    parser.add_argument(
        "--server",
        dest="server",
        default="http://127.0.0.1:8095",
        help="Target application server URL (default: http://127.0.0.1:8095)",
    )
    parser.add_argument(
        "--token",
        dest="token",
        default=os.getenv("SYNC_TOKEN") or os.getenv("AUTH_TOKEN"),
        help="Authentication session bearer token",
    )
    parser.add_argument(
        "--username",
        dest="username",
        default=os.getenv("SYNC_USERNAME"),
        help="Username for authentication",
    )
    parser.add_argument(
        "--password",
        dest="password",
        default=os.getenv("SYNC_PASSWORD"),
        help="Password for authentication",
    )
    parser.add_argument(
        "--interval",
        dest="interval",
        type=float,
        default=1.0,
        help="Polling interval in seconds for --watch mode (default: 1.0)",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--once",
        dest="once",
        action="store_true",
        default=True,
        help="Run single synchronization pass and exit (default)",
    )
    group.add_argument(
        "--watch",
        dest="watch",
        action="store_true",
        help="Run continuous polling watch loop",
    )
    return parser


def main() -> int:
    """CLI entrypoint."""
    parser = build_parser()
    args = parser.parse_args()

    watch_path = Path(args.dir)
    client = SyncClient(
        watch_dir=watch_path,
        server_url=args.server,
        token=args.token,
        username=args.username,
        password=args.password,
        interval=args.interval,
    )

    if args.watch:
        client.watch()
        return 0
    else:
        client.authenticate_if_needed()
        synced = client.sync_once()
        logger.info(f"Sync complete. {synced} file(s) synchronized.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
