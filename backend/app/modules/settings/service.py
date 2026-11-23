"""Системные настройки платформы. Хранятся в таблице app_settings (ключ → JSON)."""

from __future__ import annotations

import json
from typing import Any

import asyncpg
from pydantic import BaseModel, Field, field_validator

DIFFICULTY_STEP = 100

GET_ALL = "SELECT key, value::text AS value FROM app_settings"
UPSERT = """
INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
"""


class PlatformSettings(BaseModel):
    """Все настройки с значениями по умолчанию — если ключа нет в базе, берётся значение отсюда."""

    difficulty_max: int = Field(default=1000, ge=DIFFICULTY_STEP, le=10_000)
    # Минимальная длина пароля при регистрации и смене пароля.
    password_min_length: int = Field(default=8, ge=6, le=32)
    # Показывать поле «Страна» в регистрации; иначе страна — Таджикистан.
    show_country_field: bool = False

    @field_validator("difficulty_max")
    @classmethod
    def multiple_of_step(cls, value: int) -> int:
        if value % DIFFICULTY_STEP:
            raise ValueError(f"Верхний уровень должен быть кратен {DIFFICULTY_STEP}")
        return value


async def load(conn: asyncpg.Connection) -> PlatformSettings:
    raw: dict[str, Any] = {row["key"]: json.loads(row["value"]) for row in await conn.fetch(GET_ALL)}
    known = {k: v for k, v in raw.items() if k in PlatformSettings.model_fields}
    return PlatformSettings(**known)


async def save(conn: asyncpg.Connection, settings: PlatformSettings, user_id: int) -> None:
    async with conn.transaction():
        for key, value in settings.model_dump().items():
            await conn.execute(UPSERT, key, json.dumps(value), user_id)


def difficulty_levels(settings: PlatformSettings) -> list[int]:
    return list(range(DIFFICULTY_STEP, settings.difficulty_max + 1, DIFFICULTY_STEP))
