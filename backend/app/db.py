"""Работа с PostgreSQL через asyncpg: пул соединений и миграции. Без ORM — только SQL."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
from fastapi import Request

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
# Произвольный ключ advisory-lock, чтобы два экземпляра приложения не накатывали миграции одновременно.
_MIGRATION_LOCK_KEY = 7_315_002_211


async def create_pool(dsn: str, min_size: int = 1, max_size: int = 10) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn=dsn, min_size=min_size, max_size=max_size)


def _read_migrations(migrations_dir: Path) -> list[tuple[str, str]]:
    return [(path.name, path.read_text(encoding="utf-8")) for path in sorted(migrations_dir.glob("*.sql"))]


async def apply_migrations(pool: asyncpg.Pool, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Применяет новые *.sql файлы по порядку имени. Каждый файл — в своей транзакции."""
    applied: list[str] = []
    migrations = _read_migrations(migrations_dir)
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_advisory_lock($1)", _MIGRATION_LOCK_KEY)
        try:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    name       TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            done = {row["name"] for row in await conn.fetch("SELECT name FROM schema_migrations")}
            for name, sql in migrations:
                if name in done:
                    continue
                async with conn.transaction():
                    await conn.execute(sql)
                    await conn.execute("INSERT INTO schema_migrations (name) VALUES ($1)", name)
                logger.info("Applied migration %s", name)
                applied.append(name)
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", _MIGRATION_LOCK_KEY)
    return applied


async def get_conn(request: Request) -> AsyncIterator[asyncpg.Connection]:
    """FastAPI-зависимость: соединение из пула на время запроса."""
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        yield conn
