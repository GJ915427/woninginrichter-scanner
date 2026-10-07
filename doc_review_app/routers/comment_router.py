"""FastAPI Router for Annotations and Threaded Comments endpoints."""

from typing import Any, Dict, List, Optional
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, status

from doc_review_app.auth import get_current_token, get_current_user, require_admin
from doc_review_app.database import get_db_session
from doc_review_app.models import User
from doc_review_app.services import comment_service

router = APIRouter(tags=["Annotations & Comments"])


def get_comment_user(
    request: Request,
    db: sqlite3.Connection = Depends(get_db_session),
) -> User:
    """Dependency for comment/annotation endpoints enforcing Bearer token in Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return get_current_user(token=get_current_token(request), db=db)


@router.post(
    "/documents/{doc_id}/annotations",
    status_code=status.HTTP_201_CREATED,
    summary="Create Annotation with Optional Initial Comment",
)
def create_document_annotation(
    doc_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Create an annotation anchored to document text offsets with optional initial comment."""
    start_offset = payload.get("start_offset")
    end_offset = payload.get("end_offset")
    selected_text = payload.get("selected_text", "")
    comment_content = payload.get("comment_content")
    badge_color = payload.get("badge_color") or payload.get("color") or "#FF6D00"

    if start_offset is None or end_offset is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_offset and end_offset are required",
        )
    try:
        start_offset = int(start_offset)
        end_offset = int(end_offset)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_offset and end_offset must be integers",
        )

    if start_offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_offset must be non-negative (>= 0)",
        )
    if end_offset <= start_offset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_offset must be strictly greater than start_offset",
        )
    if comment_content is not None and not str(comment_content).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="comment_content cannot be empty or whitespace only",
        )

    return comment_service.create_annotation(
        document_id=doc_id,
        start_offset=start_offset,
        end_offset=end_offset,
        selected_text=str(selected_text),
        comment_content=str(comment_content) if comment_content is not None else None,
        user=current_user,
        badge_color=str(badge_color),
        ast_path=payload.get("ast_path"),
        node_type=payload.get("node_type"),
        db=db,
    )


@router.get(
    "/documents/{doc_id}/annotations",
    status_code=status.HTTP_200_OK,
    summary="List Annotations for Document",
)
def list_document_annotations(
    doc_id: int,
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    """List all annotations for a document with their threaded comments."""
    return comment_service.list_annotations(document_id=doc_id, user=current_user, db=db)


@router.get(
    "/annotations/{annotation_id}",
    status_code=status.HTTP_200_OK,
    summary="Get Single Annotation Details",
)
def get_annotation(
    annotation_id: int,
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Retrieve single annotation by ID with all comments."""
    ann = comment_service.get_annotation_by_id(annotation_id=annotation_id, db=db)
    if not ann:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found",
        )
    return ann


@router.post(
    "/annotations/{annotation_id}/comments",
    status_code=status.HTTP_201_CREATED,
    summary="Create Threaded Comment Reply",
)
def create_comment_reply(
    annotation_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Create a comment reply on an annotation."""
    content = payload.get("content")
    parent_comment_id = payload.get("parent_comment_id")

    if content is None or not str(content).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content cannot be empty or whitespace only",
        )

    if parent_comment_id is not None:
        try:
            parent_comment_id = int(parent_comment_id)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="parent_comment_id must be an integer",
            )

    return comment_service.add_comment_reply(
        annotation_id=annotation_id,
        content=str(content),
        user=current_user,
        parent_comment_id=parent_comment_id,
        db=db,
    )


@router.get(
    "/comments/{comment_id}",
    status_code=status.HTTP_200_OK,
    summary="Get Comment by ID",
)
def get_comment(
    comment_id: int,
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Retrieve single comment by ID."""
    comment = comment_service.get_comment_by_id(comment_id=comment_id, db=db)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    return comment


@router.put(
    "/comments/{comment_id}",
    status_code=status.HTTP_200_OK,
    summary="Edit Comment Content (Author Only)",
)
def edit_comment(
    comment_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Edit comment content with strict author ownership enforcement."""
    content = payload.get("content")
    if content is None or not str(content).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content cannot be empty or whitespace only",
        )

    return comment_service.edit_comment(
        comment_id=comment_id,
        new_content=str(content),
        user=current_user,
        db=db,
    )


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft Delete Comment (Author or Admin Only)",
)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Logically delete a comment preserving thread structure, with audit trail."""
    return comment_service.delete_comment(
        comment_id=comment_id,
        user=current_user,
        db=db,
    )


@router.get(
    "/comments/{comment_id}/history",
    status_code=status.HTTP_200_OK,
    summary="Get Comment Audit History",
)
def get_comment_history(
    comment_id: int,
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    """Retrieve full revision history and audit trail for a specific comment."""
    return comment_service.get_comment_history(
        comment_id=comment_id,
        db=db,
    )


@router.get(
    "/documents/{doc_id}/audit-logs",
    status_code=status.HTTP_200_OK,
    summary="Get Document Audit Logs",
)
def get_document_audit_logs(
    doc_id: int,
    current_user: User = Depends(get_comment_user),
    db: sqlite3.Connection = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    """Retrieve all audit log events (creation, edits, deletions) for a document."""
    return comment_service.list_document_audit_logs(
        document_id=doc_id,
        db=db,
    )


@router.get(
    "/documents/{doc_id}/feedback",
    status_code=status.HTTP_200_OK,
    summary="Get Document AST Feedback Report",
)
def get_document_ast_feedback(
    doc_id: int,
    current_user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Retrieve compiled AST-anchored review feedback for AI agents."""
    return comment_service.generate_document_ast_feedback(
        document_id=doc_id,
        db=db,
    )


@router.post(
    "/documents/{doc_id}/export-feedback",
    status_code=status.HTTP_200_OK,
    summary="Export Document AST Feedback to File",
)
def export_document_ast_feedback(
    doc_id: int,
    current_user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, Any]:
    """Compile and save AST feedback file to local_documents/<filename>.feedback.md."""
    return comment_service.export_document_ast_feedback_to_file(
        document_id=doc_id,
        db=db,
    )
