"""Привязка Telegram к аккаунту и настройки уведомлений."""

from __future__ import annotations

import os
import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.deps import Conn, User

router = APIRouter(prefix="/telegram", tags=["telegram"])

STATUS = "SELECT username, daily_task, notify, linked_at FROM telegram_links WHERE user_id = $1"
NEW_CODE = """
WITH cleanup AS (DELETE FROM telegram_link_codes WHERE user_id = $1 OR expires_at < now())
INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES ($2, $1, now() + interval '15 minutes')
"""
UPDATE_SETTINGS = "UPDATE telegram_links SET daily_task = $2, notify = $3 WHERE user_id = $1 RETURNING user_id"
UNLINK = "DELETE FROM telegram_links WHERE user_id = $1"


def bot_username() -> str:
    return os.getenv("TELEGRAM_BOT_USERNAME", "").lstrip("@")


class TelegramStatus(BaseModel):
    enabled: bool
    bot_username: str
    linked: bool
    username: str = ""
    daily_task: bool = True
    notify: bool = True


class TelegramSettingsIn(BaseModel):
    daily_task: bool
    notify: bool


class LinkOut(BaseModel):
    code: str
    url: str


async def _status(conn: Conn, user_id: int) -> TelegramStatus:
    row = await conn.fetchrow(STATUS, user_id)
    enabled = bool(os.getenv("TELEGRAM_BOT_TOKEN")) and bool(bot_username())
    if row is None:
        return TelegramStatus(enabled=enabled, bot_username=bot_username(), linked=False)
    return TelegramStatus(
        enabled=enabled,
        bot_username=bot_username(),
        linked=True,
        username=row["username"],
        daily_task=row["daily_task"],
        notify=row["notify"],
    )


@router.get("", response_model=TelegramStatus)
async def telegram_status(user: User, conn: Conn) -> TelegramStatus:
    return await _status(conn, user.id)


@router.post("/link", response_model=LinkOut)
async def create_link(user: User, conn: Conn) -> LinkOut:
    """Одноразовая ссылка на бота: открыть в Telegram и нажать «Start» — аккаунт привяжется."""
    if not bot_username():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Telegram-бот не настроен администратором")
    code = secrets.token_urlsafe(12)
    await conn.execute(NEW_CODE, user.id, code)
    return LinkOut(code=code, url=f"https://t.me/{bot_username()}?start={code}")


@router.put("", response_model=TelegramStatus)
async def update_settings(data: TelegramSettingsIn, user: User, conn: Conn) -> TelegramStatus:
    if await conn.fetchval(UPDATE_SETTINGS, user.id, data.daily_task, data.notify) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Telegram не привязан")
    return await _status(conn, user.id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def unlink(user: User, conn: Conn) -> None:
    await conn.execute(UNLINK, user.id)
