"""Общие фикстуры.

Интеграционные тесты ходят в настоящий PostgreSQL: задайте TEST_DATABASE_URL
(например postgresql://postgres:postgres@localhost:5432/kinematics_test). Без неё они пропускаются.
Внимание: схема public в этой базе очищается.
"""

from __future__ import annotations

import asyncio
import os
import struct
import zlib
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin-password-123"
PASSWORD = "password-123"


async def _reset_schema(dsn: str) -> None:
    """Чистая схема + миграции один раз на сессию. Сид-данные миграций потом удаляет _truncate."""
    import asyncpg

    from app.db import apply_migrations

    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
    finally:
        await conn.close()
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=1)
    try:
        await apply_migrations(pool)
    finally:
        await pool.close()


async def _truncate(dsn: str) -> None:
    import asyncpg

    conn = await asyncpg.connect(dsn)
    try:
        exists = await conn.fetchval("SELECT to_regclass('public.users') IS NOT NULL")
        if exists:
            await conn.execute(
                "TRUNCATE attempts, tasks, themes, subjects, refresh_tokens, users RESTART IDENTITY CASCADE"
            )
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def database_url() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL не задан — интеграционные тесты пропущены")
    asyncio.run(_reset_schema(TEST_DATABASE_URL))
    return TEST_DATABASE_URL


@pytest.fixture
def upload_dir(tmp_path: Path) -> Path:
    return tmp_path / "uploads"


@pytest.fixture
def client(database_url: str, upload_dir: Path) -> Iterator[ApiClient]:
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app

    asyncio.run(_truncate(database_url))
    settings = Settings(
        database_url=database_url,
        secret_key="test-secret-key-that-is-long-enough-123",
        upload_dir=upload_dir,
        admin_username=ADMIN_USERNAME,
        admin_password=ADMIN_PASSWORD,
        cors_origins=["http://testserver"],
    )
    with TestClient(create_app(settings)) as test_client:
        yield ApiClient(test_client)


@dataclass
class ApiClient:
    """Обёртка над TestClient с удобными хелперами для логина под разными ролями."""

    http: object

    def request(self, method: str, url: str, token: str | None = None, **kwargs: object):  # noqa: ANN201
        headers = dict(kwargs.pop("headers", {}) or {})  # type: ignore[arg-type]
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return self.http.request(method, url, headers=headers, **kwargs)  # type: ignore[attr-defined]

    def get(self, url: str, token: str | None = None, **kwargs: object):  # noqa: ANN201
        return self.request("GET", url, token, **kwargs)

    def post(self, url: str, token: str | None = None, **kwargs: object):  # noqa: ANN201
        return self.request("POST", url, token, **kwargs)

    def put(self, url: str, token: str | None = None, **kwargs: object):  # noqa: ANN201
        return self.request("PUT", url, token, **kwargs)

    def patch(self, url: str, token: str | None = None, **kwargs: object):  # noqa: ANN201
        return self.request("PATCH", url, token, **kwargs)

    def delete(self, url: str, token: str | None = None, **kwargs: object):  # noqa: ANN201
        return self.request("DELETE", url, token, **kwargs)

    # ---- хелперы ----

    def sql(self, query: str, *args: object) -> None:
        """Прямой SQL в тестовую базу — например, чтобы «перемотать время» олимпиады."""

        async def run() -> None:
            import asyncpg

            conn = await asyncpg.connect(TEST_DATABASE_URL)
            try:
                await conn.execute(query, *args)
            finally:
                await conn.close()

        asyncio.run(run())

    def login(self, username: str, password: str = PASSWORD) -> dict:
        response = self.post("/api/auth/login", json={"username": username, "password": password})
        assert response.status_code == 200, response.text
        return response.json()

    def admin_token(self) -> str:
        return self.login(ADMIN_USERNAME, ADMIN_PASSWORD)["access_token"]

    def register(self, username: str, first_name: str = "Тест") -> dict:
        response = self.post(
            "/api/auth/register",
            json={"username": username, "password": PASSWORD, "first_name": first_name},
        )
        assert response.status_code == 201, response.text
        return response.json()

    def student(self, username: str = "student") -> str:
        self.register(username)
        return self.login(username)["access_token"]

    def teacher(self, username: str = "teacher") -> str:
        user = self.register(username)
        response = self.patch(f"/api/admin/users/{user['id']}/role", self.admin_token(), json={"role": "teacher"})
        assert response.status_code == 200, response.text
        return self.login(username)["access_token"]

    def theme(self) -> dict:
        admin = self.admin_token()
        subject = self.post("/api/admin/subjects", admin, json={"title": "Физика"}).json()
        response = self.post("/api/admin/themes", admin, json={"subject_id": subject["id"], "title": "Кинематика"})
        assert response.status_code == 201, response.text
        return response.json()

    def task(self, token: str, theme_id: int, **overrides: object) -> dict:
        # Одинаковые задачи запрещены — у каждой тестовой задачи своё условие (если тест не задал его сам).
        self._task_counter = getattr(self, "_task_counter", 0) + 1
        payload = {
            "theme_id": theme_id,
            "title": "Поезд",
            "condition": f"Поезд №{self._task_counter} едет со скоростью $v = 72$ км/ч. Найдите скорость в м/с.",
            "answer": "20",
            "unit": "м/с",
            **overrides,
        }
        response = self.post("/api/tasks", token, json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    def attempt(self, token: str, task_id: int, answer: str, files: dict | None = None):  # noqa: ANN201
        return self.post("/api/attempts", token, data={"task_id": str(task_id), "answer": answer}, files=files)


def tiny_png(color: tuple[int, int, int] = (255, 0, 0)) -> bytes:
    """Валидный PNG 1×1 без сторонних библиотек; разный цвет — разный файл (для проверки на списывание)."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    pixels = zlib.compress(b"\x00" + bytes(color))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")
