"""Олимпиады.

Жизненный цикл: черновик (учитель) → на проверке → опубликована админом → идёт в общем окне →
проверка жюри → итоги опубликованы. Фото решения обязательно; балл = оценка жюри, а без неё — автопроверка.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.deps import Conn, CurrentUser, OptionalUser, SettingsDep, User, not_found, require_roles
from app.i18n import DEFAULT_LANG, Lang, RequestLang, clean_translations
from app.modules.olympiads import corrections, photos
from app.modules.olympiads import queries as q
from app.modules.olympiads.schemas import (
    AnnouncementIn,
    EditorialIn,
    GradeIn,
    JuryMemberIn,
    LevelOut,
    OlympiadDetail,
    OlympiadIn,
    OlympiadOut,
    OlympiadTaskIn,
    OlympiadTaskOut,
    Phase,
    SubmissionOut,
    VirtualAnswerIn,
    VirtualRunOut,
    VirtualStartIn,
    VirtualSubmissionOut,
)
from app.modules.rating import queries as rating_q
from app.modules.rating import service as rating
from app.modules.settings import service as settings_service
from app.modules.solutions.checker import check_answer
from app.modules.telegram import notify
from app.storage import delete_file, public_url, save_image

router = APIRouter(prefix="/olympiads", tags=["olympiads"])

Teacher = Annotated[CurrentUser, Depends(require_roles("teacher"))]
Participant = Annotated[CurrentUser, Depends(require_roles("student", "teacher"))]


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


async def _check_level(conn: asyncpg.Connection, data: OlympiadIn) -> None:
    """Уровень существует, а длительность не больше предела уровня (или общего предела из настроек)."""
    level = None
    if data.level_id is not None:
        level = await conn.fetchrow(q.GET_LEVEL, data.level_id)
        if level is None:
            raise HTTPException(422, detail="Такого уровня олимпиады нет")
    limit = (level and level["max_duration_minutes"]) or (
        await settings_service.load(conn)
    ).olympiad_max_duration_minutes
    minutes = (data.ends_at - data.starts_at).total_seconds() / 60
    if minutes > limit:
        where = f"уровня «{level['title']}»" if level else "без уровня"
        raise HTTPException(422, detail=f"Олимпиада {where} длится не дольше {_duration(limit)}")


def _duration(minutes: int) -> str:
    hours, rest = divmod(minutes, 60)
    if not hours:
        return f"{rest} мин"
    return f"{hours} ч" + (f" {rest} мин" if rest else "")


def _can_judge(row: asyncpg.Record, user: CurrentUser | None) -> bool:
    """Проверять решения и делать объявления могут организатор, админ и приглашённое жюри."""
    return _can_manage(row, user) or bool(row["is_jury"])


async def _judged(conn: asyncpg.Connection, olympiad_id: int, user: CurrentUser) -> asyncpg.Record:
    row = await _get(conn, olympiad_id, user)
    if not _can_judge(row, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Проверять решения могут только организатор и жюри")
    return row


def _check_can_participate(row: asyncpg.Record, user: CurrentUser) -> None:
    """Участвовать могут ученики и учителя — кроме автора олимпиады и её жюри."""
    if row["organizer_id"] == user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Автор не может участвовать в своей олимпиаде")
    if row["is_jury"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Вы в жюри этой олимпиады — участвовать нельзя")


def _require_editable(row: asyncpg.Record) -> None:
    if row["status"] not in ("draft", "rejected"):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Олимпиаду на проверке или опубликованную изменить нельзя")


async def _detail(
    conn: asyncpg.Connection, row: asyncpg.Record, viewer: CurrentUser | None, lang: Lang = DEFAULT_LANG
) -> OlympiadDetail:
    manage = _can_manage(row, viewer)
    judge = _can_judge(row, viewer)
    phase: Phase = row["phase"]
    # Условия видны организатору и жюри всегда, участникам — с начала олимпиады, всем — после итогов.
    show_tasks = judge or phase == "finished" or (phase in ("running", "checking") and row["is_registered"])
    tasks = await conn.fetch(q.LIST_TASKS, row["id"]) if show_tasks else []
    reveal = judge or phase == "finished"
    if reveal and not judge and viewer is not None:
        # Пока идёт (или вот-вот начнётся) виртуальное участие, источник и сложность скрыты.
        run = await conn.fetchrow(q.GET_RUN, row["id"], viewer.id)
        reveal = not (run and (run["active"] or run["scheduled"]))
    return OlympiadDetail(
        **dict(row),
        # Правильный ответ видят только организатор и жюри — ученикам никогда (разбор — да).
        tasks=[OlympiadTaskOut.from_row(t, reveal=reveal, lang=lang, manage=manage, show_answer=judge) for t in tasks],
        can_manage=manage,
        ungraded_count=await conn.fetchval(q.UNGRADED_COUNT, row["id"]) if judge else None,
    )


# ---------- Публичные ----------


@router.get("", response_model=list[OlympiadOut])
async def list_olympiads(
    conn: Conn, viewer: OptionalUser, phase: Phase | None = None, level_id: int | None = None
) -> list[OlympiadOut]:
    rows = await conn.fetch(q.LIST_PUBLISHED, phase, viewer.id if viewer else None, level_id)
    return [OlympiadOut(**dict(row)) for row in rows]


ArchiveSort = Literal["new", "old", "difficulty_asc", "difficulty_desc", "solved_desc", "solved_asc"]


@router.get("/problems")
async def problems_archive(
    conn: Conn,
    viewer: OptionalUser,
    lang: RequestLang,
    subject_id: int | None = None,
    level_id: int | None = None,
    olympiad_id: int | None = None,
    difficulty_min: Annotated[int | None, Query(ge=0)] = None,
    difficulty_max: Annotated[int | None, Query(ge=0)] = None,
    q_: Annotated[str | None, Query(alias="q", max_length=100)] = None,
    progress: Literal["solved", "unsolved", "tried"] | None = None,
    sort: ArchiveSort = "new",
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, Any]:
    """Архив задач олимпиад, прошедших на платформе: фильтры, сортировки и статистика решаемости."""
    search = " ".join(q_.split()) if q_ else None
    rows = await conn.fetch(
        q.ARCHIVE,
        viewer.id if viewer else None,
        subject_id,
        level_id,
        difficulty_min,
        difficulty_max,
        search or None,
        progress if viewer else None,
        sort,
        limit,
        offset,
        olympiad_id,
    )
    items = []
    for r in rows:
        data = dict(r)
        title = (_json(data.pop("translations")).get(lang) or {}).get("title") if lang != DEFAULT_LANG else None
        best = max((p for p in (data["my_points"], data["my_virtual_points"]) if p is not None), default=None)
        items.append(
            {
                **{k: v for k, v in data.items() if k not in ("total", "solved_ratio")},
                "title": title or data["title"],
                "label": _label(data["num"] - 1),
                "source_author": data["source_author"] or "",
                "source_type": data["source_type"] or ("own" if data["is_original"] else None),
                "my_best": best,
            }
        )
    return {"total": rows[0]["total"] if rows else 0, "items": items}


@router.get("/levels", response_model=list[LevelOut])
async def list_levels(conn: Conn) -> list[LevelOut]:
    """Уровни олимпиад (до 5 класса, 5–8, 9–11…) — задаёт администратор."""
    return [LevelOut(**dict(row)) for row in await conn.fetch(q.LIST_LEVELS)]


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
async def register(olympiad_id: int, student: Participant, conn: Conn) -> OlympiadDetail:
    row = await _get(conn, olympiad_id, student)
    _check_can_participate(row, student)
    if row["status"] != "published":
        raise not_found("Олимпиада")
    if row["phase"] not in ("upcoming", "running"):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Регистрация закрыта: олимпиада завершилась")
    # Рейтинг выше уровня олимпиады — участие вне конкурса (как на Codeforces). Без рейтинга — всегда официально.
    current = (await rating.current_ratings(conn, [student.id])).get(student.id)
    official = current is None or row["level_max_rating"] is None or current < row["level_max_rating"]
    await conn.execute(q.REGISTER, olympiad_id, student.id, official, current)
    return await _detail(conn, await _get(conn, olympiad_id, student), student)


@router.delete("/{olympiad_id}/register", status_code=status.HTTP_204_NO_CONTENT)
async def unregister(olympiad_id: int, student: Participant, conn: Conn) -> None:
    row = await _get(conn, olympiad_id, student)
    if row["phase"] != "upcoming":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="После начала олимпиады отменить участие нельзя")
    await conn.execute(q.UNREGISTER, olympiad_id, student.id)


@router.post("/{olympiad_id}/tasks/{task_id}/submit", response_model=SubmissionOut)
async def submit(
    olympiad_id: int,
    task_id: int,
    student: Participant,
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
    # Проверка на списывание: то же фото уже прислал другой участник — попытка не засчитывается.
    print_ = photos.fingerprint((settings.upload_dir / path).read_bytes())
    for other in await conn.fetch(q.OTHER_PHOTOS, olympiad_id, student.id):
        if photos.same_photo(print_, other["image_sha256"], other["image_phash"]):
            await conn.execute(
                q.INSERT_HISTORY,
                olympiad_id,
                task_id,
                student.id,
                answer,
                correct,
                path,
                print_.sha256,
                print_.phash,
                True,
                other["user_id"],
            )
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Это фото уже отправлял другой участник — отправка не засчитана. "
                "Сфотографируйте своё решение. Если это ошибка, напишите организатору.",
            )
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
    # Старое фото не удаляем: все попытки с фото видят сам участник и админ.
    await conn.execute(
        q.INSERT_HISTORY,
        olympiad_id,
        task_id,
        student.id,
        answer,
        correct,
        path,
        print_.sha256,
        print_.phash,
        False,
        None,
    )
    saved = await conn.fetchrow(q.GET_SUBMISSION, submission_id, olympiad_id)
    return SubmissionOut.from_row(saved, reveal=False)


@router.get("/{olympiad_id}/my-submissions", response_model=list[SubmissionOut])
async def my_submissions(olympiad_id: int, user: User, conn: Conn) -> list[SubmissionOut]:
    row = await _get(conn, olympiad_id, user)
    rows = await conn.fetch(q.MY_SUBMISSIONS, olympiad_id, user.id)
    return [SubmissionOut.from_row(r, reveal=row["phase"] == "finished", show_answer=False) for r in rows]


@router.get("/{olympiad_id}/my-history")
async def my_history(olympiad_id: int, user: User, conn: Conn) -> list[dict]:
    """Все отправки участника с фото, как «Мои посылки» на Codeforces. Вердикт автопроверки — только после итогов."""
    row = await _get(conn, olympiad_id, user)
    rows = await conn.fetch(q.HISTORY, olympiad_id, user.id, None, False)
    return [_history_item(r, reveal=row["phase"] == "finished") for r in rows]


def _history_item(r: asyncpg.Record, *, reveal: bool, who: bool = False) -> dict[str, Any]:
    item = {
        "id": r["id"],
        "task_id": r["task_id"],
        "answer": r["answer"],
        "submitted_at": r["submitted_at"],
        "current": r["current"],
        "rejected": r["rejected"],
        "image_url": public_url(r["image_path"]),
        "auto_correct": r["auto_correct"] if reveal else None,
    }
    if who:
        item |= {
            "user_id": r["user_id"],
            "username": r["username"],
            "user_name": r["user_name"],
            "matched_user_id": r["matched_user_id"],
            "matched_username": r["matched_username"],
            "matched_name": r["matched_name"],
        }
    return item


@router.get("/{olympiad_id}/attempts")
async def all_attempts(
    olympiad_id: int,
    user: User,
    conn: Conn,
    user_id: int | None = None,
    task_id: int | None = None,
    rejected: bool = False,
) -> list[dict]:
    """Все попытки участников. Целиком — только админ; организатор и жюри видят лишь отклонённые
    (подозрение на списывание). Жюри проверяет только последнюю попытку (/submissions) — предыдущие ему не показываются.
    """
    await _judged(conn, olympiad_id, user)
    if not user.is_admin and not rejected:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Все попытки видит только администратор")
    rows = await conn.fetch(q.HISTORY, olympiad_id, user_id, task_id, rejected)
    return [_history_item(r, reveal=True, who=True) for r in rows]


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
                "official": r["official"],
                "user_id": r["user_id"],
                "username": r["username"],
                "name": r["name"],
                "avatar_url": public_url(r["avatar_path"]),
                "city": r["city"],
                "school": r["school"],
                "country_code": r["country_code"],
                "total": r["total"],
                "penalty": r["penalty"],
                "task_points": {int(k): v for k, v in json.loads(r["task_points"]).items()},
                # Дипломы I–III степени за первые три места (при ненулевом балле); вне конкурса — без диплома.
                "diploma": r["place"] if r["place"] is not None and r["place"] <= 3 and r["total"] > 0 else None,
            }
            for r in rows
        ],
    }


@router.get("/{olympiad_id}/standings")
async def standings(olympiad_id: int, conn: Conn, viewer: OptionalUser) -> dict[str, Any]:
    """Живая таблица, как на Codeforces: видна всем с начала олимпиады.

    Места: больше баллов — выше; при равенстве выше тот, кто быстрее (меньше штраф в минутах).
    Пока жюри не проверило решение, в клетке балл автопроверки (graded=false) — таблица предварительная.
    """
    row = await _get(conn, olympiad_id, viewer)
    if row["status"] != "published" and not _can_manage(row, viewer):
        raise not_found("Олимпиада")
    if row["phase"] == "upcoming":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Олимпиада ещё не началась")
    tasks = await conn.fetch(q.LIST_TASKS, olympiad_id)
    rows = await conn.fetch(q.RESULTS, olympiad_id)
    cells = [{int(k): v for k, v in json.loads(r["cells"]).items()} for r in rows]
    badges = await rating.badges_for(conn, [r["user_id"] for r in rows])
    # После публикации итогов — изменение рейтинга, как в таблице Codeforces.
    changes = {c["user_id"]: c for c in await conn.fetch(rating_q.OLYMPIAD_CHANGES, olympiad_id)}
    return {
        "rated": bool(changes),
        "phase": row["phase"],
        "starts_at": row["starts_at"],
        "max_score": row["max_score"],
        # Окончательная — только после публикации итогов; до этого баллы могут измениться после проверки жюри.
        "provisional": row["phase"] != "finished",
        "tasks": [
            {"id": t["id"], "label": chr(ord("A") + i) if i < 26 else str(i + 1), "max_points": t["max_points"]}
            for i, t in enumerate(tasks)
        ],
        "rows": [
            {
                "place": r["place"],
                "official": r["official"],
                "user_id": r["user_id"],
                "username": r["username"],
                "name": r["name"],
                "avatar_url": public_url(r["avatar_path"]),
                "school": r["school"],
                "city": r["city"],
                "country_code": r["country_code"],
                "total": r["total"],
                "penalty": r["penalty"],
                "cells": cell,
                "title": badges.get(r["user_id"]),
                "rating_change": (
                    {"old": changes[r["user_id"]]["old_rating"], "new": changes[r["user_id"]]["new_rating"]}
                    if r["user_id"] in changes
                    else None
                ),
            }
            for r, cell in zip(rows, cells, strict=True)
        ],
    }


# ---------- Организатор ----------


@router.post("", response_model=OlympiadDetail, status_code=status.HTTP_201_CREATED)
async def create(data: OlympiadIn, teacher: Teacher, conn: Conn) -> OlympiadDetail:
    if data.starts_at <= datetime.now(UTC):
        raise HTTPException(422, detail="Начало олимпиады должно быть в будущем")
    await _check_level(conn, data)
    olympiad_id = await conn.fetchval(
        q.INSERT, data.title, data.description, data.subject_id, teacher.id, data.starts_at, data.ends_at, data.level_id
    )
    return await _detail(conn, await _get(conn, olympiad_id, teacher), teacher)


@router.put("/{olympiad_id}", response_model=OlympiadDetail)
async def update(olympiad_id: int, data: OlympiadIn, user: User, conn: Conn) -> OlympiadDetail:
    row = await _managed(conn, olympiad_id, user)
    # Админ может править любую олимпиаду в любой момент (например, исправить время или название).
    if not user.is_admin:
        _require_editable(row)
        if data.starts_at <= datetime.now(UTC):
            raise HTTPException(422, detail="Начало олимпиады должно быть в будущем")
    await _check_level(conn, data)
    await conn.execute(
        q.UPDATE,
        olympiad_id,
        data.title,
        data.description,
        data.subject_id,
        data.starts_at,
        data.ends_at,
        data.level_id,
    )
    return await _detail(conn, await _get(conn, olympiad_id, user), user)


@router.delete("/{olympiad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(olympiad_id: int, user: User, conn: Conn) -> None:
    row = await _managed(conn, olympiad_id, user)
    _require_editable(row)
    await conn.execute(q.DELETE, olympiad_id)


def _task_args(data: OlympiadTaskIn) -> tuple[Any, ...]:
    return (
        data.position,
        data.title,
        data.condition,
        data.answer_type,
        data.answer,
        data.unit,
        data.tolerance,
        data.max_points,
        clean_translations(data.translations),
        data.difficulty,
        None if data.is_original else data.source_id,
        None if data.is_original or data.source_id is None else data.source_number,
        data.is_original,
    )


def _require_tasks_editable(row: asyncpg.Record, user: CurrentUser) -> None:
    """Добавлять и удалять задачи: автор — в черновике, админ — пока олимпиада не началась."""
    if user.is_admin and row["phase"] == "upcoming":
        return
    _require_editable(row)


@router.post("/{olympiad_id}/tasks", response_model=OlympiadTaskOut, status_code=status.HTTP_201_CREATED)
async def add_task(olympiad_id: int, data: OlympiadTaskIn, user: User, conn: Conn) -> OlympiadTaskOut:
    _require_tasks_editable(await _managed(conn, olympiad_id, user), user)
    task_id = await conn.fetchval(q.INSERT_TASK, olympiad_id, *_task_args(data))
    return OlympiadTaskOut.from_row(await conn.fetchrow(q.GET_TASK, task_id, olympiad_id), reveal=True, manage=True)


@router.put("/{olympiad_id}/tasks/{task_id}", response_model=OlympiadTaskOut)
async def update_task(olympiad_id: int, task_id: int, data: OlympiadTaskIn, user: User, conn: Conn) -> OlympiadTaskOut:
    """Черновик правится свободно. Опубликованную олимпиаду можно исправлять до публикации итогов:
    во время олимпиады и проверки участникам приходит объявление — что именно исправлено (как на Codeforces),
    а при исправлении ответа автопроверка пересчитывается.
    """
    row = await _managed(conn, olympiad_id, user)
    correcting = row["status"] == "published"
    if correcting and row["phase"] == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Итоги опубликованы — задачу изменить нельзя")
    if not correcting:
        _require_editable(row)
    old = await conn.fetchrow(q.GET_TASK, task_id, olympiad_id)
    if old is None:
        raise not_found("Задача")
    async with conn.transaction():
        await conn.execute(q.UPDATE_TASK, task_id, olympiad_id, *_task_args(data))
        new = await conn.fetchrow(q.GET_TASK, task_id, olympiad_id)
        if correcting and row["phase"] in ("running", "checking"):
            await _announce_correction(conn, row, old, new, user)
    return OlympiadTaskOut.from_row(new, reveal=True, manage=True)


async def _announce_correction(
    conn: asyncpg.Connection, olympiad: asyncpg.Record, old: asyncpg.Record, new: asyncpg.Record, user: CurrentUser
) -> None:
    as_dict = {**dict(new), "translations": _json(new["translations"])}
    old_dict = {**dict(old), "translations": _json(old["translations"])}
    found = corrections.changes(old_dict, as_dict)
    if not found:
        return
    if any(item["field"] == "answer" for item in found) or old["max_points"] != new["max_points"]:
        for sub in await conn.fetch(q.TASK_SUBMISSIONS, new["id"]):
            correct = (
                bool(sub["answer"])
                and check_answer(
                    sub["answer"],
                    expected=new["answer"],
                    answer_type=new["answer_type"],
                    unit=new["unit"],
                    tolerance=new["tolerance"],
                ).correct
            )
            await conn.execute(q.REJUDGE, sub["id"], correct, new["max_points"] if correct else 0)
    ids = [t["id"] for t in await conn.fetch(q.LIST_TASKS, olympiad["id"])]
    label = _label(ids.index(new["id"]))
    text = corrections.summary(label, new["title"], found)
    announcement = await conn.fetchrow(
        q.INSERT_ANNOUNCEMENT, olympiad["id"], new["id"], text, json.dumps(found, ensure_ascii=False), user.id
    )
    await notify.olympiad_announcement(conn, olympiad, announcement["id"], text)


def _label(index: int) -> str:
    return chr(ord("A") + index) if index < 26 else str(index + 1)


def _json(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str) else (value or {})


def _announcement_out(row: asyncpg.Record) -> dict[str, Any]:
    return {**dict(row), "changes": json.loads(row["changes"])}


@router.get("/{olympiad_id}/editorial")
async def editorial(olympiad_id: int, conn: Conn, viewer: OptionalUser, lang: RequestLang) -> dict[str, Any]:
    """Разбор: организатору — всегда (для редактирования), остальным — через сутки после окончания олимпиады."""
    row = await _get(conn, olympiad_id, viewer)
    if not _visible(row, viewer):
        raise not_found("Олимпиада")
    manage = _can_manage(row, viewer)
    judge = _can_judge(row, viewer)
    if not judge:
        if row["status"] != "published" or datetime.now(UTC) < row["editorial_at"]:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Разбор откроется через сутки после окончания")
        if viewer is not None:
            run = await conn.fetchrow(q.GET_RUN, olympiad_id, viewer.id)
            if run and (run["active"] or run["scheduled"]):
                raise HTTPException(
                    status.HTTP_409_CONFLICT, detail="Разбор откроется, когда закончится ваше виртуальное участие"
                )
    tasks = await conn.fetch(q.EDITORIAL_TASKS, olympiad_id)
    return {
        "available_at": row["editorial_at"],
        "text": await conn.fetchval(q.GET_EDITORIAL, olympiad_id),
        "tasks": [
            {
                "id": t["id"],
                "label": _label(i),
                "title": (None if manage else (_json(t["translations"]).get(lang) or {}).get("title")) or t["title"],
                "answer": t["answer"] if judge else None,
                "unit": t["unit"],
                "max_points": t["max_points"],
                "solution": t["solution"],
            }
            for i, t in enumerate(tasks)
        ],
    }


@router.put("/{olympiad_id}/editorial")
async def save_editorial(olympiad_id: int, data: EditorialIn, user: User, conn: Conn) -> dict[str, Any]:
    """Организатор пишет разбор в любой момент — участникам он откроется через сутки после окончания."""
    await _managed(conn, olympiad_id, user)
    task_ids = {t["id"] for t in await conn.fetch(q.EDITORIAL_TASKS, olympiad_id)}
    if set(data.solutions) - task_ids:
        raise HTTPException(422, detail="В разборе есть задачи не из этой олимпиады")
    async with conn.transaction():
        await conn.execute(q.SET_EDITORIAL, olympiad_id, data.text.strip())
        for task_id, text in data.solutions.items():
            await conn.execute(q.SET_SOLUTION, olympiad_id, task_id, text)
    return {"saved": True}


@router.get("/{olympiad_id}/announcements")
async def announcements(olympiad_id: int, conn: Conn, viewer: OptionalUser) -> list[dict[str, Any]]:
    """Объявления жюри и исправления условий — новые сверху."""
    row = await _get(conn, olympiad_id, viewer)
    if not _visible(row, viewer):
        raise not_found("Олимпиада")
    if row["phase"] == "upcoming" and not _can_manage(row, viewer):
        return []
    return [_announcement_out(r) for r in await conn.fetch(q.LIST_ANNOUNCEMENTS, olympiad_id)]


@router.post("/{olympiad_id}/announcements", status_code=status.HTTP_201_CREATED)
async def announce(olympiad_id: int, data: AnnouncementIn, user: User, conn: Conn) -> dict[str, Any]:
    """Сообщение жюри всем участникам (во время олимпиады или проверки), приходит и в Telegram."""
    row = await _judged(conn, olympiad_id, user)
    if row["status"] != "published" or row["phase"] not in ("running", "checking"):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Объявления — только во время олимпиады и проверки")
    created = await conn.fetchrow(q.INSERT_ANNOUNCEMENT, olympiad_id, data.task_id, data.text, "[]", user.id)
    await notify.olympiad_announcement(conn, row, created["id"], data.text)
    return _announcement_out(created)


@router.delete("/{olympiad_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(olympiad_id: int, task_id: int, user: User, conn: Conn) -> None:
    _require_tasks_editable(await _managed(conn, olympiad_id, user), user)
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
    await _judged(conn, olympiad_id, user)
    rows = await conn.fetch(q.JURY_SUBMISSIONS, olympiad_id, task_id, ungraded)
    return [SubmissionOut.from_row(r, reveal=True) for r in rows]


@router.post("/{olympiad_id}/submissions/{submission_id}/grade", response_model=SubmissionOut)
async def grade(olympiad_id: int, submission_id: int, data: GradeIn, user: User, conn: Conn) -> SubmissionOut:
    row = await _judged(conn, olympiad_id, user)
    if row["phase"] == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Итоги уже опубликованы")
    submission = await conn.fetchrow(q.GET_SUBMISSION, submission_id, olympiad_id)
    if submission is None:
        raise not_found("Решение")
    if data.points > submission["max_points"]:
        raise HTTPException(422, detail=f"Максимум за эту задачу — {submission['max_points']} баллов")
    await conn.execute(q.GRADE_SUBMISSION, submission_id, olympiad_id, data.points, data.comment.strip(), user.id)
    return SubmissionOut.from_row(await conn.fetchrow(q.GET_SUBMISSION, submission_id, olympiad_id), reveal=True)


@router.get("/{olympiad_id}/jury-members")
async def jury_members(olympiad_id: int, user: User, conn: Conn) -> list[dict[str, Any]]:
    await _judged(conn, olympiad_id, user)
    return [
        {**{k: v for k, v in dict(r).items() if k != "avatar_path"}, "avatar_url": public_url(r["avatar_path"])}
        for r in await conn.fetch(q.JURY_MEMBERS, olympiad_id)
    ]


@router.get("/{olympiad_id}/jury-candidates")
async def jury_candidates(olympiad_id: int, user: User, conn: Conn, q_: Annotated[str | None, Query(alias="q")] = None):
    """Учителя для выпадающего списка «Пригласить в жюри»: ФИО, логин и предметы, по которым у них есть задачи."""
    row = await _managed(conn, olympiad_id, user)
    search = " ".join(q_.split()) if q_ else None
    rows = await conn.fetch(q.JURY_CANDIDATES, olympiad_id, row["organizer_id"], search or None)
    return [
        {**{k: v for k, v in dict(r).items() if k != "avatar_path"}, "avatar_url": public_url(r["avatar_path"])}
        for r in rows
    ]


@router.post("/{olympiad_id}/jury-members", status_code=status.HTTP_201_CREATED)
async def add_jury_member(olympiad_id: int, data: JuryMemberIn, user: User, conn: Conn) -> list[dict[str, Any]]:
    """Организатор приглашает учителя в жюри. Членом жюри он станет, когда примет приглашение."""
    row = await _managed(conn, olympiad_id, user)
    if row["phase"] == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Итоги опубликованы — состав жюри не меняется")
    if data.user_id is not None:
        member = await conn.fetchrow(q.GET_USER_BRIEF, data.user_id)
    else:
        member = await conn.fetchrow(q.FIND_TEACHER, (data.username or "").strip().lstrip("@"))
    if member is None or member["role"] != "teacher":
        raise HTTPException(422, detail="Учитель не найден")
    if member["id"] == row["organizer_id"]:
        raise HTTPException(422, detail="Организатор и так проверяет решения")
    if await conn.fetchval(q.IS_REGISTERED, olympiad_id, member["id"]):
        raise HTTPException(409, detail="Этот учитель участвует в олимпиаде — в жюри его добавить нельзя")
    if await conn.fetchval(q.ADD_JURY, olympiad_id, member["id"], user.id) is not None:
        await notify.jury_invitation(conn, row, member["id"])
    return await jury_members(olympiad_id, user, conn)


@router.get("/jury-invitations/mine")
async def my_jury_invitations(user: User, conn: Conn) -> list[dict[str, Any]]:
    """Приглашения в жюри, ждущие ответа, — показываются учителю в «Моих олимпиадах» и в кабинете."""
    return [dict(r) for r in await conn.fetch(q.MY_JURY_INVITATIONS, user.id)]


@router.post("/{olympiad_id}/jury-invitation/accept", response_model=OlympiadDetail)
async def accept_jury(olympiad_id: int, user: User, conn: Conn) -> OlympiadDetail:
    if await conn.fetchval(q.IS_REGISTERED, olympiad_id, user.id):
        raise HTTPException(409, detail="Вы участник этой олимпиады — в жюри быть нельзя")
    if await conn.fetchval(q.ACCEPT_JURY, olympiad_id, user.id) is None:
        raise not_found("Приглашение")
    return await _detail(conn, await _get(conn, olympiad_id, user), user)


@router.post("/{olympiad_id}/jury-invitation/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_jury(olympiad_id: int, user: User, conn: Conn) -> None:
    if await conn.fetchval(q.DECLINE_JURY, olympiad_id, user.id) is None:
        raise not_found("Приглашение")


@router.delete("/{olympiad_id}/jury-members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_jury_member(olympiad_id: int, member_id: int, user: User, conn: Conn) -> None:
    await _managed(conn, olympiad_id, user)
    if await conn.fetchval(q.REMOVE_JURY, olympiad_id, member_id) is None:
        raise not_found("Член жюри")


@router.post("/{olympiad_id}/finish", response_model=OlympiadDetail)
async def finish_early(olympiad_id: int, user: User, conn: Conn) -> OlympiadDetail:
    """Досрочно завершить идущую олимпиаду (организатор или админ): отправка закрывается, начинается проверка."""
    row = await _managed(conn, olympiad_id, user)
    if row["phase"] != "running" or await conn.fetchval(q.FINISH_EARLY, olympiad_id) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Завершить досрочно можно только идущую олимпиаду")
    return await _detail(conn, await _get(conn, olympiad_id, user), user)


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
    await rating.apply_pending(conn)
    await notify.olympiad_results(conn, row, await conn.fetch(q.RESULTS, olympiad_id))
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
    finished = not run["active"] and not run["scheduled"]
    submissions = [
        VirtualSubmissionOut(
            **{
                **dict(r),
                "correct": r["correct"] if finished else None,
                "points": r["points"] if finished else None,
                "correct_answer": None,  # правильный ответ ученикам не показываем
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
        scheduled=run["scheduled"],
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
async def start_virtual(olympiad_id: int, user: User, conn: Conn, data: VirtualStartIn | None = None) -> VirtualRunOut:
    """Начать виртуальное участие: личный таймер той же длительности, что у официальной олимпиады.

    Старт можно отложить на delay_minutes (не больше предела из настроек администратора, максимум час).
    """
    delay = data.delay_minutes if data else 0
    limit = (await settings_service.load(conn)).virtual_start_max_minutes
    if delay > limit:
        raise HTTPException(422, detail=f"Отложить старт можно не больше чем на {limit} мин")
    olympiad = await _finished_for_virtual(conn, olympiad_id, user)
    if _can_manage(olympiad, user) or olympiad["is_jury"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Организатор и жюри не участвуют в этой олимпиаде")
    if olympiad["is_registered"]:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Вы участвовали в этой олимпиаде официально")
    duration = olympiad["ends_at"] - olympiad["starts_at"]
    if await conn.fetchval(q.START_RUN, olympiad_id, user.id, duration, timedelta(minutes=delay)) is None:
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
        detail = "Виртуальное участие ещё не началось" if run and run["scheduled"] else "Виртуальное участие не идёт"
        raise HTTPException(status.HTTP_409_CONFLICT, detail=detail)
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


@router.delete("/{olympiad_id}/virtual", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_virtual(olympiad_id: int, user: User, conn: Conn) -> None:
    """Отменить отложенный старт, пока он не наступил."""
    run = await conn.fetchrow(q.GET_RUN, olympiad_id, user.id)
    if run is None or await conn.fetchval(q.CANCEL_RUN, run["id"]) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Отменить можно только участие, которое ещё не началось")


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
