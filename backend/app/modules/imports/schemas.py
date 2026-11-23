from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.modules.content.schemas import AnswerType, CheckMode, DuplicateOut


class TaskDraft(BaseModel):
    """Распознанная задача — ещё не сохранена, учитель проверяет её перед импортом."""

    title: str
    condition: str
    answer: str
    unit: str | None = None
    answer_type: AnswerType = "number"
    difficulty: int | None = None
    source_number: str | None = None
    answer_is_guess: bool = False
    duplicate: DuplicateOut | None = None
    similar: list[DuplicateOut] = []


class ParseResult(BaseModel):
    method: Literal["file", "ai"]
    drafts: list[TaskDraft]
    notes: str = ""
    model: str | None = None


class ImportItem(BaseModel):
    title: str
    condition: str = ""
    answer: str
    unit: str | None = None
    answer_type: AnswerType = "number"
    difficulty: int = 100
    source_number: str | None = None


class ImportIn(BaseModel):
    theme_id: int
    check_mode: CheckMode = "auto"
    source_id: int | None = None
    is_original: bool = False
    tasks: list[ImportItem] = Field(min_length=1, max_length=200)


class ImportFailure(BaseModel):
    index: int
    title: str
    error: str


class ImportResult(BaseModel):
    created: list[int]
    failed: list[ImportFailure]


class TranslateIn(BaseModel):
    """Поля задачи для перевода; пустые остаются пустыми."""

    source: Literal["ru", "en", "tg"] = "ru"
    target: Literal["ru", "en", "tg"]
    title: str = Field(default="", max_length=150)
    condition: str = Field(default="", max_length=20_000)
    hints: list[str] = Field(default_factory=list, max_length=3)
    explanation: str = Field(default="", max_length=20_000)
    model: str | None = None


class TranslateOut(BaseModel):
    title: str
    condition: str
    hints: list[str]
    explanation: str
    model: str
