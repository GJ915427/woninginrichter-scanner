"""Document router for listing, fetching, and synchronizing documents.

Implements:
- GET  /api/documents: List all documents with metadata and comment counts
- GET  /api/documents/{id}: Fetch full document content and embedded annotations
- POST /api/documents/sync: Ingestion endpoint accepting document payloads
- POST /api/documents/{id}/annotations: Create annotation with initial comment
"""

import sqlite3
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from doc_review_app.auth import get_current_user
from doc_review_app.database import get_db_session
from doc_review_app.models import (
    DocumentDetail,
    DocumentSummary,
    DocumentSyncRequest,
    DocumentSyncResponse,
    User,
)
from doc_review_app.services import document_service

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
    docs = document_service.list_documents(db=db)
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

    return DocumentDetail.model_validate(doc)


@router.post(
    "/{doc_id}/annotations",
    status_code=status.HTTP_201_CREATED,
    summary="Create Annotation with Optional Comment",
    tags=["annotations"],
)
def create_document_annotation(
    doc_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Create an annotation anchored to document text offsets with initial comment."""
    start_offset = payload.get("start_offset")
    end_offset = payload.get("end_offset")
    selected_text = payload.get("selected_text", "")
    comment_content = payload.get("comment_content")
    badge_color = payload.get("badge_color", "#FF6D00")

    if start_offset is None or end_offset is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_offset and end_offset are required",
        )

    return document_service.create_annotation_for_document(
        doc_id=doc_id,
        author_id=current_user.id,
        author_initials=current_user.initials,
        start_offset=int(start_offset),
        end_offset=int(end_offset),
        selected_text=str(selected_text),
        comment_content=comment_content,
        badge_color=badge_color,
        db=db,
    )


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload Document(s) to Library",
)
async def upload_documents(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    """Upload one or more documents (.md, .txt) directly into the library."""
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
        res = document_service.save_uploaded_file(
            filename=filename,
            content_bytes=content_bytes,
            db=db,
        )
        results.append(res)

    return results


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Document",
)
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Delete a document by ID and unlink from local_documents."""
    return document_service.delete_document(doc_id=doc_id, db=db)


@router.post(
    "/open-folder",
    status_code=status.HTTP_200_OK,
    summary="Open Documents Folder in OS Explorer",
)
def open_documents_folder(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Open the local_documents folder in the native OS file explorer."""
    return document_service.open_local_documents_folder()


@router.post(
    "/sync-folder",
    status_code=status.HTTP_200_OK,
    summary="Synchronize Local Documents Folder with Database",
)
def sync_local_folder(
    current_user: User = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Scan local_documents folder, normalize line endings, and synchronize SQLite state."""
    return document_service.sync_local_directory_with_db(db=db)
