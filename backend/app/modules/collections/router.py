"""Подборки задач: тренировки из задач разных тем и авторов с прогрессом ученика."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.deps import Conn, CurrentUser, OptionalUser, Staff, not_found
from app.i18n import RequestLang
from app.modules.collections import queries as q
from app.modules.content import queries as content_q
from app.modules.content.router import _public_task
from app.modules.content.schemas import TaskOut

router = APIRouter(prefix="/collections", tags=["collections"])


class CollectionIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=2000)
    is_public: bool = True
    task_ids: list[int] = Field(default_factory=list, max_length=200)

    @field_validator("title", "description")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("task_ids")
    @classmethod
    def unique(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))  # без повторов, порядок сохраняется


class CollectionOut(BaseModel):
    id: int
    title: str
    description: str
    author_id: int
    author_name: str
    is_public: bool
    tasks_count: int
    solved_count: int
    created_at: datetime
    updated_at: datetime


class CollectionDetail(CollectionOut):
    tasks: list[TaskOut]
    can_edit: bool


async def _get(conn: asyncpg.Connection, collection_id: int, viewer: CurrentUser | None) -> asyncpg.Record:
    row = await conn.fetchrow(q.GET, viewer.id if viewer else None, collection_id)
    if row is None or not (row["is_public"] or (viewer and (viewer.id == row["author_id"] or viewer.is_admin))):
        raise not_found("Подборка")
    return row


def _can_edit(row: asyncpg.Record, user: CurrentUser | None) -> bool:
    return user is not None and (user.is_admin or row["author_id"] == user.id)


async def _save_tasks(conn: asyncpg.Connection, collection_id: int, task_ids: list[int]) -> None:
    existing = {r["id"] for r in await conn.fetch(q.EXISTING_TASKS, task_ids)}
    missing = [task_id for task_id in task_ids if task_id not in existing]
    if missing:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Задачи не найдены: {missing}")
    await conn.execute(q.CLEAR_TASKS, collection_id)
    if task_ids:
        await conn.execute(q.SET_TASKS, collection_id, task_ids)


@router.get("", response_model=list[CollectionOut])
async def list_collections(
    conn: Conn,
    viewer: OptionalUser,
    author_id: int | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    mine: bool = False,
) -> list[CollectionOut]:
    viewer_id = viewer.id if viewer else None
    rows = await conn.fetch(q.LIST, viewer_id, author_id, search or None, mine and viewer is not None)
    return [CollectionOut(**dict(row)) for row in rows]


@router.get("/{collection_id}", response_model=CollectionDetail)
async def get_collection(collection_id: int, conn: Conn, viewer: OptionalUser, lang: RequestLang) -> CollectionDetail:
    row = await _get(conn, collection_id, viewer)
    order = [r["task_id"] for r in await conn.fetch(q.TASK_IDS, collection_id)]
    rows = {r["id"]: r for r in await conn.fetch(content_q.TASKS_BY_IDS, order, viewer.id if viewer else None)}
    tasks = [_public_task(rows[task_id], lang, viewer) for task_id in order if task_id in rows]
    return CollectionDetail(**dict(row), tasks=tasks, can_edit=_can_edit(row, viewer))


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(data: CollectionIn, user: Staff, conn: Conn) -> CollectionOut:
    async with conn.transaction():
        collection_id = await conn.fetchval(q.INSERT, data.title, data.description, user.id, data.is_public)
        await _save_tasks(conn, collection_id, data.task_ids)
    return CollectionOut(**dict(await conn.fetchrow(q.GET, user.id, collection_id)))


@router.put("/{collection_id}", response_model=CollectionOut)
async def update_collection(collection_id: int, data: CollectionIn, user: Staff, conn: Conn) -> CollectionOut:
    row = await _get(conn, collection_id, user)
    if not _can_edit(row, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Изменять подборку может только её автор")
    async with conn.transaction():
        await conn.execute(q.UPDATE, collection_id, data.title, data.description, data.is_public)
        await _save_tasks(conn, collection_id, data.task_ids)
    return CollectionOut(**dict(await conn.fetchrow(q.GET, user.id, collection_id)))


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(collection_id: int, user: Staff, conn: Conn) -> None:
    row = await _get(conn, collection_id, user)
    if not _can_edit(row, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Удалять подборку может только её автор")
    await conn.execute(q.DELETE, collection_id)
