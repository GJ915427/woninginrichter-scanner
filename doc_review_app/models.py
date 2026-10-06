"""Data models and Pydantic schemas for Document Review Web Application.

Defines schemas for Users, Sessions, Documents, Annotations, Comments,
along with validation logic and comment tree reconstruction algorithms.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator


def compute_initials(
    full_name: Optional[str] = None,
    username: Optional[str] = None,
    explicit_initials: Optional[str] = None,
) -> str:
    """Extract uppercase initials for Google Material Design 3 avatars.

    Resolution hierarchy:
    1. explicit_initials if non-empty (up to 4 chars).
    2. Derived from full_name:
       - Multi-word: first letter of first word + first letter of last word.
       - Single-word (mononym): first letter uppercase.
    3. Derived from username (split on '_', '.', '-'):
       - Multi-word: first letter of first word + first letter of last word.
       - Single-word: first letter uppercase.
    4. Fallback 'US' (User).
    """
    if explicit_initials and explicit_initials.strip():
        return explicit_initials.strip()[:4].upper()

    if full_name and full_name.strip():
        parts = [p for p in full_name.strip().split() if p]
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        elif len(parts) == 1:
            return parts[0][0].upper()

    if username and username.strip():
        cleaned = username.strip().replace("_", " ").replace(".", " ").replace("-", " ")
        parts = [p for p in cleaned.split() if p]
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        elif len(parts) == 1:
            return parts[0][0].upper()

    return "US"


class UserBase(BaseModel):
    """Base schema for user entities."""

    username: str
    full_name: str
    email: Optional[str] = None
    initials: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    """Payload for provisioning a new user."""

    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    initials: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def resolve_initials(self) -> "UserCreate":
        """Compute initials automatically if not explicitly provided."""
        if not self.initials or not self.initials.strip():
            self.initials = compute_initials(
                full_name=self.full_name,
                username=self.username,
            )
        else:
            self.initials = self.initials.strip().upper()
        return self


class UserLogin(BaseModel):
    """Login credentials schema."""

    username: str
    password: str


class UserResponse(BaseModel):
    """Public user profile excluding password hash."""

    id: int
    username: str
    initials: str
    full_name: str
    email: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)

    def get(self, item: str, default: Any = None) -> Any:
        return getattr(self, item, default)


class User(UserResponse):
    """Alias for user response model."""

    pass


class UserInDB(UserResponse):
    """Internal database user model including password hash."""

    password_hash: str


class SessionResponse(BaseModel):
    """Active session metadata."""

    token: str
    user_id: int
    expires_at: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    """Response returned upon successful authentication."""

    token: str
    user: UserResponse


class DocumentSyncRequest(BaseModel):
    """Request payload for syncing a document from local storage."""

    filename: str
    content: str
    format: Optional[Literal["markdown", "text"]] = None


class DocumentSyncResponse(BaseModel):
    """Response payload after syncing a document."""

    id: int
    filename: str
    action: Literal["created", "updated"]
    sha256: str


class DocumentSummary(BaseModel):
    """Summary representation for document list endpoints."""

    id: int
    filename: str
    title: str
    format: str
    size_bytes: int
    updated_at: str
    comment_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CommentCreate(BaseModel):
    """Payload to create a new comment or reply."""

    content: str
    parent_comment_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_content(self) -> "CommentCreate":
        if not self.content or not self.content.strip():
            raise ValueError("content cannot be empty or whitespace only")
        return self


class CommentUpdate(BaseModel):
    """Payload to edit an existing comment."""

    content: str

    @model_validator(mode="after")
    def validate_content(self) -> "CommentUpdate":
        if not self.content or not self.content.strip():
            raise ValueError("content cannot be empty or whitespace only")
        return self


class CommentEditResponse(BaseModel):
    """Response payload after editing a comment."""

    id: int
    content: str
    is_edited: bool = True
    updated_at: str


class CommentResponse(BaseModel):
    """Full comment model including nested recursive replies."""

    id: int
    annotation_id: int
    parent_comment_id: Optional[int] = None
    user_id: int
    author_initials: str
    author_name: Optional[str] = None
    author_username: Optional[str] = None
    content: str
    is_edited: bool = False
    is_deleted: bool = False
    deleted_at: Optional[str] = None
    created_at: str
    updated_at: str
    replies: List["CommentResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


CommentResponse.model_rebuild()


class AnnotationCreate(BaseModel):
    """Payload for creating a highlighted text annotation."""

    start_offset: int
    end_offset: int
    selected_text: str
    comment_content: Optional[str] = None
    badge_color: str = "#FF6D00"
    ast_path: Optional[str] = None
    node_type: Optional[str] = None

    @model_validator(mode="after")
    def validate_offsets(self) -> "AnnotationCreate":
        """Ensure non-negative start_offset and end_offset strictly greater than start_offset."""
        if self.start_offset < 0:
            raise ValueError("start_offset must be non-negative (>= 0)")
        if self.end_offset <= self.start_offset:
            raise ValueError("end_offset must be strictly greater than start_offset")
        if self.comment_content is not None and not self.comment_content.strip():
            raise ValueError("comment_content cannot be empty or whitespace only")
        return self


class AnnotationResponse(BaseModel):
    """Annotation representation with associated comments."""

    id: int
    document_id: int
    author_id: int
    start_offset: int
    end_offset: int
    selected_text: str
    badge_color: str = "#FF6D00"
    color: Optional[str] = "#FF6D00"
    status: str = "open"
    is_deleted: bool = False
    deleted_at: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    ast_path: Optional[str] = None
    node_type: Optional[str] = None
    comments: List[CommentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    """Immutable audit trail record for annotations and comments."""

    id: int
    entity_type: str
    entity_id: int
    document_id: Optional[int] = None
    action: str
    user_id: int
    user_initials: Optional[str] = None
    user_name: Optional[str] = None
    user_username: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    metadata: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class DocumentDetail(BaseModel):
    """Detailed document representation with full content and annotations."""

    id: int
    filename: str
    title: str
    content: str
    format: str
    content_hash: str
    file_size: int
    created_at: str
    updated_at: str
    annotations: List[AnnotationResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


def build_comment_tree(
    comment_rows: List[Union[Dict[str, Any], Any]]
) -> List[CommentResponse]:
    """Convert a flat list of comment rows or dictionaries into a nested tree."""
    nodes: Dict[int, CommentResponse] = {}
    root_comments: List[CommentResponse] = []

    for row in comment_rows:
        data = dict(row) if hasattr(row, "keys") else row
        comment_id = data["id"]
        nodes[comment_id] = CommentResponse(
            id=comment_id,
            annotation_id=data["annotation_id"],
            parent_comment_id=data.get("parent_comment_id"),
            user_id=data["user_id"],
            author_initials=data.get("author_initials") or "??",
            content=data["content"],
            is_edited=bool(data.get("is_edited", False)),
            created_at=str(data["created_at"]),
            updated_at=str(data["updated_at"]),
            replies=[],
        )

    for comment_id, node in nodes.items():
        parent_id = node.parent_comment_id
        if parent_id is not None and parent_id in nodes:
            nodes[parent_id].replies.append(node)
        else:
            root_comments.append(node)

    return root_comments
