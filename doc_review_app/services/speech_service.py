"""Speech transcription and audio transcoding service.

Provides PyAV in-memory decoding to 16kHz float32 mono PCM for faster-whisper,
universal MP3 transcoding for disk storage and browser streaming, and eager
generator consumption to protect the asyncio event loop.
"""

import io
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import uuid
import av
import numpy as np
from doc_review_app.config import settings
from doc_review_app.services.domain_terms_service import domain_terms_service


class InvalidAudioError(ValueError):
    """Raised when an uploaded audio container or byte stream is invalid or corrupted."""
    pass


class SpeechService:
    """Service encapsulating PyAV transcoding and faster-whisper inference."""

    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8") -> None:
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._model: Optional[Any] = None

    def get_model(self) -> Any:
        """Lazy load WhisperModel instance on demand."""
        if self._model is None:
            from faster_whisper import WhisperModel
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
        return self._model

    def decode_to_pcm(self, audio_bytes: bytes) -> Tuple[np.ndarray, int]:
        """Decode any valid audio container (MP4/AAC, WebM/Opus, WAV) to 16kHz float32 mono PCM."""
        if not audio_bytes or len(audio_bytes) == 0:
            raise InvalidAudioError("Lege audiobytes ontvangen.")

        try:
            in_buf = io.BytesIO(audio_bytes)
            container = av.open(in_buf)
        except Exception as e:
            raise InvalidAudioError(f"Kan audio container niet openen: {e}") from e

        try:
            audio_streams = container.streams.audio
            if not audio_streams:
                container.close()
                raise InvalidAudioError("Geen audiostream aangetroffen in container.")

            stream = audio_streams[0]
            resampler = av.AudioResampler(format="flt", layout="mono", rate=16000)

            pcm_chunks = []
            for frame in container.decode(stream):
                resampled = resampler.resample(frame)
                for r_frame in resampled:
                    pcm_chunks.append(r_frame.to_ndarray()[0])

            # Flush resampler
            resampled = resampler.resample(None)
            for r_frame in resampled:
                pcm_chunks.append(r_frame.to_ndarray()[0])

            container.close()

            if not pcm_chunks:
                raise InvalidAudioError("Audiostroom bevat geen decodeerbare audioframes.")

            pcm_array = np.concatenate(pcm_chunks).astype(np.float32)
            return pcm_array, 16000
        except InvalidAudioError:
            raise
        except Exception as e:
            raise InvalidAudioError(f"Fout tijdens audiodeterminatie: {e}") from e

    def save_as_mp3(self, audio_bytes: bytes) -> Tuple[str, float, Path]:
        """Transcode uploaded audio bytes to MP3 format and save in audio storage directory."""
        pcm_array, rate = self.decode_to_pcm(audio_bytes)
        duration_sec = float(len(pcm_array)) / float(rate)

        audio_id = f"{uuid.uuid4()}.mp3"
        settings.ensure_directories()
        mp3_path = settings.audio_dir / audio_id

        try:
            # Resample float32 to s16 for MP3 encoding
            s16_samples = np.clip(pcm_array * 32767.0, -32768, 32767).astype(np.int16)
            
            out_container = av.open(str(mp3_path), mode="w", format="mp3")
            out_stream = out_container.add_stream("mp3", rate=rate)
            out_stream.layout = "mono"

            # Chunk into standard frames of 1152 samples
            frame_size = 1152
            for i in range(0, len(s16_samples), frame_size):
                chunk = s16_samples[i:i + frame_size]
                if len(chunk) == 0:
                    continue
                frame = av.AudioFrame.from_ndarray(chunk.reshape(1, -1), format="s16", layout="mono")
                frame.rate = rate
                for packet in out_stream.encode(frame):
                    out_container.mux(packet)

            # Flush encoder
            for packet in out_stream.encode(None):
                out_container.mux(packet)

            out_container.close()
        except Exception as e:
            if mp3_path.is_file():
                try:
                    mp3_path.unlink()
                except Exception:
                    pass
            raise InvalidAudioError(f"Fout tijdens MP3 transcodering: {e}") from e

        return audio_id, round(duration_sec, 2), mp3_path

    def transcribe_and_store(self, audio_bytes: bytes, client_filename: str = "") -> Dict[str, Any]:
        """Perform full processing: MP3 transcode, 16kHz decoding, and eager Whisper transcription."""
        audio_id, duration_sec, _ = self.save_as_mp3(audio_bytes)
        pcm_data, _ = self.decode_to_pcm(audio_bytes)

        model = self.get_model()
        hotwords = domain_terms_service.get_hotwords()
        initial_prompt = domain_terms_service.get_initial_prompt()

        kwargs: Dict[str, Any] = {
            "language": "nl",
            "vad_filter": True,
        }
        if initial_prompt:
            kwargs["initial_prompt"] = initial_prompt
        if hotwords:
            kwargs["hotwords"] = hotwords

        segments, _ = model.transcribe(pcm_data, **kwargs)

        # Crucial: eagerly consume the generator within the worker thread
        transcript_parts = []
        for segment in segments:
            text = segment.text.strip()
            if text:
                transcript_parts.append(text)

        transcript_text = " ".join(transcript_parts).strip()

        return {
            "audio_file_id": audio_id,
            "duration": duration_sec,
            "transcript": transcript_text,
        }


# Singleton instance
speech_service = SpeechService()
