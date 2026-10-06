"""Authentication, password security, session handling, and security dependencies.

Implements PBKDF2-HMAC-SHA256 password hashing (600,000 rounds), constant-time
verification, dual-source session token extraction (Authorization header or cookie),
and FastAPI access control dependencies (`get_current_user`, `require_admin`).
"""

import hashlib
import hmac
import os
import sqlite3
from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from doc_review_app.config import settings
from doc_review_app.database import get_db_session
from doc_review_app.models import User

PBKDF2_ITERATIONS = 600_000
PBKDF2_ALGORITHM = "sha256"
SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 600,000 iterations and random salt."""
    salt = os.urandom(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
        dklen=32,
    )
    return f"pbkdf2:{PBKDF2_ALGORITHM}:{PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against PBKDF2 hash using constant-time comparison."""
    if not plain_password or not hashed_password:
        return False
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        meta, salt_hex, derived_hex = parts
        meta_parts = meta.split(":")
        if len(meta_parts) != 3:
            return False
        prefix, algo, iters_str = meta_parts
        if prefix != "pbkdf2" or algo != PBKDF2_ALGORITHM:
            return False
        iterations = int(iters_str)
        salt = bytes.fromhex(salt_hex)
        candidate = hashlib.pbkdf2_hmac(
            algo,
            plain_password.encode("utf-8"),
            salt,
            iterations,
            dklen=32,
        ).hex()
        return hmac.compare_digest(candidate, derived_hex)
    except Exception:
        return False


def extract_token_from_request(request: Request) -> Optional[str]:
    """Extract authentication session token from Authorization header or cookie.

    Precedence:
    1. Authorization header: Must be 'Bearer <non-empty-token>'.
       If an Authorization header is explicitly passed but malformed, empty, or
       uses a non-Bearer scheme, returns None (rejecting fallback).
    2. Session cookie: 'session_token' (or configured settings.session_cookie_name).
    """
    auth_header = request.headers.get("Authorization")
    if auth_header is not None:
        parts = auth_header.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
            return token if token else None
        return None

    # Fallback to session cookie
    cookie_token = request.cookies.get(settings.session_cookie_name)
    if cookie_token and cookie_token.strip():
        return cookie_token.strip()

    return None


def get_current_token(request: Request) -> str:
    """FastAPI dependency extracting session token or raising HTTP 401 Unauthorized."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


def get_current_user(
    token: str = Depends(get_current_token),
    db: sqlite3.Connection = Depends(get_db_session),
) -> User:
    """FastAPI dependency resolving current user from session token or raising HTTP 401."""
    from doc_review_app.services import user_service

    user_dict = user_service.lookup_and_validate_session(db, token)
    if not user_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return User.model_validate(user_dict)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency asserting current user has administrative privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin access required",
        )
    return current_user
