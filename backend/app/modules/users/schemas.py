from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.storage import public_url

Role = Literal["student", "teacher", "admin"]

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]{3,50}$"


class UserOut(BaseModel):
    id: int
    username: str
    first_name: str
    last_name: str
    role: Role
    is_active: bool
    avatar_url: str | None
    created_at: datetime

    @classmethod
    def from_row(cls, row: Any) -> UserOut:
        return cls(
            id=row["id"],
            username=row["username"],
            first_name=row["first_name"],
            last_name=row["last_name"],
            role=row["role"],
            is_active=row["is_active"],
            avatar_url=public_url(row["avatar_path"]),
            created_at=row["created_at"],
        )


class ProfileUpdate(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(default="", max_length=50)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class ActiveUpdate(BaseModel):
    is_active: bool


class RoleUpdate(BaseModel):
    role: Role
