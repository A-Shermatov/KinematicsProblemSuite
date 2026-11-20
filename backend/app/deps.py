"""Общие зависимости FastAPI: настройки, текущий пользователь, проверка ролей."""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Annotated, Any

import asyncpg
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings
from app.db import get_conn
from app.modules.users import queries as user_q
from app.security import TokenError, decode_token

_bearer = HTTPBearer(auto_error=False)

Conn = Annotated[asyncpg.Connection, Depends(get_conn)]


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


SettingsDep = Annotated[Settings, Depends(get_settings)]


@dataclass(frozen=True)
class CurrentUser:
    id: int
    username: str
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_teacher(self) -> bool:
        return self.role == "teacher"

    @property
    def is_student(self) -> bool:
        return self.role == "student"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


async def get_optional_user(
    conn: Conn,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser | None:
    if credentials is None:
        return None
    try:
        payload = decode_token(
            credentials.credentials,
            secret=settings.secret_key,
            algorithm=settings.jwt_algorithm,
            expected_type="access",
        )
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc
    row = await conn.fetchrow(user_q.GET_ACTIVE_BY_ID, payload.user_id)
    if row is None:
        raise _unauthorized("Пользователь не найден или заблокирован")
    return CurrentUser(id=row["id"], username=row["username"], role=row["role"])


async def get_current_user(user: Annotated[CurrentUser | None, Depends(get_optional_user)]) -> CurrentUser:
    if user is None:
        raise _unauthorized("Требуется авторизация")
    return user


OptionalUser = Annotated[CurrentUser | None, Depends(get_optional_user)]
User = Annotated[CurrentUser, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[..., Coroutine[Any, Any, CurrentUser]]:
    async def dependency(user: User) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        return user

    return dependency


Admin = Annotated[CurrentUser, Depends(require_roles("admin"))]
Staff = Annotated[CurrentUser, Depends(require_roles("teacher", "admin"))]


def not_found(what: str = "Объект") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{what} не найден")
