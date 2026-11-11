"""Audio router module for speech upload, transcription, and RFC 7233 HTTP 206 streaming.

Conforms to Thin Router Mandate (INV-GOV-21A) with zero direct database queries
and delegates CPU-bound transcode/transcribe operations to run_in_threadpool.
"""

from pathlib import Path
import re
from typing import Any, Dict, Generator
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from doc_review_app.config import settings
from doc_review_app.services.speech_service import InvalidAudioError, speech_service


router = APIRouter(prefix="/api/audio", tags=["Audio"])

# Strict UUIDv4 with .mp3 extension regex to prevent path traversal
AUDIO_ID_PATTERN = re.compile(r"^[a-f0-9\-]{36}\.mp3$", re.IGNORECASE)


@router.post("/recordings", response_model=Dict[str, Any])
async def upload_audio_recording(
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """Uploads recorded audio, transcodes to MP3 and transcribes via faster-whisper."""
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geen audiobestand ontvangen.")

    audio_bytes = await file.read()
    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lege audiobytes ontvangen.")

    try:
        result = await run_in_threadpool(
            speech_service.transcribe_and_store,
            audio_bytes,
            file.filename or "",
        )
        return result
    except InvalidAudioError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Fout bij audioverwerking: {e}") from e


def _file_chunk_generator(file_path: Path, start: int, length: int, chunk_size: int = 65536) -> Generator[bytes, None, None]:
    with open(file_path, "rb") as f:
        f.seek(start)
        bytes_left = length
        while bytes_left > 0:
            read_size = min(chunk_size, bytes_left)
            chunk = f.read(read_size)
            if not chunk:
                break
            bytes_left -= len(chunk)
            yield chunk


@router.get("/recordings/{audio_id}")
async def stream_audio_recording(audio_id: str, request: Request) -> StreamingResponse:
    """Stream audio using RFC 7233 byte-range requests for iPadOS Safari and Windows playback."""
    if not AUDIO_ID_PATTERN.match(audio_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ongeldige audio identificatie.")

    audio_path = settings.audio_dir / audio_id
    if not audio_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audiobestand niet gevonden.")

    file_size = audio_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        # Full content stream (HTTP 200)
        return StreamingResponse(
            _file_chunk_generator(audio_path, 0, file_size),
            status_code=status.HTTP_200_OK,
            media_type="audio/mpeg",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Content-Type": "audio/mpeg",
            },
        )

    # Parse Range: bytes=start-end
    range_match = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
    if not range_match:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Ongeldige Range header.")

    start_str, end_str = range_match.groups()
    if start_str and end_str:
        start = int(start_str)
        end = int(end_str)
    elif start_str:
        start = int(start_str)
        end = file_size - 1
    elif end_str:
        # Suffix range
        suffix_len = int(end_str)
        start = max(0, file_size - suffix_len)
        end = file_size - 1
    else:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Ongeldige Range parameters.")

    if start > end or start >= file_size:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Gevraagde range valt buiten bestandsgrootte.")

    end = min(end, file_size - 1)
    content_length = end - start + 1

    return StreamingResponse(
        _file_chunk_generator(audio_path, start, content_length),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type="audio/mpeg",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": "audio/mpeg",
        },
    )
