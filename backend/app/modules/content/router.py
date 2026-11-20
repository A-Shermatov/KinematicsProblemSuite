from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status

from app.deps import Admin, Conn, CurrentUser, OptionalUser, Staff, not_found
from app.i18n import DEFAULT_LANG, RequestLang, clean_translations, localize
from app.modules.content import queries as q
from app.modules.content.schemas import (
    SourceIn,
    SourceMergeIn,
    SourceOut,
    SourceType,
    SubjectOut,
    TaskFull,
    TaskIn,
    TaskOut,
    ThemeOut,
)
from app.modules.settings import service as settings_service

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
    # Редактору — оригинал на русском и все переводы отдельно.
    return TaskFull(**localize(row, DEFAULT_LANG, keep_translations=True))


@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    conn: Conn,
    user: OptionalUser,
    lang: RequestLang,
    theme_id: int | None = None,
    subject_id: int | None = None,
    author_id: int | None = None,
    difficulty: Annotated[int | None, Query(ge=100, le=10_000, multiple_of=100)] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    source_type: SourceType | None = None,
    source_id: int | None = None,
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
        source_id,
    )
    return [TaskOut(**localize(row, lang)) for row in rows]


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: int, conn: Conn, user: OptionalUser, lang: RequestLang) -> TaskOut:
    row = await conn.fetchrow(q.GET_TASK_PUBLIC, task_id, user.id if user else None)
    if row is None:
        raise not_found("Задача")
    return TaskOut(**localize(row, lang))


@router.get("/tasks/{task_id}/full", response_model=TaskFull)
async def get_task_full(task_id: int, user: Staff, conn: Conn) -> TaskFull:
    await _check_can_edit(conn, task_id, user)
    return await _task_full(conn, task_id)


async def _check_source(conn: asyncpg.Connection, data: TaskIn) -> None:
    if data.source_id is not None and not await conn.fetchval(q.SOURCE_EXISTS, data.source_id):
        raise not_found("Источник")


async def _check_difficulty(conn: asyncpg.Connection, difficulty: int) -> None:
    settings = await settings_service.load(conn)
    if difficulty > settings.difficulty_max:
        raise HTTPException(422, detail=f"Максимальная сложность на платформе — {settings.difficulty_max}")


@router.post("/tasks", response_model=TaskFull, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskIn, user: Staff, conn: Conn) -> TaskFull:
    await _check_difficulty(conn, data.difficulty)
    await _check_source(conn, data)
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
        data.source_id,
        data.source_number,
        data.is_original,
        clean_translations(data.translations),
    )
    return await _task_full(conn, task_id)


@router.put("/tasks/{task_id}", response_model=TaskFull)
async def update_task(task_id: int, data: TaskIn, user: Staff, conn: Conn) -> TaskFull:
    await _check_can_edit(conn, task_id, user)
    await _check_difficulty(conn, data.difficulty)
    await _check_source(conn, data)
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
        data.source_id,
        data.source_number,
        data.is_original,
        clean_translations(data.translations),
    )
    return await _task_full(conn, task_id)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, user: Staff, conn: Conn) -> None:
    await _check_can_edit(conn, task_id, user)
    await conn.execute(q.DEACTIVATE_TASK, task_id)


# ---------- Источники ----------


async def _source_or_404(conn: asyncpg.Connection, source_id: int) -> SourceOut:
    row = await conn.fetchrow(q.GET_SOURCE, source_id)
    if row is None:
        raise not_found("Источник")
    return SourceOut(**dict(row))


def _duplicate_source() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail="Источник с таким названием и годом уже есть в каталоге")


@router.get("/sources", response_model=list[SourceOut])
async def list_sources(
    conn: Conn,
    search: Annotated[str | None, Query(max_length=100)] = None,
    type: SourceType | None = None,  # noqa: A002 — имя параметра в API
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[SourceOut]:
    rows = await conn.fetch(q.LIST_SOURCES, search or None, type, limit)
    return [SourceOut(**dict(row)) for row in rows]


@router.get("/sources/{source_id}", response_model=SourceOut)
async def get_source(source_id: int, conn: Conn) -> SourceOut:
    return await _source_or_404(conn, source_id)


@router.post("/sources", response_model=SourceOut, status_code=status.HTTP_201_CREATED)
async def create_source(data: SourceIn, user: Staff, conn: Conn) -> SourceOut:
    """Учитель добавляет книгу или олимпиаду в общий каталог. Дубликат (название + год) не создаётся."""
    source_id = await conn.fetchval(q.INSERT_SOURCE, data.type, data.title, data.author, data.year, user.id)
    if source_id is None:
        raise _duplicate_source()
    return await _source_or_404(conn, source_id)


@router.put("/sources/{source_id}", response_model=SourceOut)
async def update_source(source_id: int, data: SourceIn, user: Staff, conn: Conn) -> SourceOut:
    """Админ правит любой источник; учитель — свой, пока на него не ссылаются задачи других учителей."""
    source = await _source_or_404(conn, source_id)
    if not user.is_admin and (
        source.created_by != user.id or await conn.fetchval(q.SOURCE_FOREIGN_TASKS, source_id, user.id)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Этот источник может изменить только администратор")
    try:
        await conn.execute(q.UPDATE_SOURCE, source_id, data.type, data.title, data.author, data.year)
    except asyncpg.UniqueViolationError:
        raise _duplicate_source() from None
    return await _source_or_404(conn, source_id)


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: int, _: Admin, conn: Conn) -> None:
    """Удаление источника. Задачи остаются, но теряют ссылку на источник."""
    if await conn.fetchval(q.DELETE_SOURCE, source_id) is None:
        raise not_found("Источник")


@router.post("/sources/{source_id}/merge", response_model=SourceOut)
async def merge_source(source_id: int, data: SourceMergeIn, _: Admin, conn: Conn) -> SourceOut:
    """Слить дубликат в другой источник: задачи переходят к нему, дубликат удаляется."""
    if source_id == data.into_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Нельзя слить источник сам с собой")
    await _source_or_404(conn, source_id)
    target = await _source_or_404(conn, data.into_id)
    async with conn.transaction():
        await conn.execute(q.MERGE_SOURCE, source_id, data.into_id)
        await conn.execute(q.DELETE_SOURCE, source_id)
    return await _source_or_404(conn, target.id)
