"""Пароли (bcrypt) и JWT-токены."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import bcrypt
import jwt

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


@dataclass(frozen=True)
class TokenPayload:
    user_id: int
    type: TokenType
    jti: str | None
    expires_at: datetime


class TokenError(Exception):
    pass


def create_token(
    *,
    user_id: int,
    token_type: TokenType,
    secret: str,
    algorithm: str,
    lifetime: timedelta,
    now: datetime | None = None,
) -> tuple[str, TokenPayload]:
    issued = now or datetime.now(UTC)
    expires = issued + lifetime
    jti = str(uuid.uuid4()) if token_type == "refresh" else None
    claims: dict[str, object] = {
        "sub": str(user_id),
        "type": token_type,
        "iat": int(issued.timestamp()),
        "exp": int(expires.timestamp()),
    }
    if jti:
        claims["jti"] = jti
    token = jwt.encode(claims, secret, algorithm=algorithm)
    return token, TokenPayload(user_id=user_id, type=token_type, jti=jti, expires_at=expires)


def decode_token(token: str, *, secret: str, algorithm: str, expected_type: TokenType) -> TokenPayload:
    try:
        claims = jwt.decode(token, secret, algorithms=[algorithm], options={"require": ["exp", "sub", "type"]})
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Срок действия токена истёк") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Недействительный токен") from exc

    if claims.get("type") != expected_type:
        raise TokenError("Неверный тип токена")
    try:
        user_id = int(claims["sub"])
    except (TypeError, ValueError) as exc:
        raise TokenError("Недействительный токен") from exc
    if expected_type == "refresh" and not claims.get("jti"):
        raise TokenError("Недействительный токен")

    return TokenPayload(
        user_id=user_id,
        type=expected_type,
        jti=claims.get("jti"),
        expires_at=datetime.fromtimestamp(int(claims["exp"]), tz=UTC),
    )
