#!/usr/bin/env python3
"""
scripts/tunnel_manager.py — Self-Healing Cloudflare Tunnel Watchdog

Watches and supervises the Cloudflare Tunnel (`cloudflared.exe`) process:
- Spawns: cloudflared.exe tunnel --url <target_url>
- Monitors stderr stream in real-time to capture the assigned https://*.trycloudflare.com URL
- Writes the live URL to `tunnel_url.txt` for consumption by frontend / backend
- Automatically restarts cloudflared on unexpected crashes or network disconnections
- Handles SIGINT, SIGTERM, and SIGBREAK gracefully, terminating child processes cleanly.
"""

import argparse
import logging
import os
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

# Regular expression to extract the quick tunnel public URL
TRYCLOUDFLARE_REGEX = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [TunnelManager] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("TunnelManager")


class CloudflareTunnelWatchdog:
    """Self-healing supervisor for cloudflared quick tunnel."""

    def __init__(
        self,
        target_url: str = "http://127.0.0.1:8080",
        cloudflared_path: Optional[str] = None,
        output_file: str = "tunnel_url.txt",
        restart_delay: float = 2.0,
        max_restarts: Optional[int] = None,
    ):
        self.target_url = target_url
        self.output_file = Path(output_file).resolve()
        self.restart_delay = restart_delay
        self.max_restarts = max_restarts

        self.cloudflared_bin = self.find_cloudflared(cloudflared_path)
        self.current_process: Optional[subprocess.Popen] = None
        self.active_url: Optional[str] = None
        self.shutdown_requested = False
        self.restart_count = 0
        self._lock = threading.Lock()

        # Register OS signal handlers for graceful shutdown
        self._setup_signals()

    @staticmethod
    def find_cloudflared(explicit_path: Optional[str] = None) -> Path:
        """Locates the cloudflared executable."""
        if explicit_path:
            p = Path(explicit_path).resolve()
            if p.is_file():
                return p
            raise FileNotFoundError(f"Specified cloudflared executable not found: {explicit_path}")

        # Search priority:
        # 1. Project workspace root
        # 2. scripts/ directory
        # 3. System PATH
        candidates = [
            Path(__file__).resolve().parent.parent / "cloudflared.exe",
            Path(__file__).resolve().parent.parent / "cloudflared",
            Path(__file__).resolve().parent / "cloudflared.exe",
            Path(__file__).resolve().parent / "cloudflared",
        ]
        for candidate in candidates:
            if candidate.is_file():
                return candidate

        # Check system PATH
        import shutil

        which_path = shutil.which("cloudflared")
        if which_path:
            return Path(which_path).resolve()

        raise FileNotFoundError(
            "Could not locate 'cloudflared.exe' in project root or system PATH. "
            "Please install cloudflared or specify --cloudflared-path."
        )

    @classmethod
    def extract_tunnel_url(cls, text: str) -> Optional[str]:
        """Extracts the first matching trycloudflare.com URL from log output."""
        match = TRYCLOUDFLARE_REGEX.search(text)
        if match:
            return match.group(0)
        return None

    def write_tunnel_url(self, url: str) -> None:
        """Atomically writes the active tunnel URL to the designated output file."""
        with self._lock:
            self.active_url = url
            temp_file = self.output_file.with_suffix(".tmp")
            temp_file.write_text(f"{url}\n", encoding="utf-8")
            temp_file.replace(self.output_file)
            logger.info("Saved tunnel URL to %s: %s", self.output_file, url)

    def _setup_signals(self) -> None:
        """Registers termination signals for graceful shutdown."""
        try:
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
            if hasattr(signal, "SIGBREAK"):
                signal.signal(signal.SIGBREAK, self._signal_handler)
        except (ValueError, AttributeError) as err:
            logger.warning("Could not set up signal handlers: %s", err)

    def _signal_handler(self, signum, frame) -> None:
        signame = signal.Signals(signum).name if hasattr(signal, "Signals") else str(signum)
        logger.info("Received termination signal %s. Shutting down tunnel supervisor...", signame)
        self.stop()
        sys.exit(0)

    def _stream_reader(self, stream) -> None:
        """Reads process stderr/stdout asynchronously and inspects for tunnel URL."""
        try:
            for line_bytes in iter(stream.readline, b""):
                if not line_bytes:
                    break
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                # Cloudflared log inspection
                url = self.extract_tunnel_url(line)
                if url and url != self.active_url:
                    self.write_tunnel_url(url)

                # Output log line
                if "INF" in line or "ERR" in line or "trycloudflare" in line:
                    logger.debug("cloudflared: %s", line)
        except Exception as err:
            if not self.shutdown_requested:
                logger.error("Error reading cloudflared log stream: %s", err)
        finally:
            stream.close()

    def spawn_tunnel(self) -> subprocess.Popen:
        """Launches the cloudflared child process."""
        cmd = [
            str(self.cloudflared_bin),
            "tunnel",
            "--url",
            self.target_url,
        ]
        logger.info("Spawning tunnel process: %s", " ".join(cmd))

        # Windows-specific process flags: prevent Ctrl+C propagation if desired
        creationflags = 0
        if sys.platform == "win32" and hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=creationflags,
        )

        # Launch reader threads for stdout and stderr
        t_err = threading.Thread(target=self._stream_reader, args=(proc.stderr,), daemon=True)
        t_out = threading.Thread(target=self._stream_reader, args=(proc.stdout,), daemon=True)
        t_err.start()
        t_out.start()

        return proc

    def stop(self) -> None:
        """Terminates the active cloudflared child process."""
        self.shutdown_requested = True
        with self._lock:
            if self.current_process and self.current_process.poll() is None:
                logger.info("Terminating cloudflared process (PID %d)...", self.current_process.pid)
                try:
                    self.current_process.terminate()
                    self.current_process.wait(timeout=3.0)
                except (subprocess.TimeoutExpired, OSError):
                    logger.warning("Process did not exit cleanly, killing...")
                    try:
                        self.current_process.kill()
                        self.current_process.wait(timeout=2.0)
                    except OSError:
                        pass
                logger.info("cloudflared process terminated.")

    def run(self) -> None:
        """Main self-healing watchdog loop."""
        logger.info(
            "Starting Cloudflare Tunnel Watchdog (Target: %s, Executable: %s)",
            self.target_url,
            self.cloudflared_bin,
        )

        while not self.shutdown_requested:
            try:
                self.current_process = self.spawn_tunnel()
                pid = self.current_process.pid
                logger.info("Tunnel running under PID %d", pid)

                # Monitor process until exit
                exit_code = self.current_process.wait()

                if self.shutdown_requested:
                    logger.info("Tunnel shutdown complete.")
                    break

                self.restart_count += 1
                logger.warning(
                    "cloudflared exited unexpectedly with code %d. Restart count: %d",
                    exit_code,
                    self.restart_count,
                )

                if self.max_restarts is not None and self.restart_count >= self.max_restarts:
                    logger.error("Max restarts (%d) reached. Exiting watchdog loop.", self.max_restarts)
                    break

                logger.info("Restarting cloudflared in %.1f seconds...", self.restart_delay)
                time.sleep(self.restart_delay)

            except Exception as err:
                if self.shutdown_requested:
                    break
                logger.error("Unexpected error in watchdog loop: %s", err)
                time.sleep(self.restart_delay)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Self-healing watchdog for Cloudflare Quick Tunnel."
    )
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8080",
        help="Local backend server URL to expose (default: http://127.0.0.1:8080)",
    )
    parser.add_argument(
        "--cloudflared-path",
        default=None,
        help="Explicit path to cloudflared executable",
    )
    parser.add_argument(
        "--output-file",
        default="tunnel_url.txt",
        help="Path where extracted https://*.trycloudflare.com URL is stored (default: tunnel_url.txt)",
    )
    parser.add_argument(
        "--restart-delay",
        type=float,
        default=2.0,
        help="Delay in seconds before restarting on crash (default: 2.0)",
    )
    parser.add_argument(
        "--max-restarts",
        type=int,
        default=None,
        help="Maximum restart attempts before stopping (default: infinite)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    watchdog = CloudflareTunnelWatchdog(
        target_url=args.url,
        cloudflared_path=args.cloudflared_path,
        output_file=args.output_file,
        restart_delay=args.restart_delay,
        max_restarts=args.max_restarts,
    )
    watchdog.run()
