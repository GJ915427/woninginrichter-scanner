"""Comment and annotation service layer for Document Review Web Application.

Provides business logic for creating annotations, managing threaded comment hierarchies,
enforcing author initials derivation, and strict comment self-editing access control.
"""

from datetime import datetime, timezone
import sqlite3
from typing import Any, Dict, List, Optional, Union

from fastapi import HTTPException, status

from doc_review_app.database import get_db
from doc_review_app.models import User


def log_audit_entry(
    conn: sqlite3.Connection,
    entity_type: str,
    entity_id: int,
    action: str,
    user_id: int,
    user_initials: Optional[str] = None,
    document_id: Optional[int] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    metadata: Optional[str] = None,
) -> int:
    """Log an audit entry in the immutable audit_logs table."""
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        """
        INSERT INTO audit_logs (
            entity_type, entity_id, document_id, action, user_id, user_initials,
            old_value, new_value, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entity_type,
            entity_id,
            document_id,
            action,
            user_id,
            user_initials,
            old_value,
            new_value,
            metadata,
            now_iso,
        ),
    )
    return cursor.lastrowid


def create_annotation(
    document_id: int,
    start_offset: int,
    end_offset: int,
    selected_text: str,
    comment_content: Optional[str] = None,
    user: Optional[Any] = None,
    badge_color: str = "#FF6D00",
    ast_path: Optional[str] = None,
    node_type: Optional[str] = None,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Create a new annotation anchored to document text offsets with optional initial comment."""
    if document_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
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

    user_id = getattr(user, "id", None) if user else 1
    if isinstance(user, dict):
        user_id = user.get("id", 1)
    if user_id is None:
        user_id = 1

    user_initials = getattr(user, "initials", None) if user else "??"
    if isinstance(user, dict):
        user_initials = user.get("initials", "??")
    if not user_initials:
        user_initials = "??"

    now_iso = datetime.now(timezone.utc).isoformat()

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        # Validate document exists
        doc = conn.execute(
            "SELECT id, content FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {document_id} not found",
            )

        content = doc["content"]
        if end_offset > len(content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"end_offset ({end_offset}) exceeds document length ({len(content)})",
            )

        cursor = conn.execute(
            """
            INSERT INTO annotations (
                document_id, author_id, start_offset, end_offset, selected_text, badge_color, status, is_deleted, created_at, updated_at, ast_path, node_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (
                document_id,
                user_id,
                start_offset,
                end_offset,
                selected_text,
                badge_color,
                "open",
                now_iso,
                now_iso,
                ast_path,
                node_type,
            ),
        )
        ann_id = cursor.lastrowid
        log_audit_entry(
            conn=conn,
            entity_type="annotation",
            entity_id=ann_id,
            action="CREATE",
            user_id=user_id,
            user_initials=user_initials,
            document_id=document_id,
            new_value=selected_text,
        )

        comments = []
        if comment_content and str(comment_content).strip():
            stripped_comment = str(comment_content).strip()
            c_cursor = conn.execute(
                """
                INSERT INTO comments (
                    annotation_id, parent_comment_id, user_id, author_initials, content, is_edited, is_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    ann_id,
                    None,
                    user_id,
                    user_initials,
                    stripped_comment,
                    0,
                    now_iso,
                    now_iso,
                ),
            )
            root_comment_id = c_cursor.lastrowid
            log_audit_entry(
                conn=conn,
                entity_type="comment",
                entity_id=root_comment_id,
                action="CREATE",
                user_id=user_id,
                user_initials=user_initials,
                document_id=document_id,
                new_value=stripped_comment,
            )
            user_name = getattr(user, "full_name", None) or (user.get("full_name") if isinstance(user, dict) else None)
            user_username = getattr(user, "username", None) or (user.get("username") if isinstance(user, dict) else None)
            comments.append({
                "id": root_comment_id,
                "annotation_id": ann_id,
                "parent_comment_id": None,
                "user_id": user_id,
                "author_id": user_id,
                "author_initials": user_initials,
                "author_name": user_name,
                "author_username": user_username,
                "content": stripped_comment,
                "is_edited": False,
                "is_deleted": False,
                "deleted_at": None,
                "created_at": now_iso,
                "updated_at": now_iso,
            })

        return {
            "id": ann_id,
            "document_id": document_id,
            "author_id": user_id,
            "start_offset": start_offset,
            "end_offset": end_offset,
            "selected_text": selected_text,
            "badge_color": badge_color,
            "color": badge_color,
            "status": "open",
            "is_deleted": False,
            "deleted_at": None,
            "ast_path": ast_path,
            "node_type": node_type,
            "created_at": now_iso,
            "updated_at": now_iso,
            "comments": comments,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def list_annotations(
    document_id: int,
    user: Optional[Any] = None,
    db: Optional[sqlite3.Connection] = None,
) -> List[Dict[str, Any]]:
    """List all annotations for a document with their ordered comments."""
    if document_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
        # Check document exists
        doc = conn.execute(
            "SELECT id, filename FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {document_id} not found",
            )

        ann_cursor = conn.execute(
            """
            SELECT id, document_id, author_id, start_offset, end_offset, selected_text, badge_color, status, is_deleted, created_at, updated_at, ast_path, node_type
            FROM annotations
            WHERE document_id = ? AND is_deleted = 0
            ORDER BY start_offset ASC, id ASC
            """,
            (document_id,),
        )
        ann_rows = ann_cursor.fetchall()

        results = []
        for ann in ann_rows:
            com_cursor = conn.execute(
                """
                SELECT c.id, c.annotation_id, c.parent_comment_id, c.user_id, c.author_initials, c.content, c.is_edited, c.is_deleted, c.deleted_at, c.created_at, c.updated_at,
                       u.full_name AS author_name, u.username AS author_username
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.annotation_id = ?
                ORDER BY c.created_at ASC, c.id ASC
                """,
                (ann["id"],),
            )
            comments = [
                {
                    "id": c["id"],
                    "annotation_id": c["annotation_id"],
                    "parent_comment_id": c["parent_comment_id"],
                    "user_id": c["user_id"],
                    "author_id": c["user_id"],
                    "author_initials": c["author_initials"],
                    "author_name": c["author_name"],
                    "author_username": c["author_username"],
                    "content": "[Opmerking verwijderd]" if c["is_deleted"] else c["content"],
                    "is_edited": bool(c["is_edited"]),
                    "is_deleted": bool(c["is_deleted"]),
                    "deleted_at": c["deleted_at"],
                    "created_at": c["created_at"],
                    "updated_at": c["updated_at"],
                }
                for c in com_cursor.fetchall()
            ]

            results.append({
                "id": ann["id"],
                "document_id": ann["document_id"],
                "author_id": ann["author_id"],
                "start_offset": ann["start_offset"],
                "end_offset": ann["end_offset"],
                "selected_text": ann["selected_text"],
                "badge_color": ann["badge_color"],
                "color": ann["badge_color"],
                "status": ann["status"],
                "is_deleted": bool(ann["is_deleted"]),
                "ast_path": ann["ast_path"] if "ast_path" in ann.keys() else None,
                "node_type": ann["node_type"] if "node_type" in ann.keys() else None,
                "created_at": ann["created_at"],
                "updated_at": ann["updated_at"],
                "comments": comments,
            })

        return results

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def get_annotation_by_id(
    annotation_id: int,
    db: Optional[sqlite3.Connection] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve single annotation with full comment thread."""
    if annotation_id <= 0:
        return None

    def _execute(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
        ann_row = conn.execute(
            """
            SELECT id, document_id, author_id, start_offset, end_offset, selected_text, badge_color, status, is_deleted, created_at, updated_at
            FROM annotations
            WHERE id = ? AND is_deleted = 0
            """,
            (annotation_id,),
        ).fetchone()

        if not ann_row:
            return None

        com_cursor = conn.execute(
            """
            SELECT c.id, c.annotation_id, c.parent_comment_id, c.user_id, c.author_initials, c.content, c.is_edited, c.is_deleted, c.deleted_at, c.created_at, c.updated_at,
                   u.full_name AS author_name, u.username AS author_username
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.annotation_id = ?
            ORDER BY c.created_at ASC, c.id ASC
            """,
            (annotation_id,),
        )
        comments = [
            {
                "id": c["id"],
                "annotation_id": c["annotation_id"],
                "parent_comment_id": c["parent_comment_id"],
                "user_id": c["user_id"],
                "author_id": c["user_id"],
                "author_initials": c["author_initials"],
                "author_name": c["author_name"],
                "author_username": c["author_username"],
                "content": "[Opmerking verwijderd]" if c["is_deleted"] else c["content"],
                "is_edited": bool(c["is_edited"]),
                "is_deleted": bool(c["is_deleted"]),
                "deleted_at": c["deleted_at"],
                "created_at": c["created_at"],
                "updated_at": c["updated_at"],
            }
            for c in com_cursor.fetchall()
        ]

        return {
            "id": ann_row["id"],
            "document_id": ann_row["document_id"],
            "author_id": ann_row["author_id"],
            "start_offset": ann_row["start_offset"],
            "end_offset": ann_row["end_offset"],
            "selected_text": ann_row["selected_text"],
            "badge_color": ann_row["badge_color"],
            "color": ann_row["badge_color"],
            "status": ann_row["status"],
            "is_deleted": bool(ann_row["is_deleted"]),
            "created_at": ann_row["created_at"],
            "updated_at": ann_row["updated_at"],
            "comments": comments,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def add_comment_reply(
    annotation_id: int,
    content: str,
    user: Any,
    parent_comment_id: Optional[int] = None,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Add a threaded reply to an annotation comment."""
    if not content or not str(content).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content cannot be empty or whitespace only",
        )

    user_id = getattr(user, "id", None) if user else 1
    if isinstance(user, dict):
        user_id = user.get("id", 1)
    if user_id is None:
        user_id = 1

    user_initials = getattr(user, "initials", None) if user else "??"
    if isinstance(user, dict):
        user_initials = user.get("initials", "??")
    if not user_initials:
        user_initials = "??"

    now_iso = datetime.now(timezone.utc).isoformat()
    clean_content = str(content).strip()

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        # Validate annotation exists and is active
        ann = conn.execute(
            "SELECT id, document_id, is_deleted FROM annotations WHERE id = ?",
            (annotation_id,),
        ).fetchone()
        if not ann or ann["is_deleted"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Annotation with ID {annotation_id} not found",
            )

        if parent_comment_id is not None:
            parent = conn.execute(
                "SELECT id, annotation_id FROM comments WHERE id = ?",
                (parent_comment_id,),
            ).fetchone()
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parent comment with ID {parent_comment_id} not found",
                )
            if parent["annotation_id"] != annotation_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent comment belongs to a different annotation",
                )

        cursor = conn.execute(
            """
            INSERT INTO comments (
                annotation_id, parent_comment_id, user_id, author_initials, content, is_edited, is_deleted, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                annotation_id,
                parent_comment_id,
                user_id,
                user_initials,
                clean_content,
                0,
                now_iso,
                now_iso,
            ),
        )
        comment_id = cursor.lastrowid
        log_audit_entry(
            conn=conn,
            entity_type="comment",
            entity_id=comment_id,
            action="CREATE",
            user_id=user_id,
            user_initials=user_initials,
            document_id=ann["document_id"],
            new_value=clean_content,
        )

        user_name = getattr(user, "full_name", None) or (user.get("full_name") if isinstance(user, dict) else None)
        user_username = getattr(user, "username", None) or (user.get("username") if isinstance(user, dict) else None)

        return {
            "id": comment_id,
            "annotation_id": annotation_id,
            "parent_comment_id": parent_comment_id,
            "user_id": user_id,
            "author_id": user_id,
            "author_initials": user_initials,
            "author_name": user_name,
            "author_username": user_username,
            "content": clean_content,
            "is_edited": False,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def get_comment_by_id(
    comment_id: int,
    db: Optional[sqlite3.Connection] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve single comment by ID."""
    if comment_id <= 0:
        return None

    def _execute(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            """
            SELECT c.id, c.annotation_id, c.parent_comment_id, c.user_id, c.author_initials, c.content, c.is_edited, c.is_deleted, c.deleted_at, c.created_at, c.updated_at,
                   u.full_name AS author_name, u.username AS author_username
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
            """,
            (comment_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "annotation_id": row["annotation_id"],
            "parent_comment_id": row["parent_comment_id"],
            "user_id": row["user_id"],
            "author_id": row["user_id"],
            "author_initials": row["author_initials"],
            "author_name": row["author_name"],
            "author_username": row["author_username"],
            "content": "[Opmerking verwijderd]" if row["is_deleted"] else row["content"],
            "is_edited": bool(row["is_edited"]),
            "is_deleted": bool(row["is_deleted"]),
            "deleted_at": row["deleted_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def edit_comment(
    comment_id: int,
    new_content: str,
    user: Any,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Edit comment content with strict ownership check and audit logging."""
    if not new_content or not str(new_content).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment content cannot be empty or whitespace only",
        )

    user_id = getattr(user, "id", None) if user else 1
    if isinstance(user, dict):
        user_id = user.get("id", 1)
    if user_id is None:
        user_id = 1
    is_admin = bool(getattr(user, "is_admin", False))
    if isinstance(user, dict):
        is_admin = bool(user.get("is_admin", False))

    now_iso = datetime.now(timezone.utc).isoformat()
    clean_content = str(new_content)

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        row = conn.execute(
            """
            SELECT c.id, c.annotation_id, c.parent_comment_id, c.user_id, c.author_initials, c.content, c.is_edited, c.is_deleted, c.created_at, c.updated_at,
                   a.document_id, u.full_name AS author_name, u.username AS author_username
            FROM comments c
            JOIN annotations a ON c.annotation_id = a.id
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
            """,
            (comment_id,),
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment with ID {comment_id} not found",
            )

        if row["is_deleted"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot edit a deleted comment",
            )

        # Strict ownership enforcement: only the original comment author can edit the content (even admins cannot edit other authors' comments)
        if row["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You cannot edit another user's comment",
            )

        conn.execute(
            """
            UPDATE comments
            SET content = ?,
                is_edited = 1,
                updated_at = ?
            WHERE id = ?
            """,
            (clean_content, now_iso, comment_id),
        )

        log_audit_entry(
            conn=conn,
            entity_type="comment",
            entity_id=comment_id,
            action="UPDATE",
            user_id=user_id,
            user_initials=row["author_initials"],
            document_id=row["document_id"],
            old_value=row["content"],
            new_value=clean_content,
        )

        return {
            "id": comment_id,
            "annotation_id": row["annotation_id"],
            "parent_comment_id": row["parent_comment_id"],
            "user_id": row["user_id"],
            "author_id": row["user_id"],
            "author_initials": row["author_initials"],
            "author_name": row["author_name"],
            "author_username": row["author_username"],
            "content": clean_content,
            "is_edited": True,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": row["created_at"],
            "updated_at": now_iso,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def delete_comment(
    comment_id: int,
    user: Any,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Soft delete a comment with ownership check and complete audit logging."""
    user_id = getattr(user, "id", None) if user else 1
    if isinstance(user, dict):
        user_id = user.get("id", 1)
    if user_id is None:
        user_id = 1

    is_admin = bool(getattr(user, "is_admin", False))
    if isinstance(user, dict):
        is_admin = bool(user.get("is_admin", False))

    user_initials = getattr(user, "initials", None) or (user.get("initials") if isinstance(user, dict) else None) or "??"

    now_iso = datetime.now(timezone.utc).isoformat()

    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        row = conn.execute(
            """
            SELECT c.id, c.annotation_id, c.parent_comment_id, c.user_id, c.author_initials, c.content, c.is_deleted,
                   a.document_id
            FROM comments c
            JOIN annotations a ON c.annotation_id = a.id
            WHERE c.id = ?
            """,
            (comment_id,),
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment with ID {comment_id} not found",
            )

        if row["is_deleted"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment is already deleted",
            )

        if not is_admin and row["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You cannot delete another user's comment",
            )

        # Logical deletion (soft delete)
        conn.execute(
            """
            UPDATE comments
            SET is_deleted = 1,
                deleted_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (now_iso, now_iso, comment_id),
        )

        log_audit_entry(
            conn=conn,
            entity_type="comment",
            entity_id=comment_id,
            action="SOFT_DELETE",
            user_id=user_id,
            user_initials=user_initials,
            document_id=row["document_id"],
            old_value=row["content"],
            new_value=None,
        )

        # Check remaining active comments for this annotation
        active_remaining = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM comments
            WHERE annotation_id = ? AND is_deleted = 0
            """,
            (row["annotation_id"],),
        ).fetchone()["count"]

        annotation_deleted = False
        if active_remaining == 0:
            conn.execute(
                """
                UPDATE annotations
                SET is_deleted = 1,
                    deleted_at = ?,
                    status = 'deleted',
                    updated_at = ?
                WHERE id = ?
                """,
                (now_iso, now_iso, row["annotation_id"]),
            )
            log_audit_entry(
                conn=conn,
                entity_type="annotation",
                entity_id=row["annotation_id"],
                action="SOFT_DELETE",
                user_id=user_id,
                user_initials=user_initials,
                document_id=row["document_id"],
                old_value=None,
                new_value=None,
            )
            annotation_deleted = True

        return {
            "id": comment_id,
            "annotation_id": row["annotation_id"],
            "is_deleted": True,
            "deleted_at": now_iso,
            "annotation_deleted": annotation_deleted,
            "active_remaining": active_remaining,
            "message": "Comment soft-deleted successfully",
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def get_comment_history(
    comment_id: int,
    db: Optional[sqlite3.Connection] = None,
) -> List[Dict[str, Any]]:
    """Retrieve full audit log history for a specific comment."""
    def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
        rows = conn.execute(
            """
            SELECT l.id, l.entity_type, l.entity_id, l.document_id, l.action,
                   l.user_id, l.user_initials, l.old_value, l.new_value, l.metadata, l.created_at,
                   u.full_name AS user_name, u.username AS user_username
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.entity_type = 'comment' AND l.entity_id = ?
            ORDER BY l.id ASC
            """,
            (comment_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def list_document_audit_logs(
    document_id: int,
    db: Optional[sqlite3.Connection] = None,
) -> List[Dict[str, Any]]:
    """Retrieve all audit log events for a document."""
    def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
        rows = conn.execute(
            """
            SELECT l.id, l.entity_type, l.entity_id, l.document_id, l.action,
                   l.user_id, l.user_initials, l.old_value, l.new_value, l.metadata, l.created_at,
                   u.full_name AS user_name, u.username AS user_username
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.document_id = ?
            ORDER BY l.id DESC
            """,
            (document_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def resolve_ast_from_markdown(content: str, start_offset: int, selected_text: str = "") -> Tuple[str, str]:
    """Dynamically resolve AST breadcrumb path and node type from raw Markdown text and character offset."""
    if not content:
        return ("Document Root", "Paragraph")

    import re

    offset = max(0, min(start_offset, len(content)))
    st_clean = (selected_text or "").strip()
    if st_clean:
        first_phrase = st_clean.splitlines()[0][:40]
        idx = content.find(first_phrase)
        if idx != -1:
            offset = idx
        else:
            words = re.findall(r"\b\w{4,}\b", st_clean)
            for w in words[:3]:
                pos = content.find(w)
                if pos != -1:
                    offset = pos
                    break

    lines_before = content[:offset].splitlines()
    headings: Dict[int, str] = {}
    for line in lines_before:
        m = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
        if m:
            lvl = len(m.group(1))
            title = m.group(2).strip()
            headings = {k: v for k, v in headings.items() if k < lvl}
            headings[lvl] = title

    breadcrumb = [headings[k] for k in sorted(headings.keys()) if k > 1]
    if not breadcrumb and 1 in headings:
        breadcrumb = [headings[1]]

    line_end = content.find("\n", offset)
    if line_end == -1:
        line_end = len(content)
    current_line = content[offset:line_end].strip()

    node_type = "Paragraph"
    sub_label = None
    if re.match(r"^#{1,6}\s+", current_line):
        node_type = "Heading"
    elif re.match(r"^[\*\-\+]\s+", current_line) or re.match(r"^\d+\.\s+", current_line):
        node_type = "ListItem"
        label_match = re.search(r"\*\*([^*]+)\*\*|\*([^*]+)\*", current_line)
        if label_match:
            sub_label = (label_match.group(1) or label_match.group(2)).strip().rstrip(":")

    if sub_label and sub_label not in " ".join(breadcrumb):
        breadcrumb.append(sub_label)

    path = " > ".join(breadcrumb) if breadcrumb else "Document Root"
    return (path, node_type)


def generate_document_ast_feedback(
    document_id: int,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Compile all open review comments for a document into a structured AST-anchored report."""
    def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
        doc = conn.execute(
            "SELECT id, filename, title, content FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {document_id} not found",
            )

        filename = doc["filename"] or f"document_{document_id}.md"
        doc_title = doc["title"] or filename
        doc_content = doc["content"] or ""

        ann_rows = conn.execute(
            """
            SELECT id, document_id, author_id, start_offset, end_offset, selected_text, badge_color, status, is_deleted, ast_path, node_type, created_at, updated_at
            FROM annotations
            WHERE document_id = ? AND is_deleted = 0
            ORDER BY start_offset ASC, id ASC
            """,
            (document_id,),
        ).fetchall()

        feedback_items = []
        md_sections = []
        total_comments = 0

        # Pre-count total comments
        for ann in ann_rows:
            com_count = conn.execute(
                "SELECT COUNT(id) FROM comments WHERE annotation_id = ? AND is_deleted = 0",
                (ann["id"],),
            ).fetchone()[0]
            total_comments += com_count

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        md_sections.append(f"# AST Review Feedback voor `{filename}`\n")
        md_sections.append(f"> **Tijdstempel:** {now_str}")
        md_sections.append(f"> **Doeldocument:** `{filename}` ({doc_title})")
        md_sections.append(f"> **Totaal:** {total_comments} opmerkingen verdeeld over {len(ann_rows)} tekstsecties\n")
        md_sections.append(
            "> **Instructie voor de AI / Antigravity Agent:**\n"
            "> Onderstaande opmerkingen zijn geankerd aan de semantische AST (Abstract Syntax Tree) van dit document.\n"
            "> Gebruik de vermelde AST-paden (`ast_path`) en compacte tekstpassages om de betreffende nodes\n"
            "> chirurgisch in het bestand op te zoeken en aan te passen.\n"
        )

        for idx, ann in enumerate(ann_rows, 1):
            ann_id = ann["id"]
            ast_path = ann["ast_path"]
            node_type = ann["node_type"]
            selected_text = ann["selected_text"] or ""

            # Automatic fallback to dynamic markdown AST resolution if ast_path is missing or generic
            if not ast_path or ast_path == "Document Root":
                resolved_path, resolved_type = resolve_ast_from_markdown(
                    doc_content, ann["start_offset"], selected_text
                )
                ast_path = resolved_path
                node_type = node_type or resolved_type

            node_type = node_type or "Paragraph"

            # Format selected text passage cleanly without flooding export
            clean_st = selected_text.strip()
            if len(clean_st) > 160:
                passage_preview = clean_st[:140].strip() + f"... [ingekort: {len(clean_st)} tekens]"
            else:
                passage_preview = clean_st

            com_rows = conn.execute(
                """
                SELECT c.id, c.user_id, c.author_initials, c.content, c.is_edited, c.created_at,
                       u.full_name AS author_name, u.username AS author_username
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.annotation_id = ? AND c.is_deleted = 0
                ORDER BY c.created_at ASC, c.id ASC
                """,
                (ann_id,),
            ).fetchall()

            item_lines = []
            item_lines.append(f"### #{idx} AST: `{ast_path}`")
            item_lines.append(f"* **Node Type:** `{node_type}`")
            item_lines.append(f"* **Passage / Anchor:**\n  > \"{passage_preview}\"")

            if com_rows:
                item_lines.append(f"* **Opmerkingen ({len(com_rows)}):**")
                for c in com_rows:
                    author = c["author_name"] or c["author_username"] or "Reviewer"
                    initials = c["author_initials"] or "??"
                    content = c["content"]
                    item_lines.append(f"  - **{author} ({initials}):** {content}")
            else:
                item_lines.append("* **Opmerkingen:** *(Geen opmerkingstekst ingevoerd)*")

            item_lines.append(f"* [ ] **Status:** Openstaand (verwerk in AST-node `{ast_path}`)\n")

            md_sections.append("\n".join(item_lines))
            feedback_items.append({
                "annotation_id": ann_id,
                "ast_path": ast_path,
                "node_type": node_type,
                "selected_text": selected_text,
                "comments_count": len(com_rows),
            })

        full_markdown = "\n---\n".join(md_sections)

        return {
            "document_id": document_id,
            "filename": filename,
            "markdown": full_markdown,
            "annotations_count": len(ann_rows),
            "items": feedback_items,
        }

    if db is not None:
        return _execute(db)
    with get_db() as conn:
        return _execute(conn)


def export_document_ast_feedback_to_file(
    document_id: int,
    db: Optional[sqlite3.Connection] = None,
) -> Dict[str, Any]:
    """Compile AST feedback and persist to local_documents/<filename>.feedback.md."""
    res = generate_document_ast_feedback(document_id=document_id, db=db)
    from pathlib import Path
    from doc_review_app.config import settings

    filename = res["filename"]
    stem = Path(filename).stem
    feedback_filename = f"{stem}.feedback.md"
    target_path = settings.documents_dir / feedback_filename

    target_path.write_text(res["markdown"], encoding="utf-8")

    return {
        "status": "success",
        "document_id": document_id,
        "filename": feedback_filename,
        "file_path": str(target_path),
        "export_path": str(target_path),
        "markdown": res["markdown"],
        "annotations_count": res["annotations_count"],
    }
