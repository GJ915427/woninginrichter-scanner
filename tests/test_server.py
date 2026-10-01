#!/usr/bin/env python3
"""
Automated Test Suite for Hardened Woninginrichter 3D & IMU Scanner Upload Server.
Covers Python 3.14 PEP 594 compliance, path traversal defenses, session isolation,
socket-to-disk streaming, DoS limits, and CORS / W3C Private Network Access.
"""

import os
import sys
import json
import shutil
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from concurrent.futures import ThreadPoolExecutor

# Add parent directory to path so server can be imported directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server
from server import (
    UploadHandler,
    validate_and_sanitize_filename,
    validate_and_sanitize_session_id,
    ALLOWED_EXTENSIONS,
    MAX_CONTENT_LENGTH,
)


class TestServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a dedicated temp upload directory for isolated testing
        cls.test_dir = tempfile.mkdtemp(prefix="test_uploads_")
        UploadHandler.upload_dir = cls.test_dir
        UploadHandler.max_content_length = MAX_CONTENT_LENGTH

        # Start ThreadingHTTPServer on an ephemeral port (port 0)
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), UploadHandler)
        cls.port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        shutil.rmtree(cls.test_dir, ignore_errors=True)

    def _request(self, method: str, path: str, headers: dict | None = None, body: bytes | None = None):
        """Helper to send HTTP requests to the live running server."""
        conn = HTTPConnection('127.0.0.1', self.port, timeout=5)
        headers = headers or {}
        conn.request(method, path, body=body, headers=headers)
        res = conn.getresponse()
        data = res.read()
        conn.close()
        return res, data

    # -------------------------------------------------------------------------
    # a) Health Check Verification
    # -------------------------------------------------------------------------
    def test_health_check_returns_200_and_json(self):
        """Server starts and responds 200 to GET /health with status and version."""
        res, data = self._request('GET', '/health')
        self.assertEqual(res.status, 200)
        self.assertEqual(res.getheader('Access-Control-Allow-Origin'), '*')
        self.assertEqual(res.getheader('Content-Type'), 'application/json')
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'healthy')
        self.assertEqual(body.get('version'), '2.0.0')
        self.assertIn('storage', body)

    def test_root_and_status_endpoints(self):
        """GET /status returns 200 with healthy status, and GET / serves index.html."""
        res_status, data_status = self._request('GET', '/status')
        self.assertEqual(res_status.status, 200)
        body = json.loads(data_status.decode('utf-8'))
        self.assertEqual(body.get('status'), 'healthy')

        res_root, data_root = self._request('GET', '/')
        self.assertEqual(res_root.status, 200)
        self.assertIn('text/html', res_root.getheader('Content-Type', ''))
        self.assertIn(b'<!DOCTYPE html>', data_root)

    def test_unknown_endpoint_returns_404(self):
        """Unknown paths return 404 Not Found."""
        res, data = self._request('GET', '/nonexistent_endpoint')
        self.assertEqual(res.status, 404)
        res_post, _ = self._request('POST', '/nonexistent_endpoint')
        self.assertEqual(res_post.status, 404)

    # -------------------------------------------------------------------------
    # b) OPTIONS Preflight with CORS & Private Network Access (PNA)
    # -------------------------------------------------------------------------
    def test_options_preflight_returns_204_with_pna(self):
        """OPTIONS preflight returns 204 No Content with Access-Control-Allow-Private-Network: true."""
        headers = {
            'Origin': 'https://woninginrichter.github.io',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, X-Filename, X-Session-Id',
            'Access-Control-Request-Private-Network': 'true'
        }
        res, data = self._request('OPTIONS', '/upload', headers=headers)
        self.assertEqual(res.status, 204)
        self.assertEqual(res.getheader('Access-Control-Allow-Private-Network'), 'true')
        self.assertEqual(res.getheader('Access-Control-Allow-Origin'), '*')
        allow_methods = res.getheader('Access-Control-Allow-Methods')
        self.assertIn('POST', allow_methods)
        self.assertIn('GET', allow_methods)
        self.assertIn('OPTIONS', allow_methods)
        allow_headers = res.getheader('Access-Control-Allow-Headers')
        self.assertIn('Content-Type', allow_headers)
        self.assertIn('X-Filename', allow_headers)
        self.assertIn('X-Session-Id', allow_headers)

    # -------------------------------------------------------------------------
    # c) Valid File Upload & Session Isolation
    # -------------------------------------------------------------------------
    def test_valid_raw_stream_upload_and_session_isolation(self):
        """Valid file upload succeeds and saves inside isolated session directory."""
        content = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41"  # simulated mp4
        session_id = "scan_test_session_1001"
        headers = {
            'X-Filename': 'scan_video.mp4',
            'X-Session-Id': session_id,
            'Content-Type': 'video/mp4',
            'Content-Length': str(len(content))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=content)
        self.assertEqual(res.status, 200)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'success')
        self.assertEqual(body.get('session_id'), session_id)
        self.assertIn('scan_video.mp4', body.get('files', []))

        # Check file on disk in isolated session subdirectory
        expected_path = os.path.join(self.test_dir, session_id, 'scan_video.mp4')
        self.assertTrue(os.path.exists(expected_path))
        with open(expected_path, 'rb') as f:
            self.assertEqual(f.read(), content)

        # Upload JSON sensor log to the same session
        json_content = b'{"frames": 120, "imu_samples": 600}'
        headers_json = {
            'X-Filename': 'sensor_log.json',
            'X-Session-Id': session_id,
            'Content-Type': 'application/json',
            'Content-Length': str(len(json_content))
        }
        res2, data2 = self._request('POST', '/upload', headers=headers_json, body=json_content)
        self.assertEqual(res2.status, 200)

        # Verify both files coexist inside session directory without overwrite
        expected_json_path = os.path.join(self.test_dir, session_id, 'sensor_log.json')
        self.assertTrue(os.path.exists(expected_json_path))
        with open(expected_json_path, 'rb') as f:
            self.assertEqual(f.read(), json_content)
        with open(expected_path, 'rb') as f:
            self.assertEqual(f.read(), content)

    def test_valid_multipart_form_data_upload(self):
        """Valid multipart/form-data upload extracts and saves multiple files into session directory."""
        boundary = "----WebKitFormBoundaryX9YzABC12345678"
        session_id = "scan_multi_session_2002"
        body_parts = [
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="video"; filename="scan_video.mp4"\r\n',
            b'Content-Type: video/mp4\r\n\r\n',
            b'MP4_PAYLOAD_CHUNK_DATA_12345\r\n',
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="sensor_json"; filename="sensor_log.json"\r\n',
            b'Content-Type: application/json\r\n\r\n',
            b'{"session": "2002", "imu_hz": 100}\r\n',
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="sensor_csv"; filename="sensor_log.csv"\r\n',
            b'Content-Type: text/csv\r\n\r\n',
            b't,ax,ay,az\n0.01,0.0,0.0,9.81\r\n',
            f"--{boundary}--\r\n".encode()
        ]
        multipart_body = b"".join(body_parts)
        headers = {
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(multipart_body)),
            'X-Session-Id': session_id
        }
        res, data = self._request('POST', '/upload', headers=headers, body=multipart_body)
        self.assertEqual(res.status, 200)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'success')
        self.assertEqual(body.get('session_id'), session_id)
        self.assertEqual(len(body.get('files', [])), 3)

        # Confirm all 3 files exist on disk
        for fn in ('scan_video.mp4', 'sensor_log.json', 'sensor_log.csv'):
            p = os.path.join(self.test_dir, session_id, fn)
            self.assertTrue(os.path.exists(p), f"Expected file {fn} not found in {session_id}")

    # -------------------------------------------------------------------------
    # d) Path Traversal Defense Verification
    # -------------------------------------------------------------------------
    def test_path_traversal_attack_payloads_rejected_with_400(self):
        """Path traversal attack payloads (../../evil.txt, ..\\..\\evil.py, /etc/passwd, C:\\test.bat) are rejected (HTTP 400)."""
        attack_filenames = [
            '../../evil.txt',
            '..\\..\\evil.py',
            '/etc/passwd',
            'C:\\test.bat',
            '..\\test.mp4',
            '../scan.mp4',
            'sub/folder/scan.mp4',
            'sub\\folder\\scan.mp4',
            'scan\x00.mp4',
            '%2e%2e%2fevil.txt',
            '%2e%2e%5cevil.py',
            '..%2f..%2fpasswd'
        ]
        for payload in attack_filenames:
            with self.subTest(payload=payload):
                headers = {
                    'X-Filename': payload,
                    'X-Session-Id': 'traversal_attack_sess',
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': '14'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"exploit payload")
                self.assertEqual(res.status, 400, f"Payload '{payload}' was not rejected with HTTP 400, got {res.status}")
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'error')

                # Ensure no files were created outside the test root or in the workspace
                for evil in ('evil.txt', 'evil.py', 'test.bat', 'passwd'):
                    self.assertFalse(os.path.exists(evil), f"File {evil} was written to project root!")

    def test_multipart_path_traversal_rejected_with_400(self):
        """Path traversal embedded in multipart filename parameters is rejected with HTTP 400."""
        boundary = "----BoundarySecTest987"
        bad_multipart = b"".join([
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="video"; filename="../../evil.mp4"\r\n',
            b'Content-Type: video/mp4\r\n\r\n',
            b'ATTACK DATA\r\n',
            f"--{boundary}--\r\n".encode()
        ])
        headers = {
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(bad_multipart)),
            'X-Session-Id': 'sess_multi_attack'
        }
        res, data = self._request('POST', '/upload', headers=headers, body=bad_multipart)
        self.assertEqual(res.status, 400)
        self.assertFalse(os.path.exists('evil.mp4'))

    def test_session_id_path_traversal_rejected(self):
        """Malicious X-Session-Id headers with path traversal are rejected with HTTP 400."""
        bad_sessions = [
            '../../escaped_session',
            '..\\..\\escaped_session',
            '/root/session',
            'C:\\Windows\\session',
            'session\x00null'
        ]
        for bad_id in bad_sessions:
            with self.subTest(bad_id=bad_id):
                headers = {
                    'X-Filename': 'scan_video.mp4',
                    'X-Session-Id': bad_id,
                    'Content-Type': 'video/mp4',
                    'Content-Length': '4'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"data")
                self.assertEqual(res.status, 400)
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'error')

    # -------------------------------------------------------------------------
    # e) Disallowed File Extensions Rejected
    # -------------------------------------------------------------------------
    def test_disallowed_extensions_rejected(self):
        """Disallowed extensions (.py, .exe, .sh, .php, .zip, etc.) are rejected."""
        disallowed_files = [
            'exploit.py',
            'payload.exe',
            'install.sh',
            'shell.php',
            'scan.iso',
            'runner.bat',
            'firmware.bin',
            'report.pdf',
            'archive.tar.gz'
        ]
        for fn in disallowed_files:
            with self.subTest(filename=fn):
                headers = {
                    'X-Filename': fn,
                    'X-Session-Id': 'disallowed_ext_sess',
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': '8'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"disallow")
                self.assertIn(res.status, (400, 415), f"File {fn} was not rejected, got {res.status}")
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'error')

                # Confirm file was never written on disk
                target = os.path.join(self.test_dir, 'disallowed_ext_sess', fn)
                self.assertFalse(os.path.exists(target))

    # -------------------------------------------------------------------------
    # f) Over-limit Payload Returns HTTP 413
    # -------------------------------------------------------------------------
    def test_over_limit_payload_returns_413(self):
        """Over-limit payload (> 500MB Content-Length or streamed bytes) returns HTTP 413."""
        # Check 1: Content-Length declared above MAX_CONTENT_LENGTH (500MB)
        headers = {
            'X-Filename': 'large_scan.mp4',
            'Content-Length': str(500 * 1024 * 1024 + 1024),
            'Content-Type': 'video/mp4'
        }
        res, data = self._request('POST', '/upload', headers=headers, body=b"")
        self.assertEqual(res.status, 413)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'error')
        self.assertIn('Payload Too Large', body.get('error', ''))

        # Check 2: Actual streamed bytes exceed dynamic limit
        original_limit = UploadHandler.max_content_length
        UploadHandler.max_content_length = 1024  # Limit to 1KB for fast testing
        try:
            payload = b"X" * 2048
            headers2 = {
                'X-Filename': 'stream_limit.mp4',
                'X-Session-Id': 'stream_limit_sess',
                'Content-Length': '2048',
                'Content-Type': 'video/mp4'
            }
            res2, data2 = self._request('POST', '/upload', headers=headers2, body=payload)
            self.assertEqual(res2.status, 413)
            # Verify file was cleaned up on disk
            target = os.path.join(self.test_dir, 'stream_limit_sess', 'stream_limit.mp4')
            self.assertFalse(os.path.exists(target))
        finally:
            UploadHandler.max_content_length = original_limit

    # -------------------------------------------------------------------------
    # g) Multi-threaded Concurrency Verification
    # -------------------------------------------------------------------------
    def test_concurrent_uploads(self):
        """ThreadingHTTPServer processes concurrent upload requests in parallel without blocking."""
        def upload_worker(idx: int):
            session_id = f"concurrent_sess_{idx}"
            filename = f"scan_{idx}.mp4"
            content = f"sample content for thread {idx}".encode('utf-8')
            headers = {
                'X-Filename': filename,
                'X-Session-Id': session_id,
                'Content-Type': 'video/mp4',
                'Content-Length': str(len(content))
            }
            res, data = self._request('POST', '/upload', headers=headers, body=content)
            return res.status, session_id, filename, content

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(upload_worker, i) for i in range(5)]
            results = [f.result() for f in futures]

        for status, sess_id, fname, content in results:
            self.assertEqual(status, 200)
            file_on_disk = os.path.join(self.test_dir, sess_id, fname)
            self.assertTrue(os.path.exists(file_on_disk))
            with open(file_on_disk, 'rb') as f:
                self.assertEqual(f.read(), content)

    # -------------------------------------------------------------------------
    # h) Direct Unit Tests on Validator Functions
    # -------------------------------------------------------------------------
    def test_filename_validator_unit(self):
        """Direct unit verification of filename sanitization and extension whitelisting."""
        # Valid extensions
        for ext in ('.mp4', '.webm', '.json', '.csv', '.zip', '.MP4', '.WEBM', '.JSON', '.CSV', '.ZIP'):
            fn = f"valid_file{ext}"
            is_valid, sanitized, status, err = validate_and_sanitize_filename(fn)
            self.assertTrue(is_valid, f"Expected {fn} to be valid: {err}")
            self.assertEqual(status, 200)

        # Invalid extensions
        for ext in ('.py', '.exe', '.sh', '.php', '.txt', '.bat', '.iso'):
            fn = f"file{ext}"
            is_valid, sanitized, status, err = validate_and_sanitize_filename(fn)
            self.assertFalse(is_valid)
            self.assertEqual(status, 415)

        # Traversal and illegal characters
        for bad in ('', '   ', None, 'foo/bar.mp4', 'foo\\bar.mp4', '..', '../foo.mp4', 'foo\x00.mp4', 'evil;cmd.mp4'):
            is_valid, sanitized, status, err = validate_and_sanitize_filename(bad)
            self.assertFalse(is_valid)
            self.assertEqual(status, 400)

    def test_session_id_validator_unit(self):
        """Direct unit verification of session identifier sanitization."""
        # Auto-generation when None or empty
        is_valid, sid, status, _ = validate_and_sanitize_session_id(None)
        self.assertTrue(is_valid)
        self.assertTrue(sid.startswith('scan_'))

        # Valid custom session ID
        is_valid, sid, status, _ = validate_and_sanitize_session_id("scan_2026_room1")
        self.assertTrue(is_valid)
        self.assertEqual(sid, "scan_2026_room1")

        # Invalid session ID with traversal
        for bad in ('../evil', '..\\evil', 'C:\\bad', 'sess\x00id'):
            is_valid, sid, status, _ = validate_and_sanitize_session_id(bad)
            self.assertFalse(is_valid)
            self.assertEqual(status, 400)

    # -------------------------------------------------------------------------
    # Milestone 3 & 4: Streaming SHA-256 & Authorized ZIP Tests
    # -------------------------------------------------------------------------
    def test_valid_zip_raw_stream_upload(self):
        """Authorized .zip offline fallback archive upload succeeds with HTTP 200."""
        # Minimal valid PKZIP payload
        zip_content = (
            b"PK\x03\x04\x14\x00\x00\x00\x00\x00!\xa6nc\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x04\x00\x00\x00test"
            b"PK\x01\x02\x14\x00\x14\x00\x00\x00\x00\x00!\xa6nc\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x04\x00\x00\x00\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00test"
            b"PK\x05\x06\x00\x00\x00\x00\x01\x00\x01\x002\x00\x00\x00>\x00\x00\x00\x00\x00"
        )
        session_id = "sess_zip_test_3003"
        headers = {
            'X-Filename': 'offline_scan.zip',
            'X-Session-Id': session_id,
            'Content-Type': 'application/zip',
            'Content-Length': str(len(zip_content))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=zip_content)
        self.assertEqual(res.status, 200)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'success')
        self.assertIn('offline_scan.zip', body.get('files', []))
        self.assertIn('sha256', body)

    def test_sha256_streaming_verification_match(self):
        """Streaming upload with matching X-SHA256 header returns HTTP 200 and matches digest."""
        import hashlib
        payload = b"Streaming verified content with SHA-256 calculation on the fly!"
        expected_sha256 = hashlib.sha256(payload).hexdigest()
        session_id = "sess_sha256_match_4004"
        headers = {
            'X-Filename': 'verified_scan.mp4',
            'X-Session-Id': session_id,
            'X-SHA256': expected_sha256,
            'Content-Type': 'video/mp4',
            'Content-Length': str(len(payload))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=payload)
        self.assertEqual(res.status, 200)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'success')
        self.assertEqual(body.get('sha256'), expected_sha256)

    def test_sha256_streaming_verification_mismatch(self):
        """Streaming upload with mismatched X-SHA256 returns HTTP 400 and removes the file."""
        payload = b"Tampered content that does not match declared checksum."
        fake_sha256 = "0000000000000000000000000000000000000000000000000000000000000000"
        session_id = "sess_sha256_mismatch_5005"
        headers = {
            'X-Filename': 'corrupted_scan.mp4',
            'X-Session-Id': session_id,
            'X-SHA256': fake_sha256,
            'Content-Type': 'video/mp4',
            'Content-Length': str(len(payload))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=payload)
        self.assertEqual(res.status, 400)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'error')
        self.assertIn("SHA-256 mismatch", body.get('error', '') + body.get('message', ''))

        # Confirm file was deleted from disk and directory cleaned up
        target_file = os.path.join(self.test_dir, session_id, 'corrupted_scan.mp4')
        self.assertFalse(os.path.exists(target_file))

    def test_sha256_returned_without_header(self):
        """Streaming upload without X-SHA256 header calculates and returns SHA-256 in response."""
        import hashlib
        payload = b"Standard stream upload without client hash header."
        expected_sha256 = hashlib.sha256(payload).hexdigest()
        session_id = "sess_sha256_auto_6006"
        headers = {
            'X-Filename': 'auto_hash.webm',
            'X-Session-Id': session_id,
            'Content-Type': 'video/webm',
            'Content-Length': str(len(payload))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=payload)
        self.assertEqual(res.status, 200)
        body = json.loads(data.decode('utf-8'))
        self.assertEqual(body.get('status'), 'success')
        self.assertEqual(body.get('sha256'), expected_sha256)

    def test_socket_draining_on_early_error(self):
        """Early rejection (415) drains socket without dropping connection or raising WinError 10053."""
        body = b"A" * 65536  # 64 KB payload to trigger draining
        headers = {
            'X-Filename': 'evil_script.exe',
            'X-Session-Id': 'sess_drain_test_7007',
            'Content-Type': 'application/octet-stream',
            'Content-Length': str(len(body))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=body)
        self.assertEqual(res.status, 415)
        body_json = json.loads(data.decode('utf-8'))
        self.assertEqual(body_json.get('status'), 'error')


if __name__ == '__main__':
    unittest.main()
