"""Настройки приложения из переменных окружения."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173"])
    upload_dir: Path = Path("uploads")
    max_upload_bytes: int = 5 * 1024 * 1024
    db_pool_min: int = 1
    db_pool_max: int = 10
    admin_username: str | None = None
    admin_password: str | None = None
    run_migrations: bool = True

    @classmethod
    def from_env(cls) -> Settings:
        database_url = os.getenv("DATABASE_URL")
        secret_key = os.getenv("SECRET_KEY")
        if not database_url:
            raise RuntimeError("DATABASE_URL is not set")
        if not secret_key or len(secret_key) < 32:
            raise RuntimeError("SECRET_KEY must be set and at least 32 characters long")
        return cls(
            database_url=database_url,
            secret_key=secret_key,
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            access_token_minutes=int(os.getenv("ACCESS_TOKEN_MINUTES", "30")),
            refresh_token_days=int(os.getenv("REFRESH_TOKEN_DAYS", "14")),
            cors_origins=_env_list("CORS_ORIGINS", "http://localhost:5173"),
            upload_dir=Path(os.getenv("UPLOAD_DIR", "uploads")),
            max_upload_bytes=int(os.getenv("MAX_UPLOAD_MB", "5")) * 1024 * 1024,
            db_pool_min=int(os.getenv("DB_POOL_MIN", "1")),
            db_pool_max=int(os.getenv("DB_POOL_MAX", "10")),
            admin_username=os.getenv("ADMIN_USERNAME") or None,
            admin_password=os.getenv("ADMIN_PASSWORD") or None,
            run_migrations=_env_bool("RUN_MIGRATIONS", True),
        )
