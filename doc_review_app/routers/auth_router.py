"""Authentication router providing login, logout, and current user profile endpoints.

Endpoints:
    POST /api/auth/login   Authenticate credentials, issue token and session cookie.
    POST /api/auth/logout  Revoke active session token and clear session cookie.
    GET  /api/auth/me      Retrieve authenticated user's profile and permissions.
"""

import sqlite3
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Response, status

from doc_review_app.auth import get_current_token, get_current_user
from doc_review_app.config import settings
from doc_review_app.database import get_db_session
from doc_review_app.models import LoginResponse, User, UserLogin, UserResponse
from doc_review_app.services import user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
)
def login(
    credentials: UserLogin,
    response: Response,
    db: sqlite3.Connection = Depends(get_db_session),
) -> LoginResponse:
    """Authenticate user with username and password, issuing session token and cookie."""
    if not credentials.username or not credentials.username.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty.",
        )
    if not credentials.password or not credentials.password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password cannot be empty.",
        )
    if len(credentials.password) > 4096:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password length exceeds allowable limit.",
        )

    user = user_service.authenticate_user(
        db=db,
        username=credentials.username.strip(),
        password=credentials.password,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issue session token
    token = user_service.create_session(db=db, user_id=user["id"])

    # Set HTTP-only secure cookie
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_expiry_days * 86400,
        httponly=True,
        samesite="lax",
        path="/",
    )

    user_resp = UserResponse.model_validate(user)
    return LoginResponse(token=token, user=user_resp)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="User Logout",
)
def logout(
    response: Response,
    token: str = Depends(get_current_token),
    db: sqlite3.Connection = Depends(get_db_session),
) -> Dict[str, str]:
    """Revoke active session token and clear HTTP-only session cookie."""
    user_service.revoke_session(db=db, token=token)
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return {"status": "success", "message": "Logged out"}


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Current User Profile",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return profile and permissions for currently authenticated user."""
    return UserResponse.model_validate(current_user)
