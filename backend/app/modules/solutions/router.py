from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from app.deps import Conn, SettingsDep, User, not_found
from app.modules.content import queries as content_q
from app.modules.solutions import queries as q
from app.modules.solutions.checker import check_answer, mistake_hint
from app.modules.solutions.schemas import AttemptOut, AttemptStatus, GradeIn, Scope
from app.storage import delete_file, save_image

router = APIRouter(prefix="/attempts", tags=["attempts"])

MAX_ATTEMPTS_PER_MINUTE = 10


@router.post("", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
async def create_attempt(
    user: User,
    conn: Conn,
    settings: SettingsDep,
    task_id: Annotated[int, Form()],
    answer: Annotated[str, Form(max_length=2000)] = "",
    image: Annotated[UploadFile | None, File()] = None,
) -> AttemptOut:
    if user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Администратор не отправляет решения")
    task = await conn.fetchrow(content_q.GET_TASK_FULL, task_id)
    if task is None:
        raise not_found("Задача")
    if task["author_id"] == user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Нельзя решать собственную задачу")
    answer = answer.strip()
    if not answer and image is None:
        raise HTTPException(422, detail="Введите ответ или приложите фото решения")
    if await conn.fetchval(q.RECENT_ATTEMPTS_COUNT, task_id, user.id) >= MAX_ATTEMPTS_PER_MINUTE:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Слишком много попыток, подождите минуту")

    image_path = None
    if image is not None and image.filename:
        image_path = await save_image(
            image, upload_dir=settings.upload_dir, subdir="attempts", max_bytes=settings.max_upload_bytes
        )

    if task["check_mode"] == "auto":
        result = check_answer(
            answer,
            expected=task["answer"],
            answer_type=task["answer_type"],
            unit=task["unit"],
            tolerance=task["tolerance"],
        )
        attempt_status, system_grade, feedback = (
            ("correct", 100, result.feedback) if result.correct else ("incorrect", 0, result.feedback)
        )
        if not result.correct:
            mistakes = json.loads(task["mistakes"]) if isinstance(task["mistakes"], str) else task["mistakes"]
            hint = mistake_hint(
                answer,
                expected=task["answer"],
                answer_type=task["answer_type"],
                unit=task["unit"],
                tolerance=task["tolerance"],
                mistakes=mistakes or [],
            )
            if hint:
                feedback = f"{feedback}. {hint}" if not feedback.endswith((".", "!")) else f"{feedback} {hint}"
    else:
        attempt_status, system_grade, feedback = "pending", None, "Ожидает проверки учителем"

    try:
        attempt_id = await conn.fetchval(
            q.INSERT_ATTEMPT, task_id, user.id, answer, image_path, attempt_status, system_grade, feedback
        )
    except Exception:
        delete_file(settings.upload_dir, image_path)
        raise
    row = await conn.fetchrow(q.GET_ATTEMPT, attempt_id)
    return AttemptOut.from_row(row, viewer_id=user.id, viewer_is_admin=False)


@router.get("", response_model=list[AttemptOut])
async def list_attempts(
    user: User,
    conn: Conn,
    scope: Scope | None = None,
    status_filter: Annotated[AttemptStatus | None, Query(alias="status")] = None,
    task_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AttemptOut]:
    """mine — мои решения; authored — решения моих задач. Все решения — в /api/admin/attempts."""
    scope = scope or ("mine" if user.is_student else "authored")
    if scope == "authored" and user.is_student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    student_id = user.id if scope == "mine" else None
    author_id = user.id if scope == "authored" else None
    rows = await conn.fetch(q.LIST_ATTEMPTS, student_id, author_id, status_filter, task_id, limit, offset)
    return [AttemptOut.from_row(row, viewer_id=user.id, viewer_is_admin=user.is_admin) for row in rows]


@router.get("/{attempt_id}", response_model=AttemptOut)
async def get_attempt(attempt_id: int, user: User, conn: Conn) -> AttemptOut:
    row = await conn.fetchrow(q.GET_ATTEMPT, attempt_id)
    if row is None:
        raise not_found("Попытка")
    if not (user.is_admin or row["student_id"] == user.id or row["task_author_id"] == user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    return AttemptOut.from_row(row, viewer_id=user.id, viewer_is_admin=user.is_admin)


@router.post("/{attempt_id}/grade", response_model=AttemptOut)
async def grade_attempt(attempt_id: int, data: GradeIn, user: User, conn: Conn) -> AttemptOut:
    row = await conn.fetchrow(q.GET_ATTEMPT, attempt_id)
    if row is None:
        raise not_found("Попытка")
    if not (user.is_admin or row["task_author_id"] == user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Оценивать можно только решения своих задач")
    await conn.execute(q.GRADE_ATTEMPT, attempt_id, data.grade, data.feedback.strip(), user.id)
    row = await conn.fetchrow(q.GET_ATTEMPT, attempt_id)
    return AttemptOut.from_row(row, viewer_id=user.id, viewer_is_admin=user.is_admin)
