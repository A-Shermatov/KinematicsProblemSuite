from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.i18n import TranslationIn, TranslationLang
from app.modules.solutions.checker import validate_expected_answer

CheckMode = Literal["auto", "manual"]
AnswerType = Literal["number", "text"]
SourceType = Literal["book", "olympiad", "exam", "own"]


class _Titled(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=2000)
    position: int = Field(default=0, ge=0, le=10_000)

    @field_validator("title", "description")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class SubjectIn(_Titled):
    pass


class SubjectOut(BaseModel):
    id: int
    title: str
    description: str
    position: int
    themes_count: int


class ThemeIn(_Titled):
    subject_id: int


class ThemeOut(BaseModel):
    id: int
    subject_id: int
    subject_title: str
    title: str
    description: str
    position: int
    tasks_count: int


class TaskIn(BaseModel):
    theme_id: int
    title: str = Field(min_length=1, max_length=150)
    condition: str = Field(default="", max_length=20_000, description="Markdown + формулы KaTeX ($…$, $$…$$)")
    difficulty: int = Field(default=100, ge=100, le=10_000, multiple_of=100, description="100, 200, 300, …")
    check_mode: CheckMode = "auto"
    answer_type: AnswerType = "number"
    answer: str = Field(min_length=1, max_length=500)
    unit: str | None = Field(default=None, max_length=30)
    tolerance: float = Field(default=0.01, ge=0, lt=1, description="Относительная погрешность, 0.01 = 1%")
    source_id: int | None = Field(default=None, description="Источник из каталога (книга, олимпиада, экзамен)")
    source_number: str | None = Field(default=None, max_length=30, description="Номер задачи в источнике")
    is_original: bool = Field(default=False, description="Авторская задача (без источника)")
    translations: dict[TranslationLang, TranslationIn] = Field(
        default_factory=dict, description="Переводы условия; русский — основной язык (title/condition)"
    )

    @field_validator("title", "answer")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("unit", "source_number")
    @classmethod
    def empty_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def check_answer_format(self) -> TaskIn:
        if self.check_mode == "auto":
            validate_expected_answer(self.answer, self.answer_type, self.unit)
        if self.source_id is None:
            # Номер без источника не имеет смысла.
            self.source_number = None
        else:
            self.is_original = False
        return self


class TaskOut(BaseModel):
    id: int
    theme_id: int
    theme_title: str
    subject_id: int
    subject_title: str
    author_id: int
    author_name: str
    title: str
    condition: str
    difficulty: int
    check_mode: CheckMode
    answer_type: AnswerType
    unit: str | None
    source_id: int | None
    source_type: SourceType | None
    source_title: str | None
    source_year: int | None
    source_author: str = ""
    source_number: str | None
    is_original: bool = False
    duplicate_of: int | None = None
    solved: bool = False
    created_at: datetime
    updated_at: datetime
    lang: str = "ru"
    available_langs: list[str] = ["ru"]


class TaskFull(TaskOut):
    """Задача вместе с ответом — только для автора и администратора."""

    answer: str
    tolerance: float
    translations: dict[str, dict[str, str]] = {}


SourceKind = Literal["book", "olympiad", "exam", "own"]


class SourceIn(BaseModel):
    type: SourceKind
    title: str = Field(min_length=1, max_length=200, description="Например: «Рымкевич. Задачник по физике 10–11»")
    author: str = Field(default="", max_length=120)
    year: int | None = Field(default=None, ge=1800, le=2100)

    @field_validator("title", "author")
    @classmethod
    def strip(cls, value: str) -> str:
        return " ".join(value.split())


class SourceOut(BaseModel):
    id: int
    type: SourceKind
    title: str
    author: str
    year: int | None
    created_by: int | None
    created_at: datetime
    tasks_count: int


class SourceMergeIn(BaseModel):
    into_id: int


class DuplicateCheckIn(BaseModel):
    title: str = Field(default="", max_length=150)
    condition: str = Field(default="", max_length=20_000)
    exclude_id: int | None = None


class DuplicateOut(BaseModel):
    id: int
    title: str
    author_id: int
    author_name: str
    theme_title: str
    exact: bool
    similarity: float


class DuplicateCheckOut(BaseModel):
    exact: DuplicateOut | None
    similar: list[DuplicateOut]
