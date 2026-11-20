from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.content.schemas import AnswerType
from app.modules.solutions.checker import validate_expected_answer
from app.storage import public_url

Status = Literal["draft", "pending", "published", "rejected"]
Phase = Literal["upcoming", "running", "checking", "finished"]

MAX_DURATION = timedelta(days=14)


class OlympiadIn(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=10_000, description="Markdown: правила, формат, призы")
    subject_id: int | None = None
    starts_at: datetime
    ends_at: datetime

    @field_validator("title", "description")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def check_window(self) -> OlympiadIn:
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Время начала и окончания нужно указывать с часовым поясом")
        if self.ends_at <= self.starts_at:
            raise ValueError("Окончание должно быть позже начала")
        if self.ends_at - self.starts_at > MAX_DURATION:
            raise ValueError("Олимпиада не может длиться дольше 14 дней")
        return self


class OlympiadOut(BaseModel):
    id: int
    title: str
    description: str
    subject_id: int | None
    subject_title: str | None
    organizer_id: int
    organizer_name: str
    starts_at: datetime
    ends_at: datetime
    status: Status
    reject_reason: str
    results_published: bool
    phase: Phase
    participants_count: int
    tasks_count: int
    max_score: int
    is_registered: bool
    created_at: datetime


class OlympiadTaskIn(BaseModel):
    position: int = Field(default=0, ge=0, le=1000)
    title: str = Field(min_length=1, max_length=150)
    condition: str = Field(default="", max_length=20_000)
    answer_type: AnswerType = "number"
    answer: str = Field(min_length=1, max_length=500)
    unit: str | None = Field(default=None, max_length=30)
    tolerance: float = Field(default=0.01, ge=0, lt=1)
    max_points: int = Field(default=10, ge=1, le=100)

    @field_validator("title", "answer")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("unit")
    @classmethod
    def empty_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def check_answer(self) -> OlympiadTaskIn:
        validate_expected_answer(self.answer, self.answer_type, self.unit)
        return self


class OlympiadTaskOut(BaseModel):
    """Задача олимпиады. Ответ отдаётся только организатору, админу и всем после публикации итогов."""

    id: int
    olympiad_id: int
    position: int
    title: str
    condition: str
    answer_type: AnswerType
    unit: str | None
    max_points: int
    answer: str | None = None
    tolerance: float | None = None

    @classmethod
    def from_row(cls, row: Any, *, reveal: bool) -> OlympiadTaskOut:
        data = dict(row)
        if not reveal:
            data["answer"] = None
            data["tolerance"] = None
        return cls(**data)


class OlympiadDetail(OlympiadOut):
    tasks: list[OlympiadTaskOut]
    can_manage: bool
    ungraded_count: int | None = None


class SubmissionOut(BaseModel):
    id: int
    olympiad_id: int
    task_id: int
    task_title: str
    task_position: int
    max_points: int
    user_id: int
    username: str
    user_name: str
    school: str | None
    city: str | None
    answer: str
    image_url: str
    auto_correct: bool
    auto_points: int
    jury_points: int | None
    jury_comment: str
    points: int
    graded_at: datetime | None
    submitted_at: datetime
    correct_answer: str | None
    task_unit: str | None

    @classmethod
    def from_row(cls, row: Any, *, reveal: bool) -> SubmissionOut:
        data = dict(row)
        data["image_url"] = public_url(data.pop("image_path")) or ""
        if not reveal:
            # До публикации итогов участник не видит ни эталон, ни результат автопроверки.
            data["correct_answer"] = None
            data["auto_correct"] = False
            data["auto_points"] = 0
            data["points"] = 0
            data["jury_points"] = None
            data["jury_comment"] = ""
        return cls(**data)


class GradeIn(BaseModel):
    points: int = Field(ge=0, le=100)
    comment: str = Field(default="", max_length=2000)


class ReviewIn(BaseModel):
    status: Literal["published", "rejected"]
    reason: str = Field(default="", max_length=500)
