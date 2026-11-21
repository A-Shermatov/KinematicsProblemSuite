from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.modules.users.schemas import USERNAME_PATTERN, LocationFields, UserOut


class RegisterIn(LocationFields):
    username: str = Field(pattern=USERNAME_PATTERN)
    # Требования (длина из настроек, буква, цифра) проверяет роутер — они настраиваются.
    password: str = Field(min_length=1, max_length=72)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(default="", max_length=50)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class LoginIn(BaseModel):
    username: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
