"""Unit tests for SpeechService and PyAV transcoding.
Verifies audio decoding, MP3 conversion, duration calculation, and eager Whisper evaluation.
"""

import io
from pathlib import Path
from unittest.mock import MagicMock
import numpy as np
import av
import pytest
from doc_review_app.services.speech_service import SpeechService, InvalidAudioError


def generate_sine_wave_audio_bytes(duration_sec: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Helper to generate in-memory valid WAV container audio bytes using PyAV."""
    buf = io.BytesIO()
    container = av.open(buf, mode="w", format="wav")
    stream = container.add_stream("pcm_s16le", rate=sample_rate)
    stream.layout = "mono"

    # Generate 440Hz sine wave
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


def test_decode_and_transcode_valid_audio(tmp_path: Path):
    audio_bytes = generate_sine_wave_audio_bytes(duration_sec=1.5)
    service = SpeechService()
    
    audio_id, duration_sec, mp3_path = service.save_as_mp3(audio_bytes)
    assert audio_id.endswith(".mp3")
    assert pytest.approx(duration_sec, 0.2) == 1.5
    assert mp3_path.is_file()
    assert mp3_path.stat().st_size > 0


def test_decode_to_pcm_16k_mono():
    audio_bytes = generate_sine_wave_audio_bytes(duration_sec=1.0, sample_rate=44100)
    service = SpeechService()
    
    pcm_data, sample_rate = service.decode_to_pcm(audio_bytes)
    assert sample_rate == 16000
    assert isinstance(pcm_data, np.ndarray)
    assert pcm_data.ndim == 1
    assert pcm_data.dtype == np.float32
    assert len(pcm_data) == 16000


def test_invalid_audio_bytes_raises_error():
    service = SpeechService()
    corrupt_bytes = b"NOT_A_VALID_AUDIO_CONTAINER_STREAM"
    
    with pytest.raises(InvalidAudioError):
        service.decode_to_pcm(corrupt_bytes)

    with pytest.raises(InvalidAudioError):
        service.save_as_mp3(corrupt_bytes)


def test_transcribe_and_store_with_mocked_model(monkeypatch: pytest.MonkeyPatch):
    audio_bytes = generate_sine_wave_audio_bytes(duration_sec=1.0)
    service = SpeechService()

    # Mock WhisperModel segments generator
    mock_segment_1 = MagicMock()
    mock_segment_1.text = "Review notitie voor railroede"
    mock_segment_2 = MagicMock()
    mock_segment_2.text = "op begane grond."

    mock_model = MagicMock()
    # transcribe returns (generator, info)
    mock_model.transcribe.return_value = (iter([mock_segment_1, mock_segment_2]), None)

    monkeypatch.setattr(service, "get_model", lambda: mock_model)

    result = service.transcribe_and_store(audio_bytes, client_filename="recording.webm")
    assert "audio_file_id" in result
    assert "duration" in result
    assert "transcript" in result
    assert result["transcript"] == "Review notitie voor railroede op begane grond."
    assert result["audio_file_id"].endswith(".mp3")
