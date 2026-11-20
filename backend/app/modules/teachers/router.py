"""Публичные профили учителей, редактирование своего профиля, сертификаты и отзывы."""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.deps import Conn, CurrentUser, OptionalUser, SettingsDep, User, not_found, require_roles
from app.modules.teachers import queries as q
from app.modules.teachers.schemas import (
    CertificateOut,
    ProfileIn,
    ReplyIn,
    ReviewIn,
    ReviewOut,
    TeacherCard,
    TeacherProfile,
    TeacherSort,
)
from app.storage import DOCUMENT_TYPES, delete_file, save_image

router = APIRouter(prefix="/teachers", tags=["teachers"])

Teacher = Annotated[CurrentUser, Depends(require_roles("teacher"))]
Student = Annotated[CurrentUser, Depends(require_roles("student"))]

MAX_CERTIFICATES = 30


async def build_profile(conn: asyncpg.Connection, teacher_id: int, viewer: CurrentUser | None) -> TeacherProfile:
    row = await conn.fetchrow(q.GET_TEACHER, teacher_id)
    if row is None:
        raise not_found("Учитель")
    is_owner = viewer is not None and viewer.id == teacher_id
    show_all_certificates = is_owner or (viewer is not None and viewer.is_admin)
    certificates = await conn.fetch(q.LIST_CERTIFICATES, teacher_id, show_all_certificates)
    distribution = {rating: 0 for rating in range(1, 6)}
    for item in await conn.fetch(q.RATING_DISTRIBUTION, teacher_id):
        distribution[item["rating"]] = item["count"]

    can_review = False
    my_review = None
    if viewer is not None and viewer.is_student:
        can_review = await conn.fetchval(q.CAN_REVIEW, teacher_id, viewer.id)
        mine = await conn.fetchrow(q.GET_MY_REVIEW, teacher_id, viewer.id)
        my_review = ReviewOut.from_row(mine) if mine else None

    card = TeacherCard.from_row(row)
    return TeacherProfile(
        **card.model_dump(),
        bio=row["bio"],
        subject_ids=list(row["subject_ids"]),
        students_count=row["students_count"],
        attempts_count=row["attempts_count"],
        created_at=row["created_at"],
        rating_distribution=distribution,
        certificates=[CertificateOut.from_row(c) for c in certificates],
        can_review=can_review,
        my_review=my_review,
    )


@router.get("", response_model=list[TeacherCard])
async def list_teachers(
    conn: Conn,
    subject_id: int | None = None,
    search: Annotated[str | None, Query(max_length=50)] = None,
    sort: TeacherSort = "rating",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[TeacherCard]:
    rows = await conn.fetch(q.LIST_TEACHERS, subject_id, search or None, sort, limit, offset)
    return [TeacherCard.from_row(row) for row in rows]


# ---------- Свой профиль (учитель) ----------


@router.get("/me", response_model=TeacherProfile)
async def my_profile(teacher: Teacher, conn: Conn) -> TeacherProfile:
    return await build_profile(conn, teacher.id, teacher)


@router.put("/me", response_model=TeacherProfile)
async def update_my_profile(data: ProfileIn, teacher: Teacher, conn: Conn) -> TeacherProfile:
    async with conn.transaction():
        await conn.execute(q.UPSERT_PROFILE, teacher.id, data.headline, data.bio, data.experience_years)
        await conn.execute(q.CLEAR_SUBJECTS, teacher.id)
        if data.subject_ids:
            await conn.execute(q.SET_SUBJECTS, teacher.id, data.subject_ids)
    return await build_profile(conn, teacher.id, teacher)


@router.post("/me/certificates", response_model=CertificateOut, status_code=status.HTTP_201_CREATED)
async def add_certificate(
    teacher: Teacher,
    conn: Conn,
    settings: SettingsDep,
    title: Annotated[str, Form(min_length=2, max_length=200)],
    file: Annotated[UploadFile, File()],
    issuer: Annotated[str, Form(max_length=200)] = "",
    year: Annotated[int | None, Form(ge=1950, le=2100)] = None,
) -> CertificateOut:
    existing = await conn.fetch(q.LIST_CERTIFICATES, teacher.id, True)
    if len(existing) >= MAX_CERTIFICATES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"Можно загрузить не больше {MAX_CERTIFICATES} документов"
        )
    path = await save_image(
        file,
        upload_dir=settings.upload_dir,
        subdir="certificates",
        max_bytes=settings.max_upload_bytes,
        allowed=DOCUMENT_TYPES,
    )
    certificate_id = await conn.fetchval(q.INSERT_CERTIFICATE, teacher.id, title.strip(), issuer.strip(), year, path)
    return CertificateOut.from_row(await conn.fetchrow(q.GET_CERTIFICATE, certificate_id))


@router.delete("/me/certificates/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certificate(certificate_id: int, teacher: Teacher, conn: Conn, settings: SettingsDep) -> None:
    path = await conn.fetchval(q.DELETE_CERTIFICATE, certificate_id, teacher.id)
    if path is None:
        raise not_found("Документ")
    delete_file(settings.upload_dir, path)


@router.post("/me/reviews/{review_id}/reply", response_model=ReviewOut)
async def reply_to_review(review_id: int, data: ReplyIn, teacher: Teacher, conn: Conn) -> ReviewOut:
    if await conn.fetchval(q.REPLY_REVIEW, review_id, teacher.id, data.text) is None:
        raise not_found("Отзыв")
    return ReviewOut.from_row(await conn.fetchrow(q.GET_REVIEW, review_id))


# ---------- Публичный профиль ----------


@router.get("/{teacher_id}", response_model=TeacherProfile)
async def get_teacher(teacher_id: int, conn: Conn, viewer: OptionalUser) -> TeacherProfile:
    return await build_profile(conn, teacher_id, viewer)


@router.get("/{teacher_id}/reviews", response_model=list[ReviewOut])
async def list_reviews(
    teacher_id: int,
    conn: Conn,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ReviewOut]:
    rows = await conn.fetch(q.LIST_REVIEWS, teacher_id, limit, offset)
    return [ReviewOut.from_row(row) for row in rows]


@router.put("/{teacher_id}/reviews/me", response_model=ReviewOut)
async def write_review(teacher_id: int, data: ReviewIn, student: Student, conn: Conn) -> ReviewOut:
    """Создать или изменить свой отзыв. Один отзыв от ученика на учителя."""
    if not await conn.fetchval(q.IS_ACTIVE_TEACHER, teacher_id):
        raise not_found("Учитель")
    if not await conn.fetchval(q.CAN_REVIEW, teacher_id, student.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Отзыв можно оставить после того, как вы решали задачи этого учителя",
        )
    review_id = await conn.fetchval(q.UPSERT_REVIEW, teacher_id, student.id, data.rating, data.text)
    return ReviewOut.from_row(await conn.fetchrow(q.GET_REVIEW, review_id))


@router.delete("/{teacher_id}/reviews/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(teacher_id: int, user: User, conn: Conn) -> None:
    if await conn.fetchval(q.DELETE_REVIEW, teacher_id, user.id) is None:
        raise not_found("Отзыв")
