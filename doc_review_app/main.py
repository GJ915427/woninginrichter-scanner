"""FastAPI application main module for Document Review Web Application.

Configures application lifespan (directory validation, DB initialization, admin seeding),
CORS middleware, API routers (/api/auth, /api/admin), health check endpoints,
and access-controlled document/annotation route stubs.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Any, AsyncGenerator, Dict, List, Set

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from doc_review_app.auth import get_current_user
from doc_review_app.config import settings
from doc_review_app.database import get_db, init_db
from doc_review_app.models import User
from doc_review_app.routers import (
    admin_router,
    auth_router,
    comment_router,
    document_router,
)
from doc_review_app.services import user_service


def _seed_default_users(db: sqlite3.Connection) -> None:
    """Seed system administrator and pre-configured reviewers from Groter In Wonen."""
    existing_admin = user_service.get_user_by_username(db, settings.admin_username)
    if not existing_admin:
        try:
            user_service.create_user(
                db=db,
                username=settings.admin_username,
                password=settings.admin_password,
                full_name=settings.admin_full_name,
                initials=settings.admin_initials,
                email=settings.admin_email,
                is_admin=True,
            )
        except user_service.UserAlreadyExistsError:
            pass
    else:
        # Keep admin password synced to settings.admin_password
        from doc_review_app.auth import hash_password
        new_hash = hash_password(settings.admin_password)
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (new_hash, existing_admin["id"]),
        )
        db.commit()

    seed_reviewers = [
        {
            "username": "guy.wolters",
            "password": "GuyReview2026!Woning",
            "full_name": "Guy Wolters",
            "initials": "GW",
            "email": "guy.wolters@groterinwonen.nl",
        },
        {
            "username": "stefan.houten",
            "password": "ParketEnVloeren#26",
            "full_name": "Stefan Houten",
            "initials": "SH",
            "email": "stefan.houten@groterinwonen.nl",
        },
        {
            "username": "maria.houten",
            "password": "GordijnCreaties*48",
            "full_name": "Maria Houten",
            "initials": "MH",
            "email": "maria.houten@groterinwonen.nl",
        },
        {
            "username": "simon.bak",
            "password": "StrakkeMaatvoering@39",
            "full_name": "Simon Bak",
            "initials": "SB",
            "email": "simon.bak@groterinwonen.nl",
        },
        {
            "username": "carlo.heinemans",
            "password": "MooiInrichten$57",
            "full_name": "Carlo Heinemans",
            "initials": "CH",
            "email": "carlo.heinemans@groterinwonen.nl",
        },
        {
            "username": "kelly.schreurs",
            "password": "KleurAdvies&82",
            "full_name": "Kelly Schreurs",
            "initials": "KS",
            "email": "kelly.schreurs@groterinwonen.nl",
        },
    ]
    for reviewer in seed_reviewers:
        existing_rev = user_service.get_user_by_username(db, reviewer["username"])
        if not existing_rev:
            try:
                user_service.create_user(
                    db=db,
                    username=reviewer["username"],
                    password=reviewer["password"],
                    full_name=reviewer["full_name"],
                    initials=reviewer["initials"],
                    email=reviewer["email"],
                    is_admin=False,
                )
            except user_service.UserAlreadyExistsError:
                pass
        else:
            from doc_review_app.auth import hash_password
            new_hash = hash_password(reviewer["password"])
            db.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (new_hash, existing_rev["id"]),
            )
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup and shutdown lifecycle events."""
    import logging
    logger = logging.getLogger(__name__)

    # 1. Ensure all required runtime directories exist
    settings.ensure_directories()

    # 2. Pull documents & tombstones from Supabase cloud store (Anti-Zombie Git Purge)
    tombstone_filenames: Set[str] = set()
    tombstone_stems: Set[str] = set()
    try:
        from doc_review_app.storage import cloud_sync
        _, tombstone_filenames, tombstone_stems = cloud_sync.pull_documents_from_cloud(settings.documents_dir)
    except Exception as e:
        logger.warning("Cloud document pull on startup encountered warning: %s", e)

    # 3. Pull persistent sidecars from cloud storage (respecting tombstones)
    try:
        from doc_review_app.storage import cloud_sync
        cloud_sync.pull_sidecars_from_cloud(
            settings.documents_dir,
            tombstone_filenames=tombstone_filenames,
            tombstone_stems=tombstone_stems,
        )
    except Exception as e:
        logger.warning("Cloud sidecar pull on startup encountered warning: %s", e)

    # 4. Initialize SQLite database schema
    init_db()

    # 5. Seed default system administrator and pre-configured reviewers
    with get_db() as db:
        _seed_default_users(db)

    # 6. Auto-sync local documents folder with SQLite on startup (sync_cloud=False to prevent overwriting cloud)
    from doc_review_app.services.document_service import sync_local_directory_with_db
    with get_db() as db:
        sync_local_directory_with_db(db=db, sync_cloud=False)

    # 6b. Bootstrap initial document access for Kelly Schreurs if not already completed
    with get_db() as db:
        cur = db.execute("SELECT value FROM app_settings WHERE key = 'document_access_bootstrap_completed'")
        if not cur.fetchone():
            kelly = user_service.get_user_by_username(db, "kelly.schreurs")
            if kelly:
                doc = db.execute("SELECT id FROM documents ORDER BY id ASC LIMIT 1").fetchone()
                if doc:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    db.execute(
                        "INSERT OR IGNORE INTO document_access (document_id, user_id, granted_at) VALUES (?, ?, ?)",
                        (doc["id"], kelly["id"], now_iso),
                    )
            now_iso = datetime.now(timezone.utc).isoformat()
            db.execute(
                "INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES ('document_access_bootstrap_completed', 'true', ?, ?)",
                (now_iso, now_iso),
            )
            db.commit()

    # 7. Auto-migrate existing annotations and comments between SQLite and JSON sidecars
    from doc_review_app.storage.migration import auto_migrate_if_needed
    auto_migrate_if_needed()

    yield

    # Clean up and checkpoint WAL state on shutdown
    try:
        with get_db() as db:
            db.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    except Exception:
        pass


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Document Review Web Application with Material Design 3 and SQLite WAL mode.",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_anti_cache_headers(request: Request, call_next):
    """Enforce aggressive anti-cache headers for static files and frontend entry points."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static") or path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Include Authentication, Administration, Annotation/Comment, & Document Routers
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(comment_router.router, prefix="/api")
app.include_router(document_router.router)


# Health Check Endpoints
@app.get("/health", tags=["system"], summary="Health check")
@app.get("/api/health", tags=["system"], summary="API health check")
def health_check() -> Dict[str, Any]:
    """Return health status and application metadata."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "env": settings.env,
    }


# Static files and Single Page Application frontend
static_path = str(settings.static_dir) if settings.static_dir.exists() else "doc_review_app/static"
app.mount("/static", StaticFiles(directory=static_path), name="static")


@app.get("/", response_class=FileResponse, tags=["frontend"], summary="Single Page Application")
async def read_index() -> FileResponse:
    """Return the frontend Single Page Application index.html."""
    index_file = settings.static_dir / "index.html"
    if not index_file.exists():
        index_file = Path("doc_review_app/static/index.html")
    return FileResponse(
        str(index_file),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
