"""Administrative user provisioning and management router.

Endpoints:
    POST /api/admin/users   Provision new user account (Admin only)
    GET  /api/admin/users   List all provisioned users (Admin only)
"""

import sqlite3
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from doc_review_app.auth import require_admin
from doc_review_app.database import get_db_session
from doc_review_app.models import User, UserCreate, UserResponse, compute_initials
from doc_review_app.services import user_service
from doc_review_app.services.user_service import UserAlreadyExistsError

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision New User (Admin Only)",
)
def create_user(
    user_data: UserCreate,
    current_admin: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_session),
) -> UserResponse:
    """Provision a new user account (reviewer or administrator).

    Access Control:
    - Requires active session with is_admin=True.
    - Unauthenticated requests return 401 Unauthorized.
    - Non-admin authenticated requests return 403 Forbidden.
    - Duplicate username returns 409 Conflict.
    """
    existing_user = user_service.get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    # Derive initials if omitted
    initials = user_data.initials
    if not initials or not initials.strip():
        initials = compute_initials(
            full_name=user_data.full_name,
            username=user_data.username,
        )

    try:
        return user_service.create_user(
            db=db,
            username=user_data.username.strip(),
            password=user_data.password,
            full_name=user_data.full_name,
            initials=initials,
            email=user_data.email,
            is_admin=user_data.is_admin,
        )
    except (UserAlreadyExistsError, sqlite3.IntegrityError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )


@router.get(
    "/users",
    response_model=List[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="List Provisioned Users (Admin Only)",
)
def list_users(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_admin: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_session),
) -> List[UserResponse]:
    """Retrieve list of all provisioned users ordered by ID."""
    return user_service.list_users(db=db, limit=limit, offset=offset)
