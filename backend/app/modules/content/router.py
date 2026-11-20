from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status

from app.deps import Admin, Conn, CurrentUser, OptionalUser, Staff, not_found
from app.modules.content import queries as q
from app.modules.content.schemas import (
    SourceType,
    SubjectIn,
    SubjectOut,
    TaskFull,
    TaskIn,
    TaskOut,
    ThemeIn,
    ThemeOut,
)

router = APIRouter(tags=["content"])


# ---------- Предметы ----------


@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(conn: Conn) -> list[SubjectOut]:
    return [SubjectOut(**dict(row)) for row in await conn.fetch(q.LIST_SUBJECTS)]


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
async def get_subject(subject_id: int, conn: Conn) -> SubjectOut:
    row = await conn.fetchrow(q.GET_SUBJECT, subject_id)
    if row is None:
        raise not_found("Предмет")
    return SubjectOut(**dict(row))


@router.post("/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(data: SubjectIn, _: Admin, conn: Conn) -> SubjectOut:
    if await conn.fetchval(q.SUBJECT_TITLE_TAKEN, data.title, None):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Предмет с таким названием уже есть")
    row = await conn.fetchrow(q.INSERT_SUBJECT, data.title, data.description, data.position)
    return SubjectOut(**dict(row))


@router.put("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(subject_id: int, data: SubjectIn, _: Admin, conn: Conn) -> SubjectOut:
    if await conn.fetchval(q.SUBJECT_TITLE_TAKEN, data.title, subject_id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Предмет с таким названием уже есть")
    row = await conn.fetchrow(q.UPDATE_SUBJECT, subject_id, data.title, data.description, data.position)
    if row is None:
        raise not_found("Предмет")
    return SubjectOut(**dict(row))


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: int, _: Admin, conn: Conn) -> None:
    if await conn.fetchval(q.DEACTIVATE_SUBJECT, subject_id) is None:
        if await conn.fetchrow(q.GET_SUBJECT, subject_id) is None:
            raise not_found("Предмет")
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Сначала удалите темы этого предмета")


# ---------- Темы ----------


async def _theme_or_404(conn: asyncpg.Connection, theme_id: int) -> ThemeOut:
    row = await conn.fetchrow(q.GET_THEME, theme_id)
    if row is None:
        raise not_found("Тема")
    return ThemeOut(**dict(row))


@router.get("/themes", response_model=list[ThemeOut])
async def list_themes(conn: Conn, subject_id: int | None = None) -> list[ThemeOut]:
    return [ThemeOut(**dict(row)) for row in await conn.fetch(q.LIST_THEMES, subject_id)]


@router.get("/themes/{theme_id}", response_model=ThemeOut)
async def get_theme(theme_id: int, conn: Conn) -> ThemeOut:
    return await _theme_or_404(conn, theme_id)


@router.post("/themes", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
async def create_theme(data: ThemeIn, _: Admin, conn: Conn) -> ThemeOut:
    theme_id = await conn.fetchval(q.INSERT_THEME, data.subject_id, data.title, data.description, data.position)
    if theme_id is None:
        raise not_found("Предмет")
    return await _theme_or_404(conn, theme_id)


@router.put("/themes/{theme_id}", response_model=ThemeOut)
async def update_theme(theme_id: int, data: ThemeIn, _: Admin, conn: Conn) -> ThemeOut:
    updated = await conn.fetchval(
        q.UPDATE_THEME, theme_id, data.subject_id, data.title, data.description, data.position
    )
    if updated is None:
        raise not_found("Тема или предмет")
    return await _theme_or_404(conn, theme_id)


@router.delete("/themes/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theme(theme_id: int, _: Admin, conn: Conn) -> None:
    if await conn.fetchval(q.DEACTIVATE_THEME, theme_id) is None:
        await _theme_or_404(conn, theme_id)
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Сначала удалите задачи этой темы")


# ---------- Задачи ----------


async def _check_can_edit(conn: asyncpg.Connection, task_id: int, user: CurrentUser) -> None:
    author_id = await conn.fetchval(q.GET_TASK_AUTHOR, task_id)
    if author_id is None:
        raise not_found("Задача")
    if not user.is_admin and author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Можно изменять только свои задачи")


async def _task_full(conn: asyncpg.Connection, task_id: int) -> TaskFull:
    row = await conn.fetchrow(q.GET_TASK_FULL, task_id)
    if row is None:
        raise not_found("Задача")
    return TaskFull(**dict(row))


@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    conn: Conn,
    user: OptionalUser,
    theme_id: int | None = None,
    subject_id: int | None = None,
    author_id: int | None = None,
    difficulty: Annotated[int | None, Query(ge=1, le=5)] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    source_type: SourceType | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[TaskOut]:
    rows = await conn.fetch(
        q.LIST_TASKS,
        theme_id,
        subject_id,
        author_id,
        difficulty,
        search or None,
        user.id if user else None,
        limit,
        offset,
        source_type,
    )
    return [TaskOut(**dict(row)) for row in rows]


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: int, conn: Conn, user: OptionalUser) -> TaskOut:
    row = await conn.fetchrow(q.GET_TASK_PUBLIC, task_id, user.id if user else None)
    if row is None:
        raise not_found("Задача")
    return TaskOut(**dict(row))


@router.get("/tasks/{task_id}/full", response_model=TaskFull)
async def get_task_full(task_id: int, user: Staff, conn: Conn) -> TaskFull:
    await _check_can_edit(conn, task_id, user)
    return await _task_full(conn, task_id)


@router.post("/tasks", response_model=TaskFull, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskIn, user: Staff, conn: Conn) -> TaskFull:
    if not await conn.fetchval(q.THEME_EXISTS, data.theme_id):
        raise not_found("Тема")
    task_id = await conn.fetchval(
        q.INSERT_TASK,
        data.theme_id,
        user.id,
        data.title,
        data.condition,
        data.difficulty,
        data.check_mode,
        data.answer_type,
        data.answer,
        data.unit,
        data.tolerance,
        data.source_type,
        data.source_title,
        data.source_year,
        data.source_number,
    )
    return await _task_full(conn, task_id)


@router.put("/tasks/{task_id}", response_model=TaskFull)
async def update_task(task_id: int, data: TaskIn, user: Staff, conn: Conn) -> TaskFull:
    await _check_can_edit(conn, task_id, user)
    if not await conn.fetchval(q.THEME_EXISTS, data.theme_id):
        raise not_found("Тема")
    await conn.execute(
        q.UPDATE_TASK,
        task_id,
        data.theme_id,
        data.title,
        data.condition,
        data.difficulty,
        data.check_mode,
        data.answer_type,
        data.answer,
        data.unit,
        data.tolerance,
        data.source_type,
        data.source_title,
        data.source_year,
        data.source_number,
    )
    return await _task_full(conn, task_id)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, user: Staff, conn: Conn) -> None:
    await _check_can_edit(conn, task_id, user)
    await conn.execute(q.DEACTIVATE_TASK, task_id)
