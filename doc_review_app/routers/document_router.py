"""Document router for listing, fetching, and synchronizing documents.

Implements:
- GET  /api/documents: List all documents with metadata and comment counts
- GET  /api/documents/{id}: Fetch full document content and embedded annotations
- POST /api/documents/sync: Ingestion endpoint accepting document payloads
- POST /api/documents/{id}/annotations: Create annotation with initial comment
"""

import asyncio
import logging
import sqlite3
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from doc_review_app.auth import get_current_user, require_admin
from doc_review_app.database import get_db_session
from doc_review_app.models import (
    DocumentDetail,
    DocumentSummary,
    DocumentSyncRequest,
    DocumentSyncResponse,
    User,
)
from doc_review_app.services import document_service
from doc_review_app.storage import cloud_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get(
    "",
    response_model=List[DocumentSummary],
    status_code=status.HTTP_200_OK,
    summary="List Ingested Documents",
)
@router.get(
    "/",
    response_model=List[DocumentSummary],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> List[DocumentSummary]:
    """Retrieve list of all ingested documents with metadata and comment counts."""
    docs = document_service.list_documents(
        user_id=current_user.id,
        is_admin=current_user.is_admin,
        db=db,
    )
    return [DocumentSummary.model_validate(doc) for doc in docs]


@router.post(
    "/sync",
    response_model=DocumentSyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest or Update Document",
)
def sync_document(
    payload: DocumentSyncRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> DocumentSyncResponse:
    """Ingest or synchronize a document file from local storage.
    
    Standardizes line endings, calculates SHA-256 digest, and creates or updates
    the document in the database.
    """
    res = document_service.upsert_document(
        filename=payload.filename,
        content=payload.content,
        format=payload.format,
        user_id=current_user.id,
        is_admin=current_user.is_admin,
        db=db,
    )
    if res["action"] == "created":
        response.status_code = status.HTTP_201_CREATED
    else:
        response.status_code = status.HTTP_200_OK

    return DocumentSyncResponse(
        id=res["id"],
        filename=res["filename"],
        action=res["action"],
        sha256=res["sha256"],
    )


@router.get(
    "/{doc_id}",
    response_model=DocumentDetail,
    status_code=status.HTTP_200_OK,
    summary="Get Document by ID",
)
def get_document_by_id(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> DocumentDetail:
    """Retrieve full content and embedded annotations for a specific document."""
    if doc_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {doc_id} not found",
        )

    doc = document_service.get_document_by_id(doc_id=doc_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {doc_id} not found",
        )

    if not document_service.check_document_access(
        document_id=doc_id,
        user_id=current_user.id,
        is_admin=current_user.is_admin,
        db=db,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document.",
        )

    return DocumentDetail.model_validate(doc)





@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload Document(s) to Library",
)
async def upload_documents(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(require_admin),
) -> List[Dict[str, Any]]:
    """Upload one or more documents (.md, .txt) directly into the library with thread-isolated SQLite & Cloud sync."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files uploaded."
        )

    results = []
    for file in files:
        filename = file.filename or "untitled.md"
        content_bytes = await file.read()
        if not content_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{filename}' is empty."
            )
        res = await asyncio.to_thread(
            document_service.save_uploaded_file,
            filename=filename,
            content_bytes=content_bytes,
            db=None,
        )
        results.append(res)

        # Cloud sync happens OUTSIDE the SQLite write lock!
        try:
            content_str = content_bytes.decode("utf-8", errors="replace")
            await asyncio.to_thread(
                cloud_sync.push_document_to_cloud,
                filename=res["filename"],
                content=content_str,
                file_size=len(content_bytes),
                sha256_hash="",
            )
        except Exception as e:
            logger.warning("Cloud sync on upload failed for '%s': %s", filename, e)

    return results


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Document",
)
def delete_document(
    doc_id: int,
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Delete a document by ID, unlink from disk, and register tombstone in cloud."""
    return document_service.delete_document(doc_id=doc_id, sync_cloud=True)


@router.post(
    "/open-folder",
    status_code=status.HTTP_200_OK,
    summary="Open Documents Folder in OS Explorer",
)
def open_documents_folder(
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Open the local_documents folder in the native OS file explorer."""
    return document_service.open_local_documents_folder()


@router.post(
    "/sync-folder",
    status_code=status.HTTP_200_OK,
    summary="Synchronize Local Documents Folder with Database",
)
def sync_local_folder(
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Scan local_documents folder, normalize line endings, and synchronize SQLite & Cloud state."""
    return document_service.sync_local_directory_with_db(sync_cloud=True)
