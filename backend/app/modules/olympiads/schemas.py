from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.i18n import DEFAULT_LANG, Lang, TranslationIn, TranslationLang, localize
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
    level_id: int | None = None
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
    level_id: int | None = None
    level_title: str | None = None
    level_min_rating: int | None = None
    level_max_rating: int | None = None
    organizer_id: int
    organizer_name: str
    starts_at: datetime
    ends_at: datetime
    status: Status
    reject_reason: str
    results_published: bool
    phase: Phase
    # Когда откроется разбор (через сутки после окончания) и написан ли он.
    editorial_at: datetime | None = None
    has_editorial: bool = False
    participants_count: int
    tasks_count: int
    max_score: int
    is_registered: bool
    # Зритель зарегистрирован вне конкурса (False) или официально (True); None — не зарегистрирован.
    is_official: bool | None = None
    # Зритель в жюри этой олимпиады: проверяет решения, участвовать не может.
    is_jury: bool = False
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
    translations: dict[TranslationLang, TranslationIn] = Field(default_factory=dict)
    # Уровень и источник — как у задач платформы; участникам видны только после итогов (источник гуглится).
    difficulty: int | None = Field(default=None, ge=1, le=10_000)
    source_id: int | None = None
    source_number: str | None = Field(default=None, max_length=30)
    is_original: bool = False

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
    lang: str = "ru"
    available_langs: list[str] = ["ru"]
    translations: dict[str, dict[str, str]] | None = None
    difficulty: int | None = None
    source_id: int | None = None
    source_type: str | None = None
    source_title: str | None = None
    source_year: int | None = None
    source_author: str = ""
    source_number: str | None = None
    is_original: bool = False

    @classmethod
    def from_row(cls, row: Any, *, reveal: bool, lang: Lang = DEFAULT_LANG, manage: bool = False) -> OlympiadTaskOut:
        # Организатору — русский оригинал и переводы отдельно (для редактора), остальным — перевод с фолбэком.
        data = localize(row, DEFAULT_LANG if manage else lang, keep_translations=manage)
        data["source_author"] = data.get("source_author") or ""
        if data.get("is_original") and not data.get("source_type"):
            data["source_type"] = "own"
        if not reveal:
            data["answer"] = None
            data["tolerance"] = None
            # Источник и сложность до итогов скрыты: по источнику легко найти решение.
            for key in ("difficulty", "source_id", "source_type", "source_title", "source_year", "source_number"):
                data[key] = None
            data["source_author"] = ""
            data["is_original"] = False
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


class VirtualSubmissionOut(BaseModel):
    task_id: int
    task_title: str
    task_position: int
    max_points: int
    answer: str
    correct: bool | None
    points: int | None
    submitted_at: datetime
    correct_answer: str | None
    task_unit: str | None


class VirtualRunOut(BaseModel):
    """Виртуальное участие. Результаты открываются, когда личное время закончилось."""

    started_at: datetime
    ends_at: datetime
    active: bool
    submissions: list[VirtualSubmissionOut]
    total: int | None
    max_score: int
    would_place: int | None
    official_participants: int


class VirtualAnswerIn(BaseModel):
    answer: str = Field(min_length=1, max_length=500)


class LevelIn(BaseModel):
    title: str = Field(min_length=2, max_length=60)
    description: str = Field(default="", max_length=300)
    min_rating: int | None = Field(default=None, ge=0, le=5000)
    max_rating: int | None = Field(default=None, ge=1, le=5000)
    position: int = Field(default=0, ge=0, le=1000)

    @field_validator("title", "description")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def check_range(self) -> LevelIn:
        if self.min_rating is not None and self.max_rating is not None and self.min_rating >= self.max_rating:
            raise ValueError("Нижняя граница рейтинга должна быть меньше верхней")
        return self


class LevelOut(LevelIn):
    id: int


class AnnouncementIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    task_id: int | None = None

    @field_validator("text")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class EditorialIn(BaseModel):
    text: str = Field(default="", max_length=50_000, description="Markdown: общий разбор олимпиады")
    solutions: dict[int, str] = Field(default_factory=dict, description="id задачи → разбор решения (Markdown)")

    @field_validator("solutions")
    @classmethod
    def limit(cls, value: dict[int, str]) -> dict[int, str]:
        if any(len(text) > 30_000 for text in value.values()):
            raise ValueError("Разбор одной задачи — не длиннее 30 000 символов")
        return {task_id: text.strip() for task_id, text in value.items()}


class JuryMemberIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
