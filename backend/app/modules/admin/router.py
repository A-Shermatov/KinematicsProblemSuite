"""API админ-панели. Всё под /api/admin и только для роли admin.

Отдельный префикс позволяет закрыть админский API на публичном домене (см. nginx-web.conf)
и открыть только на домене админ-панели.
"""

from __future__ import annotations

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import Admin, Conn, not_found, require_roles
from app.modules.auth import queries as auth_q
from app.modules.content import queries as content_q
from app.modules.content.schemas import SubjectIn, SubjectOut, ThemeIn, ThemeOut
from app.modules.solutions import queries as solutions_q
from app.modules.solutions.schemas import AttemptOut, AttemptStatus
from app.modules.stats import queries as stats_q
from app.modules.teachers import queries as teachers_q
from app.modules.teachers.schemas import CertificateDecision, CertificateOut, CertificateStatus, HiddenUpdate, ReviewOut
from app.modules.users import queries as user_q
from app.modules.users.schemas import ActiveUpdate, Role, RoleUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles("admin"))])


# ---------- Сводка ----------


@router.get("/stats")
async def stats(conn: Conn) -> dict[str, Any]:
    return dict(await conn.fetchrow(stats_q.ADMIN_SUMMARY))


# ---------- Пользователи ----------


@router.get("/users", response_model=list[UserOut])
async def list_users(
    conn: Conn,
    role: Role | None = None,
    search: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[UserOut]:
    rows = await conn.fetch(user_q.LIST, role, search or None, limit, offset)
    return [UserOut.from_row(row) for row in rows]


@router.patch("/users/{user_id}/active", response_model=UserOut)
async def set_active(user_id: int, data: ActiveUpdate, admin: Admin, conn: Conn) -> UserOut:
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя заблокировать самого себя")
    async with conn.transaction():
        row = await conn.fetchrow(user_q.SET_ACTIVE, user_id, data.is_active)
        if row is None:
            raise not_found("Пользователь")
        if not data.is_active:
            await conn.execute(auth_q.REVOKE_ALL_FOR_USER, user_id)
    return UserOut.from_row(row)


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def set_role(user_id: int, data: RoleUpdate, admin: Admin, conn: Conn) -> UserOut:
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя изменить собственную роль")
    row = await conn.fetchrow(user_q.SET_ROLE, user_id, data.role)
    if row is None:
        raise not_found("Пользователь")
    return UserOut.from_row(row)


# ---------- Предметы ----------


@router.post("/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(data: SubjectIn, conn: Conn) -> SubjectOut:
    if await conn.fetchval(content_q.SUBJECT_TITLE_TAKEN, data.title, None):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Предмет с таким названием уже есть")
    row = await conn.fetchrow(content_q.INSERT_SUBJECT, data.title, data.description, data.position)
    return SubjectOut(**dict(row))


@router.put("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(subject_id: int, data: SubjectIn, conn: Conn) -> SubjectOut:
    if await conn.fetchval(content_q.SUBJECT_TITLE_TAKEN, data.title, subject_id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Предмет с таким названием уже есть")
    row = await conn.fetchrow(content_q.UPDATE_SUBJECT, subject_id, data.title, data.description, data.position)
    if row is None:
        raise not_found("Предмет")
    return SubjectOut(**dict(row))


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: int, conn: Conn) -> None:
    if await conn.fetchval(content_q.DEACTIVATE_SUBJECT, subject_id) is None:
        if await conn.fetchrow(content_q.GET_SUBJECT, subject_id) is None:
            raise not_found("Предмет")
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Сначала удалите темы этого предмета")


# ---------- Темы ----------


async def _theme_or_404(conn: asyncpg.Connection, theme_id: int) -> ThemeOut:
    row = await conn.fetchrow(content_q.GET_THEME, theme_id)
    if row is None:
        raise not_found("Тема")
    return ThemeOut(**dict(row))


@router.post("/themes", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
async def create_theme(data: ThemeIn, conn: Conn) -> ThemeOut:
    theme_id = await conn.fetchval(content_q.INSERT_THEME, data.subject_id, data.title, data.description, data.position)
    if theme_id is None:
        raise not_found("Предмет")
    return await _theme_or_404(conn, theme_id)


@router.put("/themes/{theme_id}", response_model=ThemeOut)
async def update_theme(theme_id: int, data: ThemeIn, conn: Conn) -> ThemeOut:
    updated = await conn.fetchval(
        content_q.UPDATE_THEME, theme_id, data.subject_id, data.title, data.description, data.position
    )
    if updated is None:
        raise not_found("Тема или предмет")
    return await _theme_or_404(conn, theme_id)


@router.delete("/themes/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theme(theme_id: int, conn: Conn) -> None:
    if await conn.fetchval(content_q.DEACTIVATE_THEME, theme_id) is None:
        await _theme_or_404(conn, theme_id)
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Сначала удалите задачи этой темы")


# ---------- Решения ----------


@router.get("/attempts", response_model=list[AttemptOut])
async def list_attempts(
    admin: Admin,
    conn: Conn,
    status_filter: Annotated[AttemptStatus | None, Query(alias="status")] = None,
    task_id: int | None = None,
    student_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AttemptOut]:
    rows = await conn.fetch(solutions_q.LIST_ATTEMPTS, student_id, None, status_filter, task_id, limit, offset)
    return [AttemptOut.from_row(row, viewer_id=admin.id, viewer_is_admin=True) for row in rows]


# ---------- Сертификаты учителей ----------


@router.get("/certificates", response_model=list[CertificateOut])
async def list_certificates(
    conn: Conn,
    status_filter: Annotated[CertificateStatus | None, Query(alias="status")] = "pending",
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[CertificateOut]:
    rows = await conn.fetch(teachers_q.ADMIN_LIST_CERTIFICATES, status_filter, limit, offset)
    return [CertificateOut.from_row(row) for row in rows]


@router.post("/certificates/{certificate_id}/review", response_model=CertificateOut)
async def review_certificate(
    certificate_id: int, data: CertificateDecision, admin: Admin, conn: Conn
) -> CertificateOut:
    if data.status == "rejected" and not data.reason.strip():
        raise HTTPException(422, detail="Укажите причину отказа")
    reason = data.reason.strip() if data.status == "rejected" else ""
    if await conn.fetchval(teachers_q.REVIEW_CERTIFICATE, certificate_id, data.status, reason, admin.id) is None:
        raise not_found("Документ")
    return CertificateOut.from_row(await conn.fetchrow(teachers_q.GET_CERTIFICATE, certificate_id))


# ---------- Отзывы ----------


@router.get("/reviews", response_model=list[ReviewOut])
async def list_reviews(
    conn: Conn,
    hidden: bool | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ReviewOut]:
    rows = await conn.fetch(teachers_q.ADMIN_LIST_REVIEWS, hidden, limit, offset)
    return [ReviewOut.from_row(row) for row in rows]


@router.patch("/reviews/{review_id}", response_model=ReviewOut)
async def set_review_hidden(review_id: int, data: HiddenUpdate, conn: Conn) -> ReviewOut:
    if await conn.fetchval(teachers_q.SET_REVIEW_HIDDEN, review_id, data.is_hidden) is None:
        raise not_found("Отзыв")
    return ReviewOut.from_row(await conn.fetchrow(teachers_q.GET_REVIEW, review_id))
