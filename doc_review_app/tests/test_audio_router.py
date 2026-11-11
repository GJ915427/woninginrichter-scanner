"""Integration tests for AudioRouter: upload endpoint and HTTP 206 byte-range streaming.
Verifies RFC 7233 range headers, iPadOS Safari compatibility, and path traversal mitigation.
"""

import io
from pathlib import Path
from unittest.mock import MagicMock
import numpy as np
import av
import pytest
from fastapi.testclient import TestClient


def generate_test_audio_bytes(duration_sec: float = 1.0, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    container = av.open(buf, mode="w", format="wav")
    stream = container.add_stream("pcm_s16le", rate=sample_rate)
    stream.layout = "mono"

    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    samples = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    
    frame = av.AudioFrame.from_ndarray(samples.reshape(1, -1), format="s16", layout="mono")
    frame.rate = sample_rate
    for packet in stream.encode(frame):
        container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    return buf.getvalue()


def test_audio_upload_success(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    from doc_review_app.services.speech_service import speech_service

    # Mock Whisper transcription to run fast without heavy model download
    mock_model = MagicMock()
    mock_seg = MagicMock()
    mock_seg.text = "Inmeten dagmaat voor railroede"
    mock_model.transcribe.return_value = (iter([mock_seg]), None)
    monkeypatch.setattr(speech_service, "get_model", lambda: mock_model)

    audio_bytes = generate_test_audio_bytes(duration_sec=1.0)
    files = {"file": ("test_recording.webm", io.BytesIO(audio_bytes), "audio/webm")}

    response = client.post("/api/audio/recordings", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "audio_file_id" in data
    assert data["audio_file_id"].endswith(".mp3")
    assert "duration" in data
    assert data["duration"] > 0
    assert "transcript" in data
    assert data["transcript"] == "Inmeten dagmaat voor railroede"


def test_audio_upload_empty_file_rejected(client: TestClient):
    files = {"file": ("empty.webm", io.BytesIO(b""), "audio/webm")}
    response = client.post("/api/audio/recordings", files=files)
    assert response.status_code == 400


def test_audio_stream_full_http_200(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    from doc_review_app.services.speech_service import speech_service
    audio_bytes = generate_test_audio_bytes(duration_sec=1.0)
    audio_id, _, _ = speech_service.save_as_mp3(audio_bytes)

    response = client.get(f"/api/audio/recordings/{audio_id}")
    assert response.status_code == 200
    assert response.headers.get("accept-ranges") == "bytes"
    assert response.headers.get("content-type") == "audio/mpeg"
    assert len(response.content) > 0


def test_audio_stream_partial_http_206(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    from doc_review_app.services.speech_service import speech_service
    audio_bytes = generate_test_audio_bytes(duration_sec=1.5)
    audio_id, _, mp3_path = speech_service.save_as_mp3(audio_bytes)
    total_size = mp3_path.stat().st_size

    # Request first 100 bytes
    headers = {"Range": "bytes=0-99"}
    response = client.get(f"/api/audio/recordings/{audio_id}", headers=headers)
    assert response.status_code == 206
    assert response.headers.get("content-range") == f"bytes 0-99/{total_size}"
    assert response.headers.get("content-length") == "100"
    assert len(response.content) == 100


def test_audio_stream_path_traversal_blocked(client: TestClient):
    # Attempt directory traversal
    response = client.get("/api/audio/recordings/../../doc_review.db")
    # Starlette/FastAPI will normalize or regex validator will reject
    assert response.status_code in (400, 404)


def test_audio_stream_nonexistent_returns_404(client: TestClient):
    fake_uuid = "00000000-0000-0000-0000-000000000000.mp3"
    response = client.get(f"/api/audio/recordings/{fake_uuid}")
    assert response.status_code == 404
