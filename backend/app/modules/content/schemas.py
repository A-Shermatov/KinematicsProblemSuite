from __future__ import annotations

import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.i18n import TranslationIn, TranslationLang
from app.modules.content.params import ParamError, expected_answer
from app.modules.content.params import choices as param_choices
from app.modules.content.params import validate as validate_params
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


class MistakeIn(BaseModel):
    answer: str = Field(min_length=1, max_length=100, description="Неверный ответ, например «72» или «72 м/с»")
    message: str = Field(min_length=1, max_length=300, description="Что показать ученику")

    @field_validator("answer", "message")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class ParamSpec(BaseModel):
    min: float
    max: float
    step: float = Field(gt=0)


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
    hints: list[str] = Field(default_factory=list, max_length=3, description="До 3 подсказок, открываются по очереди")
    explanation: str = Field(default="", max_length=20_000, description="Разбор решения (Markdown)")
    mistakes: list[MistakeIn] = Field(
        default_factory=list, max_length=10, description="Частые неверные ответы и пояснения к ним"
    )
    params: dict[str, ParamSpec] = Field(
        default_factory=dict, description="Параметры {v}: у каждого ученика свои значения из диапазона"
    )
    answer_formula: str = Field(default="", max_length=500, description="Формула ответа для задачи с параметрами")

    @model_validator(mode="before")
    @classmethod
    def parametric_answer(cls, data: object) -> object:
        # У задачи с параметрами ответ считается по формуле; в поле answer кладём пример (для проверки формата).
        if isinstance(data, dict) and data.get("params"):
            data = {**data, "answer_type": "number"}
            try:
                specs = {name: dict(spec) for name, spec in data["params"].items()}
                validate_params(specs, str(data.get("answer_formula") or ""))
                sample = {name: param_choices(spec)[0] for name, spec in specs.items()}
                data["answer"] = expected_answer(str(data["answer_formula"]), sample)
            except ParamError as exc:
                raise ValueError(str(exc)) from exc
            except (TypeError, AttributeError) as exc:
                raise ValueError("Некорректные параметры задачи") from exc
        return data

    @field_validator("hints")
    @classmethod
    def clean_hints(cls, value: list[str]) -> list[str]:
        hints = [hint.strip() for hint in value if hint.strip()]
        if any(len(hint) > 2000 for hint in hints):
            raise ValueError("Подсказка слишком длинная (до 2000 символов)")
        return hints

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
    is_parametric: bool = False


class TaskFull(TaskOut):
    """Задача вместе с ответом — только для автора и администратора."""

    answer: str
    tolerance: float
    translations: dict[str, dict[str, str]] = {}
    hints: list[str] = []
    explanation: str = ""
    mistakes: list[MistakeIn] = []
    params: dict[str, ParamSpec] = {}
    answer_formula: str = ""

    @field_validator("hints", "mistakes", "params", mode="before")
    @classmethod
    def parse_json(cls, value: object) -> object:
        return json.loads(value) if isinstance(value, str) else value


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


class TaskHelpOut(BaseModel):
    """Подсказки и разбор для страницы задачи."""

    hints_total: int
    hints: list[str] = Field(description="Открытые подсказки (автору и админу — все)")
    points: int = Field(description="Сколько очков даст задача с учётом открытых подсказок")
    hint_penalty: int = Field(description="Процент очков, который снимает каждая подсказка")
    has_explanation: bool
    explanation: str | None = Field(description="Разбор — после верного ответа или нескольких неверных попыток")
    attempts_until_explanation: int
    can_open_hints: bool
