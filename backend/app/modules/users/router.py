from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.deps import Admin, Conn, SettingsDep, User, not_found
from app.modules.auth import queries as auth_q
from app.modules.users import queries as q
from app.modules.users.schemas import (
    ActiveUpdate,
    PasswordChange,
    ProfileUpdate,
    Role,
    RoleUpdate,
    UserOut,
)
from app.security import hash_password, verify_password
from app.storage import delete_file, save_image

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(user: User, conn: Conn) -> UserOut:
    row = await conn.fetchrow(q.GET_BY_ID, user.id)
    return UserOut.from_row(row)


@router.patch("/me", response_model=UserOut)
async def update_me(data: ProfileUpdate, user: User, conn: Conn) -> UserOut:
    if await conn.fetchval(q.USERNAME_TAKEN, data.username, user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Имя пользователя уже занято")
    row = await conn.fetchrow(q.UPDATE_PROFILE, user.id, data.username, data.first_name, data.last_name)
    return UserOut.from_row(row)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(data: PasswordChange, user: User, conn: Conn) -> None:
    row = await conn.fetchrow(q.GET_AUTH_BY_USERNAME, user.username)
    if row is None or not verify_password(data.current_password, row["password_hash"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Текущий пароль указан неверно")
    async with conn.transaction():
        await conn.execute(q.UPDATE_PASSWORD, user.id, hash_password(data.new_password))
        # После смены пароля все остальные сессии должны перелогиниться.
        await conn.execute(auth_q.REVOKE_ALL_FOR_USER, user.id)


@router.put("/me/avatar", response_model=UserOut)
async def upload_avatar(
    user: User,
    conn: Conn,
    settings: SettingsDep,
    file: Annotated[UploadFile, File()],
) -> UserOut:
    path = await save_image(file, upload_dir=settings.upload_dir, subdir="avatars", max_bytes=settings.max_upload_bytes)
    old = await conn.fetchrow(q.GET_BY_ID, user.id)
    row = await conn.fetchrow(q.UPDATE_AVATAR, user.id, path)
    delete_file(settings.upload_dir, old["avatar_path"])
    return UserOut.from_row(row)


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(user: User, conn: Conn, settings: SettingsDep) -> UserOut:
    old = await conn.fetchrow(q.GET_BY_ID, user.id)
    row = await conn.fetchrow(q.UPDATE_AVATAR, user.id, None)
    delete_file(settings.upload_dir, old["avatar_path"])
    return UserOut.from_row(row)


@router.get("", response_model=list[UserOut])
async def list_users(
    _: Admin,
    conn: Conn,
    role: Role | None = None,
    search: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[UserOut]:
    rows = await conn.fetch(q.LIST, role, search or None, limit, offset)
    return [UserOut.from_row(row) for row in rows]


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, _: User, conn: Conn) -> UserOut:
    row = await conn.fetchrow(q.GET_BY_ID, user_id)
    if row is None:
        raise not_found("Пользователь")
    return UserOut.from_row(row)


@router.patch("/{user_id}/active", response_model=UserOut)
async def set_active(user_id: int, data: ActiveUpdate, admin: Admin, conn: Conn) -> UserOut:
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя заблокировать самого себя")
    async with conn.transaction():
        row = await conn.fetchrow(q.SET_ACTIVE, user_id, data.is_active)
        if row is None:
            raise not_found("Пользователь")
        if not data.is_active:
            await conn.execute(auth_q.REVOKE_ALL_FOR_USER, user_id)
    return UserOut.from_row(row)


@router.patch("/{user_id}/role", response_model=UserOut)
async def set_role(user_id: int, data: RoleUpdate, admin: Admin, conn: Conn) -> UserOut:
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя изменить собственную роль")
    row = await conn.fetchrow(q.SET_ROLE, user_id, data.role)
    if row is None:
        raise not_found("Пользователь")
    return UserOut.from_row(row)
