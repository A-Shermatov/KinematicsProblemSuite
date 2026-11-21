from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.storage import public_url

AttemptStatus = Literal["correct", "incorrect", "pending", "graded"]
Scope = Literal["mine", "authored"]


class AttemptOut(BaseModel):
    id: int
    task_id: int
    task_title: str
    theme_id: int
    theme_title: str
    task_author_id: int
    student_id: int
    student_username: str
    student_name: str
    answer: str
    image_url: str | None
    status: AttemptStatus
    system_grade: int | None
    teacher_grade: int | None
    feedback: str
    graded_at: datetime | None
    created_at: datetime
    correct_answer: str | None = Field(
        description="Правильный ответ: виден автору задачи, админу и ученику после верного решения"
    )
    task_unit: str | None
    # Подсказка по неверному ответу: есть ли она и её текст — после того как ученик откроет (−20% очков).
    mistake_hint_available: bool = False
    mistake_hint: str | None = None

    @classmethod
    def from_row(cls, row: Any, *, viewer_id: int, viewer_is_admin: bool) -> AttemptOut:
        reveal = viewer_is_admin or row["task_author_id"] == viewer_id or row["status"] == "correct"
        return cls(
            id=row["id"],
            task_id=row["task_id"],
            task_title=row["task_title"],
            theme_id=row["theme_id"],
            theme_title=row["theme_title"],
            task_author_id=row["task_author_id"],
            student_id=row["student_id"],
            student_username=row["student_username"],
            student_name=row["student_name"],
            answer=row["answer"],
            image_url=public_url(row["image_path"]),
            status=row["status"],
            system_grade=row["system_grade"],
            teacher_grade=row["teacher_grade"],
            feedback=row["feedback"],
            graded_at=row["graded_at"],
            created_at=row["created_at"],
            correct_answer=row["correct_answer"] if reveal else None,
            task_unit=row["task_unit"],
            mistake_hint_available=bool(row["mistake_hint"]),
            # Автор и админ видят подсказку всегда, ученик — после открытия.
            mistake_hint=row["mistake_hint"]
            if row["mistake_hint_opened"] or viewer_is_admin or row["task_author_id"] == viewer_id
            else None,
        )


class GradeIn(BaseModel):
    grade: int = Field(ge=0, le=100)
    feedback: str = Field(default="", max_length=2000)
