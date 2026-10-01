#!/usr/bin/env python3
"""
Hardened Woninginrichter 3D & IMU Scanner Upload Server.
Compliant with Python 3.14 PEP 594 (zero deprecated modules, zero external dependencies).
Enforces strict path traversal defenses, session directory isolation,
streamed socket-to-disk chunking, DoS limits, and CORS / W3C Private Network Access.
"""

import os
import sys
import re
import json
import time
import uuid
import socket
import select
import shutil
import hashlib
import datetime
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# Base upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Security and operational constraints
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB max payload
ALLOWED_EXTENSIONS = {'.mp4', '.webm', '.json', '.csv', '.zip'}
FILENAME_REGEX = re.compile(r'^[a-zA-Z0-9_.-]+$')
SESSION_ID_REGEX = re.compile(r'^[a-zA-Z0-9_.-]+$')
CHUNK_SIZE = 64 * 1024  # 64 KB streaming buffer


class UploadSecurityError(Exception):
    """Raised when an upload violates security policies (traversal, invalid name, etc.)."""
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class PayloadTooLargeError(UploadSecurityError):
    """Raised when an upload exceeds the maximum allowed content length."""
    def __init__(self, message: str = "Payload Too Large: exceeds 500MB limit"):
        super().__init__(413, message)


def validate_and_sanitize_filename(raw_filename: str | None) -> tuple[bool, str, int, str]:
    """
    Validates and sanitizes an uploaded filename.
    Returns: (is_valid, sanitized_basename, http_status_code, error_message)
    """
    if not raw_filename or not isinstance(raw_filename, str) or not raw_filename.strip():
        return False, "", 400, "Filename must be a non-empty string"

    raw_filename = raw_filename.strip()

    # Reject null bytes (poison null byte attack)
    if '\x00' in raw_filename:
        return False, "", 400, "Null bytes not permitted in filename"

    # URL decoding check to prevent obfuscated traversal (e.g. %2e%2e%2f)
    unquoted = urllib.parse.unquote(raw_filename)
    if '\x00' in unquoted:
        return False, "", 400, "Null bytes not permitted in filename"

    # Check for path traversal sequences in both raw and unquoted forms
    for candidate in (raw_filename, unquoted):
        if '..' in candidate:
            return False, "", 400, "Path traversal sequence ('..') detected in filename"
        if '/' in candidate or '\\' in candidate:
            return False, "", 400, "Path separators ('/' or '\\') not permitted in filename"
        if re.match(r'^[a-zA-Z]:', candidate):
            return False, "", 400, "Absolute drive paths not permitted in filename"

    # Check that os.path.basename matches raw input exactly
    base_name = os.path.basename(raw_filename)
    if not base_name or base_name != raw_filename:
        return False, "", 400, "Invalid filename path components"

    # Whitelist character set
    if not FILENAME_REGEX.match(base_name):
        return False, "", 400, "Filename contains invalid characters (allowed: a-z, A-Z, 0-9, _, ., -)"

    # Enforce extension whitelist
    _, ext = os.path.splitext(base_name)
    ext_lower = ext.lower()
    if not ext_lower or ext_lower not in ALLOWED_EXTENSIONS:
        return False, "", 415, (
            f"Disallowed file extension '{ext}'. Allowed extensions: "
            f"{', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    return True, base_name, 200, ""


def validate_and_sanitize_session_id(raw_session_id: str | None) -> tuple[bool, str, int, str]:
    """
    Validates and sanitizes a session identifier.
    Returns: (is_valid, safe_session_id, http_status_code, error_message)
    """
    if not raw_session_id or not isinstance(raw_session_id, str) or not raw_session_id.strip():
        ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_id = f"scan_{ts}_{uuid.uuid4().hex[:8]}"
        return True, safe_id, 200, ""

    raw_session_id = raw_session_id.strip()

    if '\x00' in raw_session_id or '..' in raw_session_id or '/' in raw_session_id or '\\' in raw_session_id:
        return False, "", 400, "Invalid session ID: path traversal detected"

    if re.match(r'^[a-zA-Z]:', raw_session_id):
        return False, "", 400, "Invalid session ID: drive path detected"

    base_id = os.path.basename(raw_session_id)
    if not base_id or base_id != raw_session_id or not SESSION_ID_REGEX.match(base_id) or len(base_id) > 128:
        return False, "", 400, "Invalid session ID format"

    return True, base_id, 200, ""


class StreamingMultipartParser:
    """
    Zero-dependency streaming multipart/form-data parser compliant with Python 3.14 PEP 594.
    Streams file payloads directly from socket to disk in 64KB chunks.
    """

    def __init__(self, rfile, boundary: bytes, content_length: int | None, max_size: int, session_dir: str):
        self.rfile = rfile
        self.boundary = boundary
        self.delimiter = b"\r\n--" + boundary
        self.first_delimiter = b"--" + boundary
        self.content_length = content_length
        self.max_size = max_size
        self.session_dir = session_dir
        self.bytes_read = 0
        self.buf = bytearray()
        self.chunk_size = CHUNK_SIZE
        self.saved_files = []
        self.file_hashes = {}
        self.form_fields = {}

    def _read_more(self) -> bytes:
        if self.content_length is not None:
            remaining = self.content_length - self.bytes_read
            if remaining <= 0:
                return b""
            to_read = min(self.chunk_size, remaining)
        else:
            to_read = self.chunk_size

        chunk = self.rfile.read(to_read)
        if chunk:
            self.bytes_read += len(chunk)
            if self.bytes_read > self.max_size:
                raise PayloadTooLargeError(f"Upload exceeded maximum allowed size of {self.max_size} bytes")
            self.buf.extend(chunk)
        return chunk

    def parse(self) -> tuple[list[str], dict[str, str]]:
        # Locate first delimiter
        while self.first_delimiter not in self.buf:
            chunk = self._read_more()
            if not chunk:
                break

        idx = self.buf.find(self.first_delimiter)
        if idx == -1:
            return self.saved_files, self.form_fields

        del self.buf[:idx + len(self.first_delimiter)]

        while True:
            # Check for end of multipart or next part
            while len(self.buf) < 2:
                if not self._read_more():
                    break

            if self.buf.startswith(b"--"):
                # End of multipart body
                break

            if self.buf.startswith(b"\r\n"):
                del self.buf[:2]
            elif self.buf.startswith(b"\n"):
                del self.buf[:1]

            # Read headers until \r\n\r\n
            while b"\r\n\r\n" not in self.buf and b"\n\n" not in self.buf:
                if not self._read_more():
                    break

            header_end = self.buf.find(b"\r\n\r\n")
            sep_len = 4
            if header_end == -1:
                header_end = self.buf.find(b"\n\n")
                sep_len = 2
            if header_end == -1:
                break

            header_bytes = bytes(self.buf[:header_end])
            del self.buf[:header_end + sep_len]

            headers_text = header_bytes.decode('utf-8', errors='replace')
            disposition = ""
            for line in headers_text.splitlines():
                if ':' in line:
                    k, v = line.split(':', 1)
                    if k.strip().lower() == 'content-disposition':
                        disposition = v.strip()

            field_name = None
            filename_param = None
            if disposition:
                name_match = re.search(r'name="([^"]+)"', disposition)
                if not name_match:
                    name_match = re.search(r"name='([^']+)'", disposition)
                if not name_match:
                    name_match = re.search(r'name=([^\s;]+)', disposition)
                if name_match:
                    field_name = name_match.group(1)

                fn_match = re.search(r'filename="([^"]+)"', disposition)
                if not fn_match:
                    fn_match = re.search(r"filename='([^']+)'", disposition)
                if not fn_match:
                    fn_match = re.search(r'filename=([^\s;]+)', disposition)
                if fn_match:
                    filename_param = fn_match.group(1)

            target_filename = None
            if filename_param:
                target_filename = filename_param
            elif field_name:
                fn_lower = field_name.lower()
                if fn_lower == 'video':
                    target_filename = "scan_video.mp4"
                elif fn_lower in ('json', 'sensor_json'):
                    target_filename = "sensor_log.json"
                elif fn_lower in ('csv', 'sensor_csv'):
                    target_filename = "sensor_log.csv"

            if target_filename:
                is_valid, safe_name, status_code, err_msg = validate_and_sanitize_filename(target_filename)
                if not is_valid:
                    raise UploadSecurityError(status_code, err_msg)

                target_filepath = os.path.join(self.session_dir, safe_name)
                if not os.path.abspath(target_filepath).startswith(os.path.abspath(self.session_dir)):
                    raise UploadSecurityError(400, "Path traversal attempt detected in target path")

                try:
                    file_hasher = hashlib.sha256()
                    with open(target_filepath, 'wb') as f:
                        while True:
                            d_pos = self.buf.find(self.delimiter)
                            if d_pos != -1:
                                to_write = self.buf[:d_pos]
                                f.write(to_write)
                                file_hasher.update(to_write)
                                del self.buf[:d_pos + len(self.delimiter)]
                                break
                            safe_len = len(self.buf) - len(self.delimiter)
                            if safe_len > 0:
                                to_write = self.buf[:safe_len]
                                f.write(to_write)
                                file_hasher.update(to_write)
                                del self.buf[:safe_len]
                            if not self._read_more():
                                f.write(self.buf)
                                file_hasher.update(self.buf)
                                self.buf.clear()
                                break
                    self.saved_files.append(safe_name)
                    self.file_hashes[safe_name] = file_hasher.hexdigest()
                except Exception:
                    if os.path.exists(target_filepath):
                        try:
                            os.remove(target_filepath)
                        except OSError:
                            pass
                    raise
            else:
                field_bytes = bytearray()
                while True:
                    d_pos = self.buf.find(self.delimiter)
                    if d_pos != -1:
                        field_bytes.extend(self.buf[:d_pos])
                        del self.buf[:d_pos + len(self.delimiter)]
                        break
                    safe_len = len(self.buf) - len(self.delimiter)
                    if safe_len > 0:
                        field_bytes.extend(self.buf[:safe_len])
                        del self.buf[:safe_len]
                    if not self._read_more():
                        field_bytes.extend(self.buf)
                        self.buf.clear()
                        break
                if field_name:
                    self.form_fields[field_name] = field_bytes.decode('utf-8', errors='replace').strip()

        return self.saved_files, self.form_fields


class UploadHandler(BaseHTTPRequestHandler):
    """
    Multi-threaded HTTP request handler supporting secure file uploads,
    CORS, W3C Private Network Access (PNA), and health inspections.
    """

    server_version = "WoninginrichterServer/2.0.0"
    upload_dir = UPLOAD_DIR
    max_content_length = MAX_CONTENT_LENGTH
    chunk_size = CHUNK_SIZE

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Session-Id, X-Requested-With, Authorization, X-SHA256')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '86400')

    def _drain_rfile(self, content_length: int | None = None, already_read: int = 0, max_drain: int = 10 * 1024 * 1024):
        """
        Drains unread bytes from incoming socket to prevent TCP RST (WinError 10053)
        when returning early error responses before consuming the full request body.
        Uses select to ensure non-blocking drain without freezing or timing out.
        """
        try:
            if content_length is not None:
                remaining = content_length - already_read
                if remaining <= 0:
                    return
                to_drain = min(remaining, max_drain)
                while to_drain > 0:
                    r, _, _ = select.select([self.connection], [], [], 0.02)
                    if not r:
                        break
                    if hasattr(self.rfile, 'read1'):
                        chunk = self.rfile.read1(min(self.chunk_size, to_drain))
                    else:
                        chunk = self.rfile.read(min(self.chunk_size, to_drain))
                    if not chunk:
                        break
                    to_drain -= len(chunk)
        except (ConnectionResetError, BrokenPipeError, socket.error, OSError, Exception):
            pass

    def send_json(self, status_code: int, data: dict):
        if status_code >= 400:
            try:
                cl = self.headers.get('Content-Length')
                if cl and hasattr(self, 'rfile'):
                    length = int(cl)
                    bytes_read = getattr(self, '_bytes_read_so_far', 0)
                    self._drain_rfile(length, bytes_read)
            except Exception:
                pass
        self.send_response(status_code)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        body = json.dumps(data).encode('utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
            self.wfile.flush()
        except (ConnectionResetError, BrokenPipeError, socket.error, OSError):
            pass

    def cleanup_session_if_empty(self, session_dir: str):
        try:
            if os.path.exists(session_dir) and not os.listdir(session_dir):
                os.rmdir(session_dir)
        except OSError:
            pass

    def do_OPTIONS(self):
        """Respond to CORS and Chromium Private Network Access (PNA) preflights."""
        self.send_response(204)
        self._set_cors_headers()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        """Handle health, status, and static web app delivery."""
        if self.path in ('/', '/index.html', '/scanner.html'):
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            candidates = [
                os.path.join(curr_dir, 'scanner.html'),
                r'C:\Users\gaspa\.gemini\antigravity\brain\042142d8-9288-41d9-843f-1a92d97b7044\scratch\scanner.html',
                os.path.join(curr_dir, 'index.html'),
            ]
            content = None
            for p in candidates:
                if os.path.exists(p):
                    try:
                        with open(p, 'rb') as f:
                            data = f.read()
                        if b'Woninginrichter' in data or p.endswith('scanner.html'):
                            content = data
                            local_scanner = os.path.join(curr_dir, 'scanner.html')
                            if not os.path.exists(local_scanner):
                                try:
                                    with open(local_scanner, 'wb') as sf:
                                        sf.write(data)
                                except Exception:
                                    pass
                            break
                        elif content is None:
                            content = data
                    except Exception:
                        pass
            if content is not None:
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Private-Network', 'true')
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                return self.send_json(404, {"status": "error", "error": "scanner web app not found"})
        elif self.path in ('/health', '/status'):
            body = {
                "status": "healthy",
                "version": "2.0.0",
                "storage": self.upload_dir
            }
            return self.send_json(200, body)
        else:
            return self.send_json(404, {"status": "error", "error": f"Path '{self.path}' not found"})

    def do_POST(self):
        """Handle secure file uploads via multipart/form-data or direct binary stream, and client diagnostics."""
        if self.path == '/api/camera_diag':
            # Receive and log camera discovery diagnostics from client
            cl = self.headers.get('Content-Length')
            if cl:
                try:
                    length = min(int(cl), 128 * 1024)
                    data = self.rfile.read(length)
                    payload = json.loads(data.decode('utf-8', errors='replace'))
                    print("\n" + "="*60)
                    print("[CLIENT CAMERA DIAGNOSTIC REPORT]:")
                    print(json.dumps(payload, indent=2))
                    print("="*60 + "\n", flush=True)
                    diag_path = os.path.join(self.upload_dir, 'latest_camera_diag.json')
                    with open(diag_path, 'w', encoding='utf-8') as f:
                        json.dump(payload, f, indent=2)
                except Exception as e:
                    print(f"[CLIENT CAMERA DIAGNOSTIC ERROR]: {e}", flush=True)
            self._set_cors_headers()
            return self.send_json(200, {"status": "ok"})

        if self.path != '/upload':
            return self.send_json(404, {"status": "error", "error": f"Endpoint '{self.path}' not found. Use /upload"})

        # Check Content-Length limit
        content_length_str = self.headers.get('Content-Length')
        content_length = None
        if content_length_str is not None:
            try:
                content_length = int(content_length_str)
                if content_length < 0:
                    return self.send_json(400, {"status": "error", "error": "Negative Content-Length header"})
            except ValueError:
                return self.send_json(400, {"status": "error", "error": "Invalid Content-Length header"})

            if content_length > self.max_content_length:
                return self.send_json(413, {
                    "status": "error",
                    "error": f"Payload Too Large: {content_length} bytes exceeds maximum limit of {self.max_content_length} bytes"
                })

        # Validate session ID
        raw_session_id = self.headers.get('X-Session-Id')
        is_valid_sess, session_id, sess_status, sess_err = validate_and_sanitize_session_id(raw_session_id)
        if not is_valid_sess:
            return self.send_json(sess_status, {"status": "error", "error": sess_err})

        session_dir = os.path.abspath(os.path.join(self.upload_dir, session_id))
        if not session_dir.startswith(os.path.abspath(self.upload_dir)):
            return self.send_json(400, {"status": "error", "error": "Session directory traversal detected"})

        os.makedirs(session_dir, exist_ok=True)

        content_type = self.headers.get('Content-Type', '')

        if 'multipart/form-data' in content_type.lower():
            boundary = None
            for part in content_type.split(';'):
                part = part.strip()
                if part.lower().startswith('boundary='):
                    boundary = part[len('boundary='):].strip().strip('"').strip("'")
                    break

            if not boundary:
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(400, {"status": "error", "error": "Missing boundary in multipart/form-data"})

            try:
                parser = StreamingMultipartParser(
                    rfile=self.rfile,
                    boundary=boundary.encode('utf-8'),
                    content_length=content_length,
                    max_size=self.max_content_length,
                    session_dir=session_dir
                )
                saved_files, form_fields = parser.parse()
                if not saved_files:
                    self.cleanup_session_if_empty(session_dir)
                    return self.send_json(400, {"status": "error", "error": "No valid files received in multipart payload"})

                resp_data = {
                    "status": "success",
                    "success": True,
                    "session_id": session_id,
                    "files": saved_files,
                    "saved_files": saved_files,
                    "file_hashes": getattr(parser, 'file_hashes', {}),
                    "message": f"Successfully received {len(saved_files)} file(s) in session {session_id}"
                }
                if len(saved_files) == 1 and hasattr(parser, 'file_hashes'):
                    resp_data["sha256"] = parser.file_hashes.get(saved_files[0], "")
                return self.send_json(200, resp_data)

            except UploadSecurityError as e:
                if 'parser' in locals() and hasattr(parser, 'bytes_read'):
                    self._bytes_read_so_far = parser.bytes_read
                if 'parser' in locals() and hasattr(parser, 'saved_files'):
                    for fn in parser.saved_files:
                        p = os.path.join(session_dir, fn)
                        if os.path.exists(p):
                            try:
                                os.remove(p)
                            except OSError:
                                pass
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(e.status_code, {"status": "error", "error": e.message})
            except Exception as e:
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(500, {"status": "error", "error": f"Upload processing error: {e}"})

        else:
            raw_filename = self.headers.get('X-Filename')
            if not raw_filename:
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(400, {"status": "error", "error": "Missing X-Filename header for raw stream upload"})

            is_valid_fn, safe_name, fn_status, fn_err = validate_and_sanitize_filename(raw_filename)
            if not is_valid_fn:
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(fn_status, {"status": "error", "error": fn_err})

            filepath = os.path.join(session_dir, safe_name)
            if not os.path.abspath(filepath).startswith(session_dir):
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(400, {"status": "error", "error": "Path traversal attempt detected in target path"})

            total_streamed = 0
            self._bytes_read_so_far = 0
            remaining = content_length if content_length is not None else self.max_content_length + 1
            hasher = hashlib.sha256()
            try:
                with open(filepath, 'wb') as f:
                    while remaining > 0:
                        to_read = min(self.chunk_size, remaining)
                        chunk = self.rfile.read(to_read)
                        if not chunk:
                            break
                        self._bytes_read_so_far += len(chunk)
                        total_streamed += len(chunk)
                        if total_streamed > self.max_content_length:
                            f.close()
                            if os.path.exists(filepath):
                                try:
                                    os.remove(filepath)
                                except OSError:
                                    pass
                            self.cleanup_session_if_empty(session_dir)
                            return self.send_json(413, {
                                "status": "error",
                                "error": f"Payload Too Large: exceeded maximum limit of {self.max_content_length} bytes"
                            })
                        f.write(chunk)
                        hasher.update(chunk)
                        if content_length is not None:
                            remaining -= len(chunk)

                calculated_sha256 = hasher.hexdigest()
                client_sha256 = self.headers.get('X-SHA256')
                if client_sha256:
                    client_sha256 = client_sha256.strip().lower()
                    if client_sha256 != calculated_sha256.lower():
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                            except OSError:
                                pass
                        self.cleanup_session_if_empty(session_dir)
                        return self.send_json(400, {
                            "status": "error",
                            "error": "SHA-256 mismatch",
                            "message": "SHA-256 mismatch",
                            "client_sha256": client_sha256,
                            "calculated_sha256": calculated_sha256
                        })

                return self.send_json(200, {
                    "status": "success",
                    "success": True,
                    "filename": safe_name,
                    "session_id": session_id,
                    "files": [safe_name],
                    "saved_files": [safe_name],
                    "path": filepath,
                    "sha256": calculated_sha256,
                    "bytes": total_streamed,
                    "message": f"Successfully received {safe_name} in session {session_id}"
                })

            except Exception as e:
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except OSError:
                        pass
                self.cleanup_session_if_empty(session_dir)
                return self.send_json(500, {"status": "error", "error": f"Failed to store file: {e}"})


def run_server(port: int = 8080, host: str = ''):
    """Starts the multi-threaded HTTP upload server."""
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, UploadHandler)

    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = "127.0.0.1"

    print("=" * 60)
    print("[*] Woninginrichter Hardened Upload Server actief (Python 3.14+ Ready)!")
    print(f"[*] Doelmap op PC: {UPLOAD_DIR}")
    print(f"[*] Web App URL: http://{local_ip}:{port}/")
    print(f"[*] Upload API: http://{local_ip}:{port}/upload")
    print(f"[*] Health Check: http://{local_ip}:{port}/health")
    print("[*] Beveiliging: Path traversal defense, PEP 594 streaming, 500MB limiet, Session Isolation")
    print("=" * 60)
    print("Wachten op scan-upload vanaf mobiele telefoon...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server wordt afgesloten...")
        httpd.shutdown()
        httpd.server_close()


if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Ongeldige poort: {sys.argv[1]}, gebruik standaard poort 8080")
    run_server(port=port)
