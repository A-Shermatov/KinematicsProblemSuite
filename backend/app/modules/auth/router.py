"""Регистрация, вход, обновление и отзыв токенов.

Исправлено по сравнению со старым auth_service:
- роль при регистрации всегда «student» — учителя назначает администратор;
- refresh принимает только refresh-токен (тип проверяется), старый токен сразу гасится (rotation);
- в базе хранится только jti refresh-токена, а не сами токены и не SECRET_KEY.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import asyncpg
from fastapi import APIRouter, HTTPException, status

from app.config import Settings
from app.deps import Conn, SettingsDep
from app.modules.auth import queries as q
from app.modules.auth.schemas import LoginIn, RefreshIn, RegisterIn, TokenPair
from app.modules.users import queries as user_q
from app.modules.users.schemas import UserOut
from app.security import TokenError, create_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Хэш для сравнения, когда пользователя нет — чтобы время ответа не выдавало существование логина.
_DUMMY_HASH = hash_password("timing-attack-protection")


async def _issue_tokens(conn: asyncpg.Connection, settings: Settings, user_row: asyncpg.Record) -> TokenPair:
    access, _ = create_token(
        user_id=user_row["id"],
        token_type="access",
        secret=settings.secret_key,
        algorithm=settings.jwt_algorithm,
        lifetime=timedelta(minutes=settings.access_token_minutes),
    )
    refresh, payload = create_token(
        user_id=user_row["id"],
        token_type="refresh",
        secret=settings.secret_key,
        algorithm=settings.jwt_algorithm,
        lifetime=timedelta(days=settings.refresh_token_days),
    )
    await conn.execute(q.INSERT_REFRESH, user_row["id"], uuid.UUID(payload.jti), payload.expires_at)
    return TokenPair(access_token=access, refresh_token=refresh, user=UserOut.from_row(user_row))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterIn, conn: Conn) -> UserOut:
    if await conn.fetchval(user_q.USERNAME_TAKEN, data.username, None):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Имя пользователя уже занято")
    try:
        row = await conn.fetchrow(
            user_q.INSERT,
            data.username,
            data.first_name,
            data.last_name,
            hash_password(data.password),
            "student",
            data.city,
            data.school,
        )
    except asyncpg.UniqueViolationError as exc:  # гонка двух одинаковых регистраций
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Имя пользователя уже занято") from exc
    return UserOut.from_row(row)


@router.post("/login", response_model=TokenPair)
async def login(data: LoginIn, conn: Conn, settings: SettingsDep) -> TokenPair:
    row = await conn.fetchrow(user_q.GET_AUTH_BY_USERNAME, data.username)
    password_ok = verify_password(data.password, row["password_hash"] if row else _DUMMY_HASH)
    if row is None or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверное имя пользователя или пароль")
    if not row["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован")
    return await _issue_tokens(conn, settings, row)


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshIn, conn: Conn, settings: SettingsDep) -> TokenPair:
    try:
        payload = decode_token(
            data.refresh_token, secret=settings.secret_key, algorithm=settings.jwt_algorithm, expected_type="refresh"
        )
    except TokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    async with conn.transaction():
        if await conn.fetchval(q.REVOKE_IF_VALID, uuid.UUID(payload.jti), payload.user_id) is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Сессия завершена, войдите снова")
        row = await conn.fetchrow(user_q.GET_ACTIVE_BY_ID, payload.user_id)
        if row is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден или заблокирован")
        return await _issue_tokens(conn, settings, row)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshIn, conn: Conn, settings: SettingsDep) -> None:
    try:
        payload = decode_token(
            data.refresh_token, secret=settings.secret_key, algorithm=settings.jwt_algorithm, expected_type="refresh"
        )
    except TokenError:
        return  # токен и так недействителен
    await conn.execute(q.REVOKE, uuid.UUID(payload.jti))
