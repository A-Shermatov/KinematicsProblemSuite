"""Олимпиады.

Жизненный цикл: черновик (учитель) → на проверке → опубликована админом → идёт в общем окне →
проверка жюри → итоги опубликованы. Фото решения обязательно; балл = оценка жюри, а без неё — автопроверка.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.deps import Conn, CurrentUser, OptionalUser, SettingsDep, User, not_found, require_roles
from app.i18n import DEFAULT_LANG, Lang, RequestLang, clean_translations
from app.modules.olympiads import queries as q
from app.modules.olympiads.schemas import (
    GradeIn,
    OlympiadDetail,
    OlympiadIn,
    OlympiadOut,
    OlympiadTaskIn,
    OlympiadTaskOut,
    Phase,
    SubmissionOut,
    VirtualAnswerIn,
    VirtualRunOut,
    VirtualSubmissionOut,
)
from app.modules.solutions.checker import check_answer
from app.storage import delete_file, public_url, save_image

router = APIRouter(prefix="/olympiads", tags=["olympiads"])

Teacher = Annotated[CurrentUser, Depends(require_roles("teacher"))]
Student = Annotated[CurrentUser, Depends(require_roles("student"))]


async def _get(conn: asyncpg.Connection, olympiad_id: int, viewer: CurrentUser | None) -> asyncpg.Record:
    row = await conn.fetchrow(q.GET, olympiad_id, viewer.id if viewer else None)
    if row is None:
        raise not_found("Олимпиада")
    return row


def _can_manage(row: asyncpg.Record, user: CurrentUser | None) -> bool:
    return user is not None and (user.is_admin or row["organizer_id"] == user.id)


def _visible(row: asyncpg.Record, user: CurrentUser | None) -> bool:
    return row["status"] == "published" or _can_manage(row, user)


async def _managed(conn: asyncpg.Connection, olympiad_id: int, user: CurrentUser) -> asyncpg.Record:
    row = await _get(conn, olympiad_id, user)
    if not _can_manage(row, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Управлять олимпиадой может только организатор")
    return row


def _require_editable(row: asyncpg.Record) -> None:
    if row["status"] not in ("draft", "rejected"):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Олимпиаду на проверке или опубликованную изменить нельзя")


async def _detail(
    conn: asyncpg.Connection, row: asyncpg.Record, viewer: CurrentUser | None, lang: Lang = DEFAULT_LANG
) -> OlympiadDetail:
    manage = _can_manage(row, viewer)
    phase: Phase = row["phase"]
    # Условия видны организатору всегда, участникам — с начала олимпиады, всем — после итогов.
    show_tasks = manage or phase == "finished" or (phase in ("running", "checking") and row["is_registered"])
    tasks = await conn.fetch(q.LIST_TASKS, row["id"]) if show_tasks else []
    reveal = manage or phase == "finished"
    if reveal and not manage and viewer is not None:
        # Пока идёт виртуальное участие, ответы скрыты — иначе это не тренировка.
        run = await conn.fetchrow(q.GET_RUN, row["id"], viewer.id)
        reveal = not (run and run["active"])
    return OlympiadDetail(
        **dict(row),
        tasks=[OlympiadTaskOut.from_row(t, reveal=reveal, lang=lang, manage=manage) for t in tasks],
        can_manage=manage,
        ungraded_count=await conn.fetchval(q.UNGRADED_COUNT, row["id"]) if manage else None,
    )


# ---------- Публичные ----------


@router.get("", response_model=list[OlympiadOut])
async def list_olympiads(conn: Conn, viewer: OptionalUser, phase: Phase | None = None) -> list[OlympiadOut]:
    rows = await conn.fetch(q.LIST_PUBLISHED, phase, viewer.id if viewer else None)
    return [OlympiadOut(**dict(row)) for row in rows]


@router.get("/mine", response_model=list[OlympiadOut])
async def my_olympiads(teacher: Teacher, conn: Conn) -> list[OlympiadOut]:
    return [OlympiadOut(**dict(row)) for row in await conn.fetch(q.LIST_BY_ORGANIZER, teacher.id)]


@router.get("/{olympiad_id}", response_model=OlympiadDetail)
async def get_olympiad(olympiad_id: int, conn: Conn, viewer: OptionalUser, lang: RequestLang) -> OlympiadDetail:
    row = await _get(conn, olympiad_id, viewer)
    if not _visible(row, viewer):
        raise not_found("Олимпиада")
    return await _detail(conn, row, viewer, lang)


@router.post("/{olympiad_id}/register", response_model=OlympiadDetail)
async def register(olympiad_id: int, student: Student, conn: Conn) -> OlympiadDetail:
    row = await _get(conn, olympiad_id, student)
    if row["status"] != "published":
        raise not_found("Олимпиада")
    if row["phase"] not in ("upcoming", "running"):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Регистрация закрыта: олимпиада завершилась")
    await conn.execute(q.REGISTER, olympiad_id, student.id)
    return await _detail(conn, await _get(conn, olympiad_id, student), student)


@router.delete("/{olympiad_id}/register", status_code=status.HTTP_204_NO_CONTENT)
async def unregister(olympiad_id: int, student: Student, conn: Conn) -> None:
    row = await _get(conn, olympiad_id, student)
    if row["phase"] != "upcoming":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="После начала олимпиады отменить участие нельзя")
    await conn.execute(q.UNREGISTER, olympiad_id, student.id)


@router.post("/{olympiad_id}/tasks/{task_id}/submit", response_model=SubmissionOut)
async def submit(
    olympiad_id: int,
    task_id: int,
    student: Student,
    conn: Conn,
    settings: SettingsDep,
    image: Annotated[UploadFile, File(description="Фото решения — обязательно")],
    answer: Annotated[str, Form(max_length=500)] = "",
) -> SubmissionOut:
    row = await _get(conn, olympiad_id, student)
    if row["status"] != "published" or row["phase"] != "running":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Олимпиада сейчас не идёт — отправка закрыта")
    if not row["is_registered"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Сначала зарегистрируйтесь на олимпиаду")
    task = await conn.fetchrow(q.GET_TASK, task_id, olympiad_id)
    if task is None:
        raise not_found("Задача")
    if not image.filename:
        raise HTTPException(422, detail="Приложите фото решения")

    path = await save_image(
        image, upload_dir=settings.upload_dir, subdir="olympiads", max_bytes=settings.max_upload_bytes
    )
    answer = answer.strip()
    correct = (
        bool(answer)
        and check_answer(
            answer,
            expected=task["answer"],
            answer_type=task["answer_type"],
            unit=task["unit"],
            tolerance=task["tolerance"],
        ).correct
    )
    old_image = await conn.fetchval(q.GET_SUBMISSION_IMAGE, task_id, student.id)
    try:
        submission_id = await conn.fetchval(
            q.UPSERT_SUBMISSION,
            olympiad_id,
            task_id,
            student.id,
            answer,
            path,
            correct,
            task["max_points"] if correct else 0,
        )
    except Exception:
        delete_file(settings.upload_dir, path)
        raise
    delete_file(settings.upload_dir, old_image)
    saved = await conn.fetchrow(q.GET_SUBMISSION, submission_id, olympiad_id)
    return SubmissionOut.from_row(saved, reveal=False)


@router.get("/{olympiad_id}/my-submissions", response_model=list[SubmissionOut])
async def my_submissions(olympiad_id: int, user: User, conn: Conn) -> list[SubmissionOut]:
    row = await _get(conn, olympiad_id, user)
    rows = await conn.fetch(q.MY_SUBMISSIONS, olympiad_id, user.id)
    return [SubmissionOut.from_row(r, reveal=row["phase"] == "finished") for r in rows]


@router.get("/{olympiad_id}/results")
async def results(olympiad_id: int, conn: Conn, viewer: OptionalUser) -> dict[str, Any]:
    """Итоговая таблица. Всем — после публикации итогов, организатору и админу — в любой момент (предпросмотр)."""
    row = await _get(conn, olympiad_id, viewer)
    if not _visible(row, viewer):
        raise not_found("Олимпиада")
    if row["phase"] != "finished" and not _can_manage(row, viewer):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Итоги ещё не опубликованы")
    rows = await conn.fetch(q.RESULTS, olympiad_id)
    return {
        "max_score": row["max_score"],
        "published": row["results_published"],
        "rows": [
            {
                "place": r["place"],
                "user_id": r["user_id"],
                "username": r["username"],
                "name": r["name"],
                "avatar_url": public_url(r["avatar_path"]),
                "city": r["city"],
                "school": r["school"],
                "total": r["total"],
                "task_points": {int(k): v for k, v in json.loads(r["task_points"]).items()},
                # Дипломы I–III степени за первые три места (при ненулевом балле).
                "diploma": r["place"] if r["place"] <= 3 and r["total"] > 0 else None,
            }
            for r in rows
        ],
    }


# ---------- Организатор ----------


@router.post("", response_model=OlympiadDetail, status_code=status.HTTP_201_CREATED)
async def create(data: OlympiadIn, teacher: Teacher, conn: Conn) -> OlympiadDetail:
    if data.starts_at <= datetime.now(UTC):
        raise HTTPException(422, detail="Начало олимпиады должно быть в будущем")
    olympiad_id = await conn.fetchval(
        q.INSERT, data.title, data.description, data.subject_id, teacher.id, data.starts_at, data.ends_at
    )
    return await _detail(conn, await _get(conn, olympiad_id, teacher), teacher)


@router.put("/{olympiad_id}", response_model=OlympiadDetail)
async def update(olympiad_id: int, data: OlympiadIn, user: User, conn: Conn) -> OlympiadDetail:
    row = await _managed(conn, olympiad_id, user)
    _require_editable(row)
    if data.starts_at <= datetime.now(UTC):
        raise HTTPException(422, detail="Начало олимпиады должно быть в будущем")
    await conn.execute(
        q.UPDATE, olympiad_id, data.title, data.description, data.subject_id, data.starts_at, data.ends_at
    )
    return await _detail(conn, await _get(conn, olympiad_id, user), user)


@router.delete("/{olympiad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(olympiad_id: int, user: User, conn: Conn) -> None:
    row = await _managed(conn, olympiad_id, user)
    _require_editable(row)
    await conn.execute(q.DELETE, olympiad_id)


@router.post("/{olympiad_id}/tasks", response_model=OlympiadTaskOut, status_code=status.HTTP_201_CREATED)
async def add_task(olympiad_id: int, data: OlympiadTaskIn, user: User, conn: Conn) -> OlympiadTaskOut:
    _require_editable(await _managed(conn, olympiad_id, user))
    row = await conn.fetchrow(
        q.INSERT_TASK,
        olympiad_id,
        data.position,
        data.title,
        data.condition,
        data.answer_type,
        data.answer,
        data.unit,
        data.tolerance,
        data.max_points,
        clean_translations(data.translations),
    )
    return OlympiadTaskOut.from_row(row, reveal=True, manage=True)


@router.put("/{olympiad_id}/tasks/{task_id}", response_model=OlympiadTaskOut)
async def update_task(olympiad_id: int, task_id: int, data: OlympiadTaskIn, user: User, conn: Conn) -> OlympiadTaskOut:
    _require_editable(await _managed(conn, olympiad_id, user))
    row = await conn.fetchrow(
        q.UPDATE_TASK,
        task_id,
        olympiad_id,
        data.position,
        data.title,
        data.condition,
        data.answer_type,
        data.answer,
        data.unit,
        data.tolerance,
        data.max_points,
        clean_translations(data.translations),
    )
    if row is None:
        raise not_found("Задача")
    return OlympiadTaskOut.from_row(row, reveal=True, manage=True)


@router.delete("/{olympiad_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(olympiad_id: int, task_id: int, user: User, conn: Conn) -> None:
    _require_editable(await _managed(conn, olympiad_id, user))
    if await conn.fetchval(q.DELETE_TASK, task_id, olympiad_id) is None:
        raise not_found("Задача")


@router.post("/{olympiad_id}/submit-for-review", response_model=OlympiadDetail)
async def submit_for_review(olympiad_id: int, user: User, conn: Conn) -> OlympiadDetail:
    row = await _managed(conn, olympiad_id, user)
    _require_editable(row)
    if row["tasks_count"] == 0:
        raise HTTPException(422, detail="Добавьте хотя бы одну задачу")
    if row["starts_at"] <= datetime.now(UTC):
        raise HTTPException(422, detail="Время начала уже прошло — перенесите олимпиаду")
    await conn.execute(q.SUBMIT_FOR_REVIEW, olympiad_id)
    return await _detail(conn, await _get(conn, olympiad_id, user), user)


# ---------- Жюри ----------


@router.get("/{olympiad_id}/submissions", response_model=list[SubmissionOut])
async def jury_submissions(
    olympiad_id: int,
    user: User,
    conn: Conn,
    task_id: int | None = None,
    ungraded: bool = False,
) -> list[SubmissionOut]:
    await _managed(conn, olympiad_id, user)
    rows = await conn.fetch(q.JURY_SUBMISSIONS, olympiad_id, task_id, ungraded)
    return [SubmissionOut.from_row(r, reveal=True) for r in rows]


@router.post("/{olympiad_id}/submissions/{submission_id}/grade", response_model=SubmissionOut)
async def grade(olympiad_id: int, submission_id: int, data: GradeIn, user: User, conn: Conn) -> SubmissionOut:
    row = await _managed(conn, olympiad_id, user)
    if row["phase"] == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Итоги уже опубликованы")
    submission = await conn.fetchrow(q.GET_SUBMISSION, submission_id, olympiad_id)
    if submission is None:
        raise not_found("Решение")
    if data.points > submission["max_points"]:
        raise HTTPException(422, detail=f"Максимум за эту задачу — {submission['max_points']} баллов")
    await conn.execute(q.GRADE_SUBMISSION, submission_id, olympiad_id, data.points, data.comment.strip(), user.id)
    return SubmissionOut.from_row(await conn.fetchrow(q.GET_SUBMISSION, submission_id, olympiad_id), reveal=True)


@router.post("/{olympiad_id}/publish-results", response_model=OlympiadDetail)
async def publish_results(
    olympiad_id: int,
    user: User,
    conn: Conn,
    force: Annotated[bool, Query(description="Опубликовать, даже если не всё проверено жюри")] = False,
) -> OlympiadDetail:
    row = await _managed(conn, olympiad_id, user)
    if row["phase"] != "checking":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Итоги можно опубликовать только после окончания олимпиады"
        )
    ungraded = await conn.fetchval(q.UNGRADED_COUNT, olympiad_id)
    if ungraded and not force:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Жюри ещё не проверило {ungraded} решений")
    await conn.execute(q.PUBLISH_RESULTS, olympiad_id)
    return await _detail(conn, await _get(conn, olympiad_id, user), user)


# ---------- Архив: виртуальное участие ----------


async def _finished_for_virtual(conn: asyncpg.Connection, olympiad_id: int, user: CurrentUser) -> asyncpg.Record:
    row = await _get(conn, olympiad_id, user)
    if row["status"] != "published":
        raise not_found("Олимпиада")
    if row["phase"] != "finished":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Виртуально можно решать только олимпиады с опубликованными итогами"
        )
    return row


async def _run_out(conn: asyncpg.Connection, olympiad: asyncpg.Record, run: asyncpg.Record) -> VirtualRunOut:
    rows = await conn.fetch(q.RUN_SUBMISSIONS, run["id"])
    finished = not run["active"]
    submissions = [
        VirtualSubmissionOut(
            **{
                **dict(r),
                "correct": r["correct"] if finished else None,
                "points": r["points"] if finished else None,
                "correct_answer": r["correct_answer"] if finished else None,
            }
        )
        for r in rows
    ]
    total = sum(r["points"] for r in rows) if finished else None
    official = await conn.fetch(q.RESULTS, olympiad["id"])
    return VirtualRunOut(
        started_at=run["started_at"],
        ends_at=run["ends_at"],
        active=run["active"],
        submissions=submissions,
        total=total,
        max_score=olympiad["max_score"],
        would_place=await conn.fetchval(q.WOULD_PLACE, olympiad["id"], total) if total is not None else None,
        official_participants=len(official),
    )


@router.get("/{olympiad_id}/virtual", response_model=VirtualRunOut | None)
async def my_virtual_run(olympiad_id: int, user: User, conn: Conn) -> VirtualRunOut | None:
    olympiad = await _get(conn, olympiad_id, user)
    run = await conn.fetchrow(q.GET_RUN, olympiad_id, user.id)
    return await _run_out(conn, olympiad, run) if run else None


@router.post("/{olympiad_id}/virtual", response_model=VirtualRunOut, status_code=status.HTTP_201_CREATED)
async def start_virtual(olympiad_id: int, user: User, conn: Conn) -> VirtualRunOut:
    """Начать виртуальное участие: личный таймер той же длительности, что у официальной олимпиады."""
    olympiad = await _finished_for_virtual(conn, olympiad_id, user)
    if _can_manage(olympiad, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Организатор не может участвовать в своей олимпиаде")
    if olympiad["is_registered"]:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Вы участвовали в этой олимпиаде официально")
    duration = olympiad["ends_at"] - olympiad["starts_at"]
    if await conn.fetchval(q.START_RUN, olympiad_id, user.id, duration) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Вы уже участвовали в этой олимпиаде виртуально")
    return await _run_out(conn, olympiad, await conn.fetchrow(q.GET_RUN, olympiad_id, user.id))


@router.post("/{olympiad_id}/virtual/tasks/{task_id}", response_model=VirtualRunOut)
async def submit_virtual(
    olympiad_id: int, task_id: int, data: VirtualAnswerIn, user: User, conn: Conn
) -> VirtualRunOut:
    """Ответ без фото. Проверяется автоматически, результат виден после окончания личного времени."""
    olympiad = await _finished_for_virtual(conn, olympiad_id, user)
    run = await conn.fetchrow(q.GET_RUN, olympiad_id, user.id)
    if run is None or not run["active"]:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Виртуальное участие не идёт")
    task = await conn.fetchrow(q.GET_TASK, task_id, olympiad_id)
    if task is None:
        raise not_found("Задача")
    answer = data.answer.strip()
    correct = check_answer(
        answer, expected=task["answer"], answer_type=task["answer_type"], unit=task["unit"], tolerance=task["tolerance"]
    ).correct
    await conn.execute(
        q.UPSERT_VIRTUAL_SUBMISSION, run["id"], task_id, answer, correct, task["max_points"] if correct else 0
    )
    return await _run_out(conn, olympiad, await conn.fetchrow(q.GET_RUN, olympiad_id, user.id))


@router.post("/{olympiad_id}/virtual/finish", response_model=VirtualRunOut)
async def finish_virtual(olympiad_id: int, user: User, conn: Conn) -> VirtualRunOut:
    olympiad = await _get(conn, olympiad_id, user)
    run = await conn.fetchrow(q.GET_RUN, olympiad_id, user.id)
    if run is None:
        raise not_found("Виртуальное участие")
    await conn.execute(q.FINISH_RUN, run["id"])
    return await _run_out(conn, olympiad, await conn.fetchrow(q.GET_RUN, olympiad_id, user.id))


@router.get("/{olympiad_id}/virtual/standings")
async def virtual_standings(olympiad_id: int, conn: Conn, viewer: OptionalUser) -> list[dict[str, Any]]:
    """Таблица виртуальных участников (отдельно от официальной) с местом, которое они заняли бы."""
    row = await _get(conn, olympiad_id, viewer)
    if row["status"] != "published" or row["phase"] != "finished":
        raise not_found("Олимпиада")
    return [
        {**{k: v for k, v in dict(r).items() if k != "avatar_path"}, "avatar_url": public_url(r["avatar_path"])}
        for r in await conn.fetch(q.VIRTUAL_STANDINGS, olympiad_id)
    ]
