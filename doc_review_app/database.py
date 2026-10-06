"""Database connection and schema management module for SQLite with WAL mode.

Provides transactional context managers, connection factories, pragma enforcement
(foreign keys, busy timeout, WAL mode), DDL execution, and FastAPI dependencies.
"""

from contextlib import contextmanager
import os
from pathlib import Path
import sqlite3
from typing import Generator, Optional, Union

from doc_review_app.config import settings

SCHEMA_DDL = """
-- Users table: reviewer and administrator accounts
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    initials TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Sessions table: active authentication tokens with expiration
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Documents table: ingested markdown and text documents
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('markdown', 'text')),
    content_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Annotations table: highlighted text selections and badges
CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_offset INTEGER NOT NULL CHECK(start_offset >= 0),
    end_offset INTEGER NOT NULL CHECK(end_offset > start_offset),
    selected_text TEXT NOT NULL,
    badge_color TEXT NOT NULL DEFAULT '#FF6D00',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'deleted')),
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    deleted_at TEXT,
    ast_path TEXT,
    node_type TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Comments table: threaded discussion comments linked to annotations
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_initials TEXT NOT NULL,
    content TEXT NOT NULL,
    is_edited INTEGER NOT NULL DEFAULT 0 CHECK(is_edited IN (0, 1)),
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Audit Logs table: comprehensive change history and audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('comment', 'annotation', 'document')),
    entity_id INTEGER NOT NULL,
    document_id INTEGER,
    action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE')),
    user_id INTEGER NOT NULL REFERENCES users(id),
    user_initials TEXT,
    old_value TEXT,
    new_value TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
);

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_offsets ON annotations(document_id, start_offset, end_offset);
CREATE INDEX IF NOT EXISTS idx_annotations_is_deleted ON annotations(is_deleted);
CREATE INDEX IF NOT EXISTS idx_comments_annotation_id ON comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_is_deleted ON comments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_doc ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
"""


def _resolve_db_path(db_path: Optional[Union[Path, str]] = None) -> str:
    """Resolve database path string from parameter or global settings."""
    if db_path is not None:
        return str(db_path)
    env_path = os.environ.get("DOC_REVIEW_DB_PATH")
    if env_path:
        return str(env_path)
    return str(settings.db_path)


def get_connection(db_path: Optional[Union[Path, str]] = None) -> sqlite3.Connection:
    """Create and configure a new SQLite connection with required pragmas."""
    target_path = _resolve_db_path(db_path)
    is_memory = target_path == ":memory:"

    if not is_memory:
        p = Path(target_path)
        p.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(
        target_path,
        check_same_thread=False,
        timeout=15.0,
    )
    conn.row_factory = sqlite3.Row

    # Enforce foreign key constraints and busy timeout on all connections
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 10000;")

    # Apply Write-Ahead Logging (WAL) and normal synchronous mode for file-backed databases
    if not is_memory:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA wal_autocheckpoint = 100;")

    return conn


@contextmanager
def get_db(db_path: Optional[Union[Path, str]] = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager providing a transactional SQLite connection."""
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db_session() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency yielding a transactional SQLite database connection."""
    with get_db() as conn:
        yield conn


def _migrate_db(conn: sqlite3.Connection) -> None:
    """Idempotently ensure required columns and tables exist in live databases."""
    try:
        # Check comments table
        comment_cols = [r[1] for r in conn.execute("PRAGMA table_info(comments)").fetchall()]
        if comment_cols and "is_deleted" not in comment_cols:
            conn.execute("ALTER TABLE comments ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
        if comment_cols and "deleted_at" not in comment_cols:
            conn.execute("ALTER TABLE comments ADD COLUMN deleted_at TEXT")

        # Check annotations table
        ann_cols = [r[1] for r in conn.execute("PRAGMA table_info(annotations)").fetchall()]
        if ann_cols and "is_deleted" not in ann_cols:
            conn.execute("ALTER TABLE annotations ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
        if ann_cols and "deleted_at" not in ann_cols:
            conn.execute("ALTER TABLE annotations ADD COLUMN deleted_at TEXT")
        if ann_cols and "ast_path" not in ann_cols:
            conn.execute("ALTER TABLE annotations ADD COLUMN ast_path TEXT")
        if ann_cols and "node_type" not in ann_cols:
            conn.execute("ALTER TABLE annotations ADD COLUMN node_type TEXT")
    except Exception:
        pass


def init_db(db_path: Optional[Union[Path, str]] = None) -> None:
    """Initialize database tables, constraints, and indexes using SCHEMA_DDL."""
    with get_db(db_path) as conn:
        _migrate_db(conn)
        conn.executescript(SCHEMA_DDL)


def reset_db(db_path: Optional[Union[Path, str]] = None) -> None:
    """Drop existing application tables and re-execute DDL for fresh state."""
    drop_script = """
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS annotations;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    """
    with get_db(db_path) as conn:
        conn.execute("PRAGMA busy_timeout = 10000;")
        conn.execute("PRAGMA foreign_keys = OFF;")
        conn.executescript(drop_script)
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.executescript(SCHEMA_DDL)
        _migrate_db(conn)
        try:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        except Exception:
            pass
