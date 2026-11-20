from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.storage import public_url

CertificateStatus = Literal["pending", "verified", "rejected"]
TeacherSort = Literal["rating", "tasks", "new"]


def _name(row: Any) -> str:
    return f"{row['first_name']} {row['last_name']}".strip() or row["username"]


class TeacherCard(BaseModel):
    """Карточка в списке учителей."""

    id: int
    username: str
    name: str
    avatar_url: str | None
    headline: str
    experience_years: int | None
    subjects: list[str]
    rating: float | None
    reviews_count: int
    tasks_count: int
    verified_certificates: int

    @classmethod
    def from_row(cls, row: Any) -> TeacherCard:
        return cls(
            id=row["id"],
            username=row["username"],
            name=_name(row),
            avatar_url=public_url(row["avatar_path"]),
            headline=row["headline"],
            experience_years=row["experience_years"],
            subjects=list(row["subjects"]),
            rating=float(row["rating"]) if row["rating"] is not None else None,
            reviews_count=row["reviews_count"],
            tasks_count=row["tasks_count"],
            verified_certificates=row["verified_certificates"],
        )


class CertificateOut(BaseModel):
    id: int
    teacher_id: int
    teacher_name: str
    title: str
    issuer: str
    year: int | None
    file_url: str
    is_pdf: bool
    status: CertificateStatus
    reject_reason: str
    reviewed_at: datetime | None
    created_at: datetime

    @classmethod
    def from_row(cls, row: Any) -> CertificateOut:
        return cls(
            id=row["id"],
            teacher_id=row["teacher_id"],
            teacher_name=row["teacher_name"],
            title=row["title"],
            issuer=row["issuer"],
            year=row["year"],
            file_url=public_url(row["file_path"]) or "",
            is_pdf=row["file_path"].endswith(".pdf"),
            status=row["status"],
            reject_reason=row["reject_reason"],
            reviewed_at=row["reviewed_at"],
            created_at=row["created_at"],
        )


class ReviewOut(BaseModel):
    id: int
    teacher_id: int
    teacher_name: str
    student_id: int
    student_username: str
    student_name: str
    student_avatar_url: str | None
    rating: int
    text: str
    reply: str
    replied_at: datetime | None
    is_hidden: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: Any) -> ReviewOut:
        data = dict(row)
        data["student_avatar_url"] = public_url(data.pop("student_avatar_path"))
        return cls(**data)


class TeacherProfile(TeacherCard):
    bio: str
    subject_ids: list[int]
    students_count: int
    attempts_count: int
    created_at: datetime
    rating_distribution: dict[int, int]
    certificates: list[CertificateOut]
    # Для текущего пользователя:
    can_review: bool = False
    my_review: ReviewOut | None = None


class ProfileIn(BaseModel):
    headline: str = Field(default="", max_length=150)
    bio: str = Field(default="", max_length=10_000, description="Markdown")
    experience_years: int | None = Field(default=None, ge=0, le=70)
    subject_ids: list[int] = Field(default_factory=list, max_length=20)

    @field_validator("headline", "bio")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=2000)

    @field_validator("text")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class ReplyIn(BaseModel):
    text: str = Field(default="", max_length=2000)

    @field_validator("text")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class CertificateDecision(BaseModel):
    status: Literal["verified", "rejected"]
    reason: str = Field(default="", max_length=500)


class HiddenUpdate(BaseModel):
    is_hidden: bool
