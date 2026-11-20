from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.solutions.checker import validate_expected_answer

CheckMode = Literal["auto", "manual"]
AnswerType = Literal["number", "text"]


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
    difficulty: int = Field(default=1, ge=1, le=5)
    check_mode: CheckMode = "auto"
    answer_type: AnswerType = "number"
    answer: str = Field(min_length=1, max_length=500)
    unit: str | None = Field(default=None, max_length=30)
    tolerance: float = Field(default=0.01, ge=0, lt=1, description="Относительная погрешность, 0.01 = 1%")

    @field_validator("title", "answer")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("unit")
    @classmethod
    def empty_unit_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def check_answer_format(self) -> TaskIn:
        if self.check_mode == "auto":
            validate_expected_answer(self.answer, self.answer_type, self.unit)
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
    solved: bool = False
    created_at: datetime
    updated_at: datetime


class TaskFull(TaskOut):
    """Задача вместе с ответом — только для автора и администратора."""

    answer: str
    tolerance: float
