"""FastAPI application main module for Document Review Web Application.

Configures application lifespan (directory validation, DB initialization, admin seeding),
CORS middleware, API routers (/api/auth, /api/admin), health check endpoints,
and access-controlled document/annotation route stubs.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List

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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup and shutdown lifecycle events."""
    # Ensure all required runtime directories exist
    settings.ensure_directories()

    # Initialize SQLite database schema
    init_db()

    # Seed default system administrator account if no users exist
    with get_db() as db:
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

        existing_guy = user_service.get_user_by_username(db, "guy.wolters")
        if not existing_guy:
            try:
                user_service.create_user(
                    db=db,
                    username="guy.wolters",
                    password="GuyReview2026!Woning",
                    full_name="Guy Wolters",
                    initials="GW",
                    email="guy.wolters@groterinwonen.nl",
                    is_admin=False,
                )
            except user_service.UserAlreadyExistsError:
                pass

    # Auto-migrate existing annotations and comments from SQLite to JSON sidecars
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
