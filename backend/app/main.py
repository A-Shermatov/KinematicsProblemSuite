"""Точка входа: одно FastAPI-приложение (модульный монолит)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db import apply_migrations, create_pool
from app.modules.admin.router import router as admin_router
from app.modules.auth import queries as auth_q
from app.modules.auth.router import router as auth_router
from app.modules.content.router import router as content_router
from app.modules.imports.router import router as imports_router
from app.modules.olympiads.router import router as olympiads_router
from app.modules.settings.router import router as settings_router
from app.modules.solutions.router import router as solutions_router
from app.modules.stats.router import router as stats_router
from app.modules.teachers.router import router as teachers_router
from app.modules.users import queries as user_q
from app.modules.users.router import router as users_router
from app.security import hash_password
from app.storage import UPLOAD_URL_PREFIX

logger = logging.getLogger("app")


async def ensure_admin(pool: asyncpg.Pool, settings: Settings) -> None:
    """Создаёт первого администратора из ADMIN_USERNAME / ADMIN_PASSWORD, если админов ещё нет."""
    if not settings.admin_username or not settings.admin_password:
        return
    async with pool.acquire() as conn:
        if await conn.fetchval(user_q.ADMIN_EXISTS):
            return
        await conn.execute(
            user_q.INSERT,
            settings.admin_username,
            "Администратор",
            "",
            hash_password(settings.admin_password),
            "admin",
            None,
            None,
        )
        logger.info("Created admin user %s", settings.admin_username)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        pool = await create_pool(settings.database_url, settings.db_pool_min, settings.db_pool_max)
        app.state.pool = pool
        try:
            if settings.run_migrations:
                await apply_migrations(pool)
            await ensure_admin(pool, settings)
            async with pool.acquire() as conn:
                await conn.execute(auth_q.DELETE_EXPIRED)
            yield
        finally:
            await pool.close()

    app = FastAPI(title="Donish API", version="2.1.0", lifespan=lifespan)
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    api = APIRouter(prefix="/api")
    for router in (
        auth_router,
        users_router,
        imports_router,
        content_router,
        solutions_router,
        stats_router,
        teachers_router,
        olympiads_router,
        settings_router,
        admin_router,
    ):
        api.include_router(router)

    @api.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        async with app.state.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok"}

    app.include_router(api)
    app.mount(UPLOAD_URL_PREFIX, StaticFiles(directory=settings.upload_dir), name="uploads")
    return app


def app_factory() -> FastAPI:
    """Для uvicorn: `uvicorn app.main:app_factory --factory`."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    return create_app()
