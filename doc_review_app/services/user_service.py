"""User service module handling user CRUD, session management, and authentication."""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import sqlite3
from typing import Any, Dict, List, Optional

from doc_review_app.auth import hash_password, verify_password
from doc_review_app.config import settings
from doc_review_app.models import UserResponse, compute_initials


class UserAlreadyExistsError(sqlite3.IntegrityError):
    """Raised when attempting to create a user with a username that already exists."""
    pass



def create_session(
    db: sqlite3.Connection,
    user_id: int,
    duration_days: Optional[int] = None,
) -> str:
    """Generate a secure session token and persist to sessions table."""
    if duration_days is None:
        duration_days = settings.session_expiry_days

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=duration_days)
    ts = int(now.timestamp())
    salt = secrets.token_hex(8)
    payload = f"{user_id}:{ts}:{salt}"
    sig = hmac.new(
        settings.session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    token = f"{user_id}.{ts}.{salt}.{sig}"

    db.execute(
        """
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (token, user_id, now.isoformat(), expires.isoformat()),
    )
    db.commit()
    return token


def lookup_and_validate_session(
    db: sqlite3.Connection,
    token: str,
) -> Optional[Dict[str, Any]]:
    """Look up session token, enforce expiration, and return associated user."""
    cursor = db.execute(
        """
        SELECT
            u.id,
            u.username,
            u.initials,
            u.full_name,
            u.email,
            u.is_admin,
            u.is_active,
            u.created_at,
            u.updated_at,
            s.expires_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
        """,
        (token,),
    )
    row = cursor.fetchone()
    if not row:
        # Fallback: cryptographic verification if database was wiped on Render restart
        parts = token.split(".")
        if len(parts) == 4:
            try:
                user_id_str, ts_str, salt, sig = parts
                user_id = int(user_id_str)
                ts = int(ts_str)
                payload = f"{user_id}:{ts}:{salt}"
                expected_sig = hmac.new(
                    settings.session_secret.encode("utf-8"),
                    payload.encode("utf-8"),
                    hashlib.sha256,
                ).hexdigest()[:32]
                if hmac.compare_digest(sig, expected_sig):
                    token_time = datetime.fromtimestamp(ts, tz=timezone.utc)
                    now = datetime.now(timezone.utc)
                    max_age = timedelta(days=settings.session_expiry_days)
                    if now - token_time < max_age:
                        user = get_user_by_id(db, user_id)
                        if user and bool(user.get("is_active")):
                            # Re-cache into sessions table so subsequent lookups hit fast-path
                            expires = token_time + max_age
                            try:
                                db.execute(
                                    """
                                    INSERT OR REPLACE INTO sessions (token, user_id, created_at, expires_at)
                                    VALUES (?, ?, ?, ?)
                                    """,
                                    (token, user_id, token_time.isoformat(), expires.isoformat()),
                                )
                                db.commit()
                            except Exception:
                                pass
                            return {
                                "id": user["id"],
                                "username": user["username"],
                                "initials": user["initials"],
                                "full_name": user["full_name"],
                                "email": user.get("email"),
                                "is_admin": bool(user.get("is_admin")),
                                "is_active": bool(user.get("is_active")),
                                "created_at": user.get("created_at"),
                                "updated_at": user.get("updated_at"),
                            }
            except Exception:
                pass
        return None

    # Expiration check
    try:
        raw_exp = row["expires_at"].replace("Z", "+00:00")
        expires_at = datetime.fromisoformat(raw_exp)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if expires_at <= now:
            # Opportunistic cleanup of expired session
            db.execute("DELETE FROM sessions WHERE token = ?", (token,))
            db.commit()
            return None
    except Exception:
        return None

    if not bool(row["is_active"]):
        return None

    return {
        "id": row["id"],
        "username": row["username"],
        "initials": row["initials"],
        "full_name": row["full_name"],
        "email": row["email"],
        "is_admin": bool(row["is_admin"]),
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def revoke_session(db: sqlite3.Connection, token: str) -> bool:
    """Revoke an active session token."""
    cursor = db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    db.commit()
    return cursor.rowcount > 0


def revoke_all_user_sessions(db: sqlite3.Connection, user_id: int) -> int:
    """Revoke all active sessions for a given user."""
    cursor = db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.commit()
    return cursor.rowcount


def get_user_by_username(
    db: sqlite3.Connection,
    username: str,
) -> Optional[Dict[str, Any]]:
    """Fetch user record by username (case-insensitive)."""
    cursor = db.execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
        (username,),
    )
    row = cursor.fetchone()
    if not row:
        return None
    return dict(row)


def get_user_by_id(
    db: sqlite3.Connection,
    user_id: int,
) -> Optional[Dict[str, Any]]:
    """Fetch user record by integer ID."""
    cursor = db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return dict(row)


def create_user(
    db: sqlite3.Connection,
    username: str,
    password: str,
    full_name: str,
    initials: Optional[str] = None,
    email: Optional[str] = None,
    is_admin: bool = False,
    is_active: bool = True,
) -> UserResponse:
    """Create a new user account with PBKDF2 password hashing."""
    if not initials or not initials.strip():
        derived_initials = compute_initials(full_name=full_name, username=username)
    else:
        derived_initials = initials.strip().upper()

    pw_hash = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    try:
        cursor = db.execute(
            """
            INSERT INTO users (
                username, password_hash, initials, full_name, email,
                is_admin, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                pw_hash,
                derived_initials,
                full_name,
                email,
                1 if is_admin else 0,
                1 if is_active else 0,
                now,
                now,
            ),
        )
        user_id = cursor.lastrowid
        db.commit()
    except sqlite3.IntegrityError as e:
        db.rollback()
        raise UserAlreadyExistsError(f"UNIQUE constraint failed: users.username - User '{username}' already exists") from e

    return UserResponse(
        id=user_id,
        username=username,
        initials=derived_initials,
        full_name=full_name,
        email=email,
        is_admin=is_admin,
        is_active=is_active,
        created_at=now,
        updated_at=now,
    )


def authenticate_user(
    db: sqlite3.Connection,
    username: str,
    password: str,
) -> Optional[Dict[str, Any]]:
    """Authenticate username and password, returning public user profile on success."""
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not bool(user.get("is_active", 1)):
        return None
    if not verify_password(password, user["password_hash"]):
        return None

    return {
        "id": user["id"],
        "username": user["username"],
        "initials": user["initials"],
        "full_name": user["full_name"],
        "email": user.get("email"),
        "is_admin": bool(user["is_admin"]),
        "is_active": bool(user["is_active"]),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


def list_users(
    db: sqlite3.Connection,
    limit: int = 100,
    offset: int = 0,
) -> List[UserResponse]:
    """Retrieve list of provisioned users ordered by ID."""
    cursor = db.execute(
        """
        SELECT id, username, initials, full_name, email, is_admin, is_active, created_at, updated_at
        FROM users
        ORDER BY id ASC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    )
    rows = cursor.fetchall()
    return [
        UserResponse(
            id=row["id"],
            username=row["username"],
            initials=row["initials"],
            full_name=row["full_name"],
            email=row["email"],
            is_admin=bool(row["is_admin"]),
            is_active=bool(row["is_active"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]
