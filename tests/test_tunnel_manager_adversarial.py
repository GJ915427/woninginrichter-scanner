"""
test_tunnel_manager_adversarial.py

Empirical Adversarial Challenger Test Suite for scripts/tunnel_manager.py:
- URL Extraction regex stress & boundary testing
- Atomic file writing and thread safety
- Process supervisor lifecycle, restart counts, and max_restarts enforcement
- Signal handling & clean shutdown
"""

import os
import sys
import time
import tempfile
import threading
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

# Add workspace root to sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from scripts.tunnel_manager import CloudflareTunnelWatchdog, TRYCLOUDFLARE_REGEX


class TestTunnelManagerAdversarial(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.output_file = Path(self.temp_dir.name) / "tunnel_url.txt"

    def tearDown(self):
        self.temp_dir.cleanup()

    # -------------------------------------------------------------
    # SUITE 1: URL Extraction Regex Stress Testing
    # -------------------------------------------------------------
    def test_regex_standard_cloudflared_logs(self):
        log_line = "2026-09-30T21:15:32Z INF +--------------------------------------------------------------------------------------------+"
        self.assertIsNone(CloudflareTunnelWatchdog.extract_tunnel_url(log_line))

        log_url = "2026-09-30T21:15:32Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |"
        self.assertIsNone(CloudflareTunnelWatchdog.extract_tunnel_url(log_url))

        target_line = "2026-09-30T21:15:32Z INF |  https://alpha-beta-gamma-123.trycloudflare.com                                    |"
        extracted = CloudflareTunnelWatchdog.extract_tunnel_url(target_line)
        self.assertEqual(extracted, "https://alpha-beta-gamma-123.trycloudflare.com")

    def test_regex_adversarial_variations(self):
        cases = [
            ("prefix https://test-domain.trycloudflare.com suffix", "https://test-domain.trycloudflare.com"),
            ("brackets [https://sub-123.trycloudflare.com/path]", "https://sub-123.trycloudflare.com"),
            ("multiple: https://first.trycloudflare.com and https://second.trycloudflare.com", "https://first.trycloudflare.com"),
            ("http://unsecure.trycloudflare.com", None),  # quick tunnels are always HTTPS
            ("https://notcloudflare.com", None),
            ("https://malicious-trycloudflare.com.attacker.org", None),
            ("https://trycloudflare.com", None),  # Needs subdomain
            ("random junk @#!$%", None),
        ]
        for line, expected in cases:
            res = CloudflareTunnelWatchdog.extract_tunnel_url(line)
            self.assertEqual(res, expected, f"Failed for input: {line}")

    # -------------------------------------------------------------
    # SUITE 2: Atomic File Write & Thread Safety
    # -------------------------------------------------------------
    def test_atomic_file_write_integrity(self):
        dog = CloudflareTunnelWatchdog(
            target_url="http://127.0.0.1:8080",
            cloudflared_path=sys.executable,
            output_file=str(self.output_file),
        )
        test_url = "https://safe-atomic-test.trycloudflare.com"
        dog.write_tunnel_url(test_url)

        self.assertTrue(self.output_file.is_file())
        content = self.output_file.read_text(encoding="utf-8").strip()
        self.assertEqual(content, test_url)
        self.assertEqual(dog.active_url, test_url)

        # Temporary file must not linger
        tmp_file = self.output_file.with_suffix(".tmp")
        self.assertFalse(tmp_file.exists())

    def test_concurrent_writers_thread_safety(self):
        dog = CloudflareTunnelWatchdog(
            target_url="http://127.0.0.1:8080",
            cloudflared_path=sys.executable,
            output_file=str(self.output_file),
        )
        errors = []

        def worker(idx):
            try:
                for i in range(25):
                    dog.write_tunnel_url(f"https://worker-{idx}-seq-{i}.trycloudflare.com")
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(t,)) for t in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Encountered thread write errors: {errors}")
        self.assertTrue(self.output_file.is_file())
        final_content = self.output_file.read_text(encoding="utf-8").strip()
        self.assertTrue(final_content.startswith("https://worker-"))
        self.assertTrue(final_content.endswith(".trycloudflare.com"))

    # -------------------------------------------------------------
    # SUITE 3: Supervisor Process Lifecycle & Restart Limits
    # -------------------------------------------------------------
    def test_max_restarts_exhaustion(self):
        dog = CloudflareTunnelWatchdog(
            target_url="http://127.0.0.1:8080",
            cloudflared_path=sys.executable,
            output_file=str(self.output_file),
            restart_delay=0.01,
            max_restarts=3,
        )

        with patch.object(dog, "spawn_tunnel") as mock_spawn:
            mock_proc = MagicMock()
            mock_proc.pid = 99999
            mock_proc.wait.return_value = 1
            mock_spawn.return_value = mock_proc

            start_t = time.time()
            dog.run()
            elapsed = time.time() - start_t

            self.assertEqual(dog.restart_count, 3)
            self.assertEqual(mock_spawn.call_count, 3)
            self.assertLess(elapsed, 2.0, "Watchdog should promptly terminate after max_restarts")

    def test_clean_stop_signal_shutdown(self):
        dog = CloudflareTunnelWatchdog(
            target_url="http://127.0.0.1:8080",
            cloudflared_path=sys.executable,
            output_file=str(self.output_file),
            restart_delay=0.01,
            max_restarts=10,
        )

        mock_proc = MagicMock()
        mock_proc.pid = 88888
        mock_proc.poll.return_value = None

        dog.current_process = mock_proc
        dog.stop()

        self.assertTrue(dog.shutdown_requested)
        mock_proc.terminate.assert_called_once()
        mock_proc.wait.assert_called_once_with(timeout=3.0)

    # -------------------------------------------------------------
    # SUITE 4: Executable Discovery
    # -------------------------------------------------------------
    def test_find_cloudflared_nonexistent_explicit_path(self):
        with self.assertRaises(FileNotFoundError):
            CloudflareTunnelWatchdog.find_cloudflared(r"C:\nonexistent\cloudflared.exe")


if __name__ == "__main__":
    unittest.main(verbosity=2)
