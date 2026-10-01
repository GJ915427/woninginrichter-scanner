"""
tests/test_adversarial_server.py - Empirical Adversarial Security Stress Test Suite

Adversarial testing against server.py:
1. Advanced path traversal payloads:
   - URL-encoded (%2e%2e%2f, %2e%2e%5c, ..%2f, ..%5c)
   - Double URL-encoded (%252e%252e%252f, %252e%252e%255c, %25252e%25252e%25252f)
   - Null byte injection (video.mp4%00.exe, video.mp4\\x00.exe, \\x00video.mp4)
   - Windows Alternate Data Streams (ADS) (video.mp4:stream, video.mp4::$DATA)
   - Backslash traversals (..\\..\\win.ini, ..\\video.mp4)
   - Absolute system paths (/etc/passwd, C:\\Windows\\System32\\cmd.exe, \\\\network\\share\\video.mp4)
   - Hostile Session IDs (traversal, null bytes, ADS, absolute paths, >128 chars)

2. Extension bypass attempts:
   - Double extensions (malicious.mp4.py vs legitimate malicious.py.mp4)
   - Disallowed extensions (.php, .sh, .exe, .py, .bat, .cmd, .vbs, .js, .zip, .bin, .dll)
   - Extensionless files, trailing dots, dot-only names

3. Malformed multipart form-data:
   - Missing boundary parameter in Content-Type
   - Empty boundary parameter
   - Mismatched boundary between header and body delimiter
   - Invalid Content-Disposition headers (missing name/filename, malformed syntax)
   - Disallowed extension inside multipart filename
   - Truncated stream before closing delimiter

4. Payload limit enforcement:
   - Exact dynamic boundary: exact MAX_CONTENT_LENGTH vs MAX_CONTENT_LENGTH + 1 byte
   - Streaming beyond dynamic limit triggers HTTP 413 and purges partial files
   - Global 500MB MAX_CONTENT_LENGTH boundary: declared length 524288000 vs 524288001 (triggers HTTP 413)
   - Negative and non-integer Content-Length headers trigger HTTP 400

5. Concurrency stress:
   - 10 concurrent requests synchronized with threading.Barrier
   - Simultaneous raw uploads and multipart uploads
   - Zero deadlocks, zero cross-session data leaks, 100% data integrity
"""

import concurrent.futures
from http.client import HTTPConnection
import json
import os
import shutil
import tempfile
import threading
import time
import unittest
import uuid

import server
from server import (
    ALLOWED_EXTENSIONS,
    MAX_CONTENT_LENGTH,
    ThreadingHTTPServer,
    UploadHandler,
    validate_and_sanitize_filename,
    validate_and_sanitize_session_id,
)


class TestAdversarialServer(unittest.TestCase):
    """Hostile adversarial stress testing of server.py."""

    @classmethod
    def setUpClass(cls):
        # Dedicated temp upload directory for isolated hostile testing
        cls.test_dir = tempfile.mkdtemp(prefix="adv_test_uploads_")
        UploadHandler.upload_dir = cls.test_dir
        UploadHandler.max_content_length = MAX_CONTENT_LENGTH

        # Start ThreadingHTTPServer on an ephemeral port (port 0)
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), UploadHandler)
        cls.port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'httpd'):
            cls.httpd.shutdown()
            cls.httpd.server_close()
        if hasattr(cls, 'test_dir') and os.path.exists(cls.test_dir):
            shutil.rmtree(cls.test_dir, ignore_errors=True)

    def _request(self, method: str, path: str, headers: dict | None = None, body: bytes | None = None):
        """Helper to send HTTP requests to the live running server."""
        conn = HTTPConnection('127.0.0.1', self.port, timeout=10)
        headers = headers or {}
        try:
            conn.request(method, path, body=body, headers=headers)
            res = conn.getresponse()
            data = res.read()
            return res, data
        finally:
            conn.close()

    # =========================================================================
    # 1. Advanced Path Traversal Payloads
    # =========================================================================

    def test_advanced_path_traversal_raw_upload(self):
        """Hostile path traversal attack vectors in X-Filename must be rejected with HTTP 400."""
        hostile_filenames = [
            # URL-encoded traversal
            ('%2e%2e%2fvideo.mp4', 'URL-encoded traversal ../'),
            ('%2e%2e%5cvideo.mp4', 'URL-encoded traversal ..\\'),
            ('..%2fvideo.mp4', 'Partial URL-encoded traversal ../'),
            ('..%5cvideo.mp4', 'Partial URL-encoded traversal ..\\'),
            ('%2e%2e%2f%2e%2e%2fwin.ini', 'Multi-level URL-encoded traversal'),
            # Double URL-encoded traversal
            ('%252e%252e%252fvideo.mp4', 'Double-encoded %252e%252e%252f'),
            ('%252e%252e%255cvideo.mp4', 'Double-encoded %252e%252e%255c'),
            ('%25252e%25252e%25252fvideo.mp4', 'Triple-encoded traversal'),
            # Poison null bytes
            ('video.mp4\x00.exe', 'Raw null byte injection'),
            ('video.mp4%00.exe', 'URL-encoded null byte injection'),
            ('\x00video.mp4', 'Leading null byte'),
            ('video%00.mp4', 'Middle null byte in mp4'),
            # Windows Alternate Data Streams (ADS)
            ('video.mp4:stream', 'Windows ADS stream'),
            ('video.mp4::$DATA', 'Windows ADS ::$DATA'),
            ('video.mp4:$DATA', 'Windows ADS :$DATA'),
            ('video.mp4:hidden.exe', 'Windows ADS hidden executable'),
            # Backslash traversals
            ('..\\..\\win.ini', 'Backslash traversal to win.ini'),
            ('..\\..\\..\\windows\\system32\\calc.exe', 'Deep backslash traversal'),
            ('..\\video.mp4', 'Single level backslash traversal'),
            ('sub\\..\\..\\video.mp4', 'Subfolder backslash escape'),
            # Absolute system paths
            ('/etc/passwd', 'Unix root /etc/passwd'),
            ('/etc/shadow', 'Unix root /etc/shadow'),
            ('/var/log/video.mp4', 'Unix absolute path'),
            ('C:\\Windows\\System32\\cmd.exe', 'Windows drive absolute path'),
            ('C:/Windows/System32/cmd.exe', 'Windows drive forward slash path'),
            ('\\\\network\\share\\video.mp4', 'UNC network path'),
            ('\\\\?\\C:\\video.mp4', 'Win32 device namespace path'),
            # Dot and semicolon injection
            ('..././video.mp4', 'Multi-dot forward slash'),
            ('..;/video.mp4', 'Semicolon traversal variant'),
        ]

        for payload, description in hostile_filenames:
            with self.subTest(payload=payload, desc=description):
                headers = {
                    'X-Filename': payload,
                    'X-Session-Id': 'sess_adv_traversal',
                    'Content-Type': 'video/mp4',
                    'Content-Length': '16'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"ATTACK_PAYLOAD!!")
                self.assertEqual(
                    res.status, 400,
                    f"Attack vector '{description}' ({payload!r}) was not rejected with HTTP 400; got {res.status}"
                )
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'error')

                # Verify no files were created outside the test root or in workspace
                for leak_target in ('win.ini', 'calc.exe', 'passwd', 'shadow', 'video.mp4', 'cmd.exe'):
                    self.assertFalse(os.path.exists(leak_target), f"Hostile file {leak_target} leaked into project root!")

    def test_session_id_adversarial_traversal(self):
        """Hostile session IDs with traversal, null bytes, ADS, or excessive length must return HTTP 400."""
        hostile_session_ids = [
            '../../evil_session',
            '..\\..\\evil_session',
            '%2e%2e%2fevil_session',
            '%252e%252e%2fevil_session',
            'sess\x00evil',
            'sess%00evil',
            'sess:stream',
            'sess::$DATA',
            'C:\\Windows',
            'C:/Windows',
            '/etc/evil',
            '\\\\network\\share',
            'sess;' + 'x' * 20,
            'sess/' + 'y' * 10,
            'sess\\' + 'z' * 10,
            'A' * 129,  # Exceeds 128 chars limit
        ]

        for sess_id in hostile_session_ids:
            with self.subTest(session_id=sess_id):
                headers = {
                    'X-Filename': 'scan_valid.mp4',
                    'X-Session-Id': sess_id,
                    'Content-Type': 'video/mp4',
                    'Content-Length': '12'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"VALID_CONTENT")
                self.assertEqual(
                    res.status, 400,
                    f"Hostile session ID ({sess_id!r}) was not rejected with HTTP 400; got {res.status}"
                )
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'error')

    def test_session_id_blank_or_omitted_safely_autogenerates(self):
        """Omitted or whitespace session IDs must safely auto-generate a scan_ session ID."""
        for blank_sess in (None, '', '   ', '\t  '):
            with self.subTest(blank_sess=blank_sess):
                headers = {
                    'X-Filename': 'scan_auto.mp4',
                    'Content-Type': 'video/mp4',
                    'Content-Length': '12'
                }
                if blank_sess is not None:
                    headers['X-Session-Id'] = blank_sess
                res, data = self._request('POST', '/upload', headers=headers, body=b"VALID_CONTENT")
                self.assertEqual(res.status, 200)
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'success')
                generated_id = body.get('session_id')
                self.assertTrue(generated_id.startswith('scan_'), f"Unexpected generated ID: {generated_id}")
                # Ensure generated dir is inside test_dir and not escaping
                sess_dir = os.path.join(self.test_dir, generated_id)
                self.assertTrue(os.path.exists(sess_dir))
                self.assertTrue(os.path.abspath(sess_dir).startswith(os.path.abspath(self.test_dir)))

    def test_multipart_path_traversal_payloads(self):
        """Path traversal embedded in multipart filename parameters must be safely repelled with HTTP 400."""
        hostile_multipart_filenames = [
            '%2e%2e%2fevil_video.mp4',
            '%252e%252e%252fevil_video.mp4',
            'video.mp4\x00.exe',
            'video.mp4%00.exe',
            'video.mp4:stream',
            'video.mp4::$DATA',
            '..\\..\\win.ini',
            '../../etc/passwd',
            'C:\\Windows\\System32\\cmd.exe',
            '\\\\network\\share\\video.mp4',
        ]

        boundary = "----AdvMultipartBoundary98765"
        for payload in hostile_multipart_filenames:
            with self.subTest(payload=payload):
                body = (
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="video"; filename="{payload}"\r\n'
                    f"Content-Type: video/mp4\r\n\r\n"
                    f"ATTACK_MULTIPART_BYTES\r\n"
                    f"--{boundary}--\r\n"
                ).encode('utf-8')

                headers = {
                    'Content-Type': f'multipart/form-data; boundary={boundary}',
                    'Content-Length': str(len(body)),
                    'X-Session-Id': 'sess_adv_multipart_attack'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=body)
                self.assertEqual(
                    res.status, 400,
                    f"Multipart traversal payload ({payload!r}) was not rejected with HTTP 400; got {res.status}"
                )
                body_json = json.loads(data.decode('utf-8'))
                self.assertEqual(body_json.get('status'), 'error')

                # Ensure session directory was cleaned up if empty
                sess_path = os.path.join(self.test_dir, 'sess_adv_multipart_attack')
                if os.path.exists(sess_path):
                    self.assertEqual(os.listdir(sess_path), [], f"Files leaked in session dir: {os.listdir(sess_path)}")

    # =========================================================================
    # 2. Extension Bypass Attempts
    # =========================================================================

    def test_disallowed_extensions_rejected_with_415(self):
        """All forbidden file extensions must be rejected with HTTP 415 Unsupported Media Type."""
        disallowed = [
            '.php', '.sh', '.exe', '.py', '.bat', '.cmd', '.vbs', '.js',
            '.iso', '.tar.gz', '.bin', '.dll', '.so', '.jsp', '.asp',
            '.aspx', '.cgi', '.pl', '.html', '.svg', '.rb'
        ]

        for ext in disallowed:
            with self.subTest(ext=ext):
                fn = f"malicious_payload{ext}"
                headers = {
                    'X-Filename': fn,
                    'X-Session-Id': 'sess_ext_test',
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': '10'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"MALICIOUS!")
                self.assertEqual(res.status, 415, f"Disallowed extension {ext} got {res.status} instead of 415")
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'error')
                self.assertIn("Disallowed file extension", body.get('error', ''))

    def test_double_extension_bypass_behavior(self):
        """Double extensions: malicious.mp4.py must be 415; legitimate malicious.py.mp4 must be 200."""
        # Attacks: disguising executables with mp4 in the middle but dangerous final extension -> 415
        hostile_double_exts = [
            'malicious.mp4.py',
            'malicious.mp4.exe',
            'malicious.mp4.php',
            'malicious.mp4.sh',
            'malicious.mp4.js',
            'malicious.mp4.bat',
            'sensor.json.exe',
            'telemetry.csv.sh',
        ]
        for fn in hostile_double_exts:
            with self.subTest(fn=fn):
                headers = {
                    'X-Filename': fn,
                    'X-Session-Id': 'sess_double_ext_attack',
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': '10'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"DOUBLE_EXT")
                self.assertEqual(res.status, 415, f"Double extension attack '{fn}' was not rejected with 415!")

        # Legitimate files with dots in basename but whitelisted final extension -> 200
        legitimate_multi_dot = [
            ('scan.2026.09.28.mp4', 'video/mp4'),
            ('malicious.py.mp4', 'video/mp4'),
            ('camera.backup.webm', 'video/webm'),
            ('sensors.imu.v1.json', 'application/json'),
            ('trajectory.raw.calibrated.csv', 'text/csv'),
        ]
        for fn, ctype in legitimate_multi_dot:
            with self.subTest(fn=fn):
                headers = {
                    'X-Filename': fn,
                    'X-Session-Id': 'sess_legit_multidot',
                    'Content-Type': ctype,
                    'Content-Length': '12'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"LEGIT_DATA!!")
                self.assertEqual(res.status, 200, f"Legitimate multi-dot file '{fn}' failed with {res.status}")
                body = json.loads(data.decode('utf-8'))
                self.assertEqual(body.get('status'), 'success')
                p = os.path.join(self.test_dir, 'sess_legit_multidot', fn)
                self.assertTrue(os.path.exists(p))

    def test_extensionless_and_dotfile_variants(self):
        """Files without extensions, trailing dots, or dot-only files must be rejected with HTTP 415."""
        invalid_variants = [
            'extensionless_file',
            'trailing_dot.',
            'trailing_dots...',
            '.mp4',        # os.path.splitext('.mp4') returns ('.mp4', '')
            '.json',       # dotfile with no stem
            '.env',
            '.gitignore',
        ]
        for fn in invalid_variants:
            with self.subTest(fn=fn):
                headers = {
                    'X-Filename': fn,
                    'X-Session-Id': 'sess_noext',
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': '8'
                }
                res, data = self._request('POST', '/upload', headers=headers, body=b"TESTDATA")
                self.assertIn(
                    res.status, (400, 415),
                    f"Variant '{fn}' should be rejected (400 or 415), got {res.status}"
                )

    # =========================================================================
    # 3. Malformed Multipart Form-Data
    # =========================================================================

    def test_malformed_multipart_form_data(self):
        """Malformed multipart payloads (missing/mismatched boundary, corrupt disposition) must return HTTP 400/415."""
        # 1. Missing boundary parameter in Content-Type
        headers1 = {
            'Content-Type': 'multipart/form-data',
            'Content-Length': '25',
            'X-Session-Id': 'sess_mal_1'
        }
        res1, data1 = self._request('POST', '/upload', headers=headers1, body=b"some random body content")
        self.assertEqual(res1.status, 400)
        self.assertIn("Missing boundary", json.loads(data1.decode('utf-8')).get('error', ''))

        # 2. Empty boundary parameter
        headers2 = {
            'Content-Type': 'multipart/form-data; boundary=',
            'Content-Length': '25',
            'X-Session-Id': 'sess_mal_2'
        }
        res2, data2 = self._request('POST', '/upload', headers=headers2, body=b"some random body content")
        self.assertEqual(res2.status, 400)

        # 3. Mismatched boundary (header boundary != body delimiter)
        headers3 = {
            'Content-Type': 'multipart/form-data; boundary=HEADER_BOUNDARY_111',
            'Content-Length': '100',
            'X-Session-Id': 'sess_mal_3'
        }
        body3 = (
            b"--DIFFERENT_BODY_BOUNDARY_222\r\n"
            b'Content-Disposition: form-data; name="video"; filename="scan.mp4"\r\n'
            b"Content-Type: video/mp4\r\n\r\n"
            b"VIDEO_DATA\r\n"
            b"--DIFFERENT_BODY_BOUNDARY_222--\r\n"
        )
        headers3['Content-Length'] = str(len(body3))
        res3, data3 = self._request('POST', '/upload', headers=headers3, body=body3)
        self.assertEqual(res3.status, 400)
        self.assertIn("No valid files received", json.loads(data3.decode('utf-8')).get('error', ''))

        # 4. Missing Content-Disposition header in multipart part
        bnd4 = "----BoundaryNoDisp999"
        body4 = (
            f"--{bnd4}\r\n"
            f"Content-Type: video/mp4\r\n\r\n"
            f"VIDEO_DATA_NO_DISPOSITION\r\n"
            f"--{bnd4}--\r\n"
        ).encode('utf-8')
        headers4 = {
            'Content-Type': f'multipart/form-data; boundary={bnd4}',
            'Content-Length': str(len(body4)),
            'X-Session-Id': 'sess_mal_4'
        }
        res4, data4 = self._request('POST', '/upload', headers=headers4, body=body4)
        self.assertEqual(res4.status, 400)

        # 5. Invalid / corrupt Content-Disposition syntax (no name, no filename)
        bnd5 = "----BoundaryCorruptDisp888"
        body5 = (
            f"--{bnd5}\r\n"
            f"Content-Disposition: garbage_corrupt_data_without_name\r\n"
            f"Content-Type: video/mp4\r\n\r\n"
            f"GARBAGE_DATA\r\n"
            f"--{bnd5}--\r\n"
        ).encode('utf-8')
        headers5 = {
            'Content-Type': f'multipart/form-data; boundary={bnd5}',
            'Content-Length': str(len(body5)),
            'X-Session-Id': 'sess_mal_5'
        }
        res5, data5 = self._request('POST', '/upload', headers=headers5, body=body5)
        self.assertEqual(res5.status, 400)

        # 6. Disallowed extension inside multipart filename
        bnd6 = "----BoundaryDisallowedExt777"
        body6 = (
            f"--{bnd6}\r\n"
            f'Content-Disposition: form-data; name="payload"; filename="shell.php"\r\n'
            f"Content-Type: application/x-php\r\n\r\n"
            f"<?php echo 'hacked'; ?>\r\n"
            f"--{bnd6}--\r\n"
        ).encode('utf-8')
        headers6 = {
            'Content-Type': f'multipart/form-data; boundary={bnd6}',
            'Content-Length': str(len(body6)),
            'X-Session-Id': 'sess_mal_6'
        }
        res6, data6 = self._request('POST', '/upload', headers=headers6, body=body6)
        self.assertEqual(res6.status, 415)

        # 7. Truncated multipart stream (EOF before final delimiter)
        bnd7 = "----BoundaryTruncated666"
        body7 = (
            f"--{bnd7}\r\n"
            f'Content-Disposition: form-data; name="video"; filename="scan.mp4"\r\n'
            f"Content-Type: video/mp4\r\n\r\n"
            f"TRUNCATED_STREAM"
        ).encode('utf-8')
        headers7 = {
            'Content-Type': f'multipart/form-data; boundary={bnd7}',
            'Content-Length': str(len(body7)),
            'X-Session-Id': 'sess_mal_7'
        }
        res7, data7 = self._request('POST', '/upload', headers=headers7, body=body7)
        # Even if truncated, parser must not crash or save incomplete file outside session
        self.assertIn(res7.status, (200, 400))

    # =========================================================================
    # 4. Payload Limit Enforcement
    # =========================================================================

    def test_payload_limit_enforcement_boundary(self):
        """Exact MAX_CONTENT_LENGTH boundary vs MAX_CONTENT_LENGTH + 1 byte must trigger HTTP 413."""
        test_limit = 4096  # 4 KB dynamic limit for rapid, exact-byte boundary verification
        original_limit = UploadHandler.max_content_length
        UploadHandler.max_content_length = test_limit

        try:
            # Subtest 1: Exact limit boundary (exact test_limit bytes) -> 200 OK
            exact_body = b"B" * test_limit
            headers_exact = {
                'X-Filename': 'exact_boundary.mp4',
                'X-Session-Id': 'sess_limit_exact',
                'Content-Length': str(test_limit),
                'Content-Type': 'video/mp4'
            }
            res_exact, data_exact = self._request('POST', '/upload', headers=headers_exact, body=exact_body)
            self.assertEqual(
                res_exact.status, 200,
                f"Exact boundary of {test_limit} bytes was rejected; got {res_exact.status}"
            )
            saved_file = os.path.join(self.test_dir, 'sess_limit_exact', 'exact_boundary.mp4')
            self.assertTrue(os.path.exists(saved_file))
            self.assertEqual(os.path.getsize(saved_file), test_limit)

            # Subtest 2: Exact limit + 1 byte (test_limit + 1 bytes) -> 413 Payload Too Large
            over_limit_len = test_limit + 1
            over_body = b"B" * over_limit_len
            headers_over = {
                'X-Filename': 'over_boundary.mp4',
                'X-Session-Id': 'sess_limit_over',
                'Content-Length': str(over_limit_len),
                'Content-Type': 'video/mp4'
            }
            res_over, data_over = self._request('POST', '/upload', headers=headers_over, body=over_body)
            self.assertEqual(
                res_over.status, 413,
                f"Limit + 1 byte ({over_limit_len} bytes) did not trigger 413; got {res_over.status}"
            )
            body_over = json.loads(data_over.decode('utf-8'))
            self.assertEqual(body_over.get('status'), 'error')
            self.assertIn("Payload Too Large", body_over.get('error', ''))

            # Verify no partial file remained on disk
            over_file = os.path.join(self.test_dir, 'sess_limit_over', 'over_boundary.mp4')
            self.assertFalse(os.path.exists(over_file), "Partial file was not cleaned up after 413 rejection!")

            # Subtest 3: Global MAX_CONTENT_LENGTH (500MB) header boundary
            # Content-Length == MAX_CONTENT_LENGTH + 1 (524288001)
            UploadHandler.max_content_length = MAX_CONTENT_LENGTH
            headers_global_over = {
                'X-Filename': 'global_over.mp4',
                'X-Session-Id': 'sess_global_over',
                'Content-Length': str(MAX_CONTENT_LENGTH + 1),
                'Content-Type': 'video/mp4'
            }
            res_g_over, data_g_over = self._request('POST', '/upload', headers=headers_global_over, body=b"")
            self.assertEqual(
                res_g_over.status, 413,
                f"Global MAX_CONTENT_LENGTH + 1 did not trigger 413; got {res_g_over.status}"
            )

            # Subtest 4: Negative or invalid Content-Length header -> 400
            headers_neg = {
                'X-Filename': 'neg_len.mp4',
                'Content-Length': '-100',
                'Content-Type': 'video/mp4'
            }
            res_neg, _ = self._request('POST', '/upload', headers=headers_neg, body=b"")
            self.assertEqual(res_neg.status, 400)

            headers_invalid = {
                'X-Filename': 'invalid_len.mp4',
                'Content-Length': 'not_a_number',
                'Content-Type': 'video/mp4'
            }
            res_inv, _ = self._request('POST', '/upload', headers=headers_invalid, body=b"")
            self.assertEqual(res_inv.status, 400)

        finally:
            UploadHandler.max_content_length = original_limit

    # =========================================================================
    # 5. Concurrency Stress Test
    # =========================================================================

    def test_concurrency_stress_10_simultaneous_requests(self):
        """10 simultaneous concurrent requests must process cleanly without deadlock or corruption."""
        num_threads = 10
        barrier = threading.Barrier(num_threads)
        results = [None] * num_threads

        def worker(thread_idx: int):
            session_id = f"concurrency_stress_sess_{thread_idx}_{uuid.uuid4().hex[:6]}"
            payload_data = f"THREAD_PAYLOAD_DATA_{thread_idx}_".encode('utf-8') * 200

            # Half the threads do raw streaming upload; the other half do multipart upload
            if thread_idx % 2 == 0:
                filename = f"scan_thread_{thread_idx}.mp4"
                headers = {
                    'X-Filename': filename,
                    'X-Session-Id': session_id,
                    'Content-Type': 'video/mp4',
                    'Content-Length': str(len(payload_data))
                }
                body = payload_data
            else:
                filename = f"sensor_thread_{thread_idx}.json"
                boundary = f"----ConcurrencyBoundary{thread_idx}"
                body = (
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="sensor_json"; filename="{filename}"\r\n'
                    f"Content-Type: application/json\r\n\r\n"
                ).encode('utf-8') + payload_data + f"\r\n--{boundary}--\r\n".encode('utf-8')

                headers = {
                    'Content-Type': f'multipart/form-data; boundary={boundary}',
                    'Content-Length': str(len(body)),
                    'X-Session-Id': session_id
                }

            # Synchronize so all 10 threads hit the server at the exact same millisecond
            barrier.wait(timeout=10)

            # Send HTTP request
            conn = HTTPConnection('127.0.0.1', self.port, timeout=15)
            try:
                conn.request('POST', '/upload', body=body, headers=headers)
                res = conn.getresponse()
                resp_data = res.read()
                results[thread_idx] = {
                    'status': res.status,
                    'data': resp_data,
                    'session_id': session_id,
                    'filename': filename,
                    'expected_payload': payload_data
                }
            except Exception as e:
                results[thread_idx] = {'error': str(e)}
            finally:
                conn.close()

        threads = []
        for i in range(num_threads):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join(timeout=20)
            self.assertFalse(t.is_alive(), "Worker thread deadlocked or timed out during concurrency stress test!")

        # Verify all 10 requests succeeded and files are uncorrupted
        for i, res_info in enumerate(results):
            self.assertIsNotNone(res_info, f"Thread {i} produced no result")
            self.assertNotIn('error', res_info, f"Thread {i} encountered exception: {res_info.get('error')}")
            self.assertEqual(res_info['status'], 200, f"Thread {i} returned HTTP {res_info['status']}; expected 200")

            resp_json = json.loads(res_info['data'].decode('utf-8'))
            self.assertEqual(resp_json.get('status'), 'success')
            self.assertEqual(resp_json.get('session_id'), res_info['session_id'])

            # Verify file integrity on disk
            saved_path = os.path.join(self.test_dir, res_info['session_id'], res_info['filename'])
            self.assertTrue(os.path.exists(saved_path), f"File {saved_path} not found on disk")
            with open(saved_path, 'rb') as f:
                saved_bytes = f.read()
            self.assertEqual(
                saved_bytes, res_info['expected_payload'],
                f"Thread {i} suffered data corruption! File on disk did not match sent payload."
            )

    # =========================================================================
    # 7. Milestone 3 & 4: Adversarial SHA-256, ZIP & Socket Draining
    # =========================================================================

    def test_authorized_zip_upload_adversarial(self):
        """Authorized .zip files succeed, but dangerous extensions (.zip.exe) are rejected."""
        valid_zip_payload = (
            b"PK\x03\x04\x14\x00\x00\x00\x00\x00!\xa6nc\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x04\x00\x00\x00test"
            b"PK\x01\x02\x14\x00\x14\x00\x00\x00\x00\x00!\xa6nc\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x04\x00\x00\x00\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00test"
            b"PK\x05\x06\x00\x00\x00\x00\x01\x00\x01\x002\x00\x00\x00>\x00\x00\x00\x00\x00"
        )
        headers = {
            'X-Filename': 'legit_scan.zip',
            'X-Session-Id': 'sess_adv_zip',
            'Content-Type': 'application/zip',
            'Content-Length': str(len(valid_zip_payload))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=valid_zip_payload)
        self.assertEqual(res.status, 200)

        # Hostile double extension disguise (.zip.exe) must be rejected
        headers_bad = {
            'X-Filename': 'legit_scan.zip.exe',
            'X-Session-Id': 'sess_adv_zip',
            'Content-Type': 'application/octet-stream',
            'Content-Length': str(len(valid_zip_payload))
        }
        res_bad, _ = self._request('POST', '/upload', headers=headers_bad, body=valid_zip_payload)
        self.assertEqual(res_bad.status, 415)

    def test_adversarial_sha256_checksum_tampering(self):
        """Tampering even a single byte triggers HTTP 400 and purges the file from disk."""
        import hashlib
        original_data = b"Original scan telemetry package 2026"
        correct_hash = hashlib.sha256(original_data).hexdigest()
        session_id = "sess_sha256_tamper_test"

        # 1. Genuine request
        headers = {
            'X-Filename': 'clean_scan.mp4',
            'X-Session-Id': session_id,
            'X-SHA256': correct_hash,
            'Content-Type': 'video/mp4',
            'Content-Length': str(len(original_data))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=original_data)
        self.assertEqual(res.status, 200)
        resp_json = json.loads(data.decode('utf-8'))
        self.assertEqual(resp_json.get('sha256'), correct_hash)

        # 2. In-flight corrupted body (bit flip)
        corrupted_data = b"Xriginal scan telemetry package 2026"
        headers_tampered = {
            'X-Filename': 'tampered_scan.mp4',
            'X-Session-Id': session_id,
            'X-SHA256': correct_hash,
            'Content-Type': 'video/mp4',
            'Content-Length': str(len(corrupted_data))
        }
        res_t, data_t = self._request('POST', '/upload', headers=headers_tampered, body=corrupted_data)
        self.assertEqual(res_t.status, 400)
        err_json = json.loads(data_t.decode('utf-8'))
        self.assertIn("SHA-256 mismatch", err_json.get('error', '') + err_json.get('message', ''))
        # Ensure file was not left on disk
        tampered_path = os.path.join(self.test_dir, session_id, 'tampered_scan.mp4')
        self.assertFalse(os.path.exists(tampered_path))

    def test_adversarial_socket_draining_on_early_rejection(self):
        """Massive payload sent with hostile headers drains socket cleanly without connection abort."""
        large_body = b"B" * (128 * 1024)  # 128 KB
        headers = {
            'X-Filename': 'trojan.dll',
            'X-Session-Id': 'sess_drain_adv',
            'Content-Type': 'application/octet-stream',
            'Content-Length': str(len(large_body))
        }
        res, data = self._request('POST', '/upload', headers=headers, body=large_body)
        self.assertEqual(res.status, 415)
        err_json = json.loads(data.decode('utf-8'))
        self.assertEqual(err_json.get('status'), 'error')


if __name__ == '__main__':
    unittest.main()
