"""Application configuration module for Document Review Web Application.

Provides strongly typed settings using pydantic-settings, resolving project
paths, database URLs, session secrets, and default server configurations.
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings loaded from environment variables and defaults."""

    model_config = SettingsConfigDict(
        env_prefix="DOC_REVIEW_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application Information
    app_name: str = "Document Review Web Application"
    app_version: str = "0.1.0"
    env: str = "development"
    debug: bool = False

    # Directory Paths
    base_dir: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent
    )
    project_root: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent.parent
    )
    data_dir: Optional[Path] = None
    db_path: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent / "doc_review.db"
    )
    static_dir: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent / "static"
    )
    documents_dir: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent / "local_documents"
    )

    # Security & Session Authentication
    session_secret: str = "doc-review-session-secret-change-in-production-random-token-32"
    session_expiry_days: int = 7
    session_cookie_name: str = "session_token"

    # Server Bind Configuration
    host: str = "127.0.0.1"
    port: int = 8095

    # Default Initial Admin Credentials
    admin_username: str = "admin"
    admin_password: str = "AdminSecurePassword123!"
    admin_initials: str = "SA"
    admin_full_name: str = "System Administrator"
    admin_email: str = "admin@example.com"

    def ensure_directories(self) -> None:
        """Create necessary runtime directories if they do not exist."""
        if str(self.db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.static_dir.mkdir(parents=True, exist_ok=True)
        self.documents_dir.mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of application settings."""
    s = Settings()
    s.ensure_directories()
    return s


settings = get_settings()
