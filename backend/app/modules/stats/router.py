from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query

from app.deps import Conn, SettingsDep, User, not_found
from app.modules.rating import queries as rating_q
from app.modules.rating import ranks
from app.modules.rating import service as rating
from app.modules.stats import queries as q
from app.modules.users import queries as user_q
from app.storage import public_url

router = APIRouter(prefix="/stats", tags=["stats"])

Period = Literal["week", "month", "all"]


def _since(period: Period) -> datetime | None:
    days = {"week": 7, "month": 30}.get(period)
    return datetime.now(UTC) - timedelta(days=days) if days else None


def _clean(value: str | None) -> str | None:
    return " ".join(value.split()) or None if value else None


@router.get("/me")
async def my_stats(user: User, conn: Conn) -> dict[str, Any]:
    """Сводка для личного кабинета. Ученик — прогресс; учитель и админ — их задачи (сводка по платформе в /admin)."""
    if not user.is_student:
        return {"role": user.role, **dict(await conn.fetchrow(q.TEACHER_SUMMARY, user.id))}
    summary = dict(await conn.fetchrow(q.STUDENT_SUMMARY, user.id))
    by_theme = [dict(row) for row in await conn.fetch(q.STUDENT_BY_THEME, user.id)]
    return {"role": "student", **summary, "by_theme": by_theme}


async def titles_for(conn: Conn, user_ids: list[int]) -> dict[int, dict[str, Any] | None]:
    """Звание каждого пользователя по рейтингу олимпиадника (или None) — для рейтингов и списков."""
    return await rating.badges_for(conn, user_ids)


@router.get("/achievements/{user_id}")
async def achievements(user_id: int, conn: Conn) -> dict[str, Any]:
    """Очки, решённые задачи, рейтинг олимпиадника с историей и звание — для кабинета и публичного профиля."""
    if await conn.fetchrow(user_q.GET_ACTIVE_BY_ID, user_id) is None:
        raise not_found("Пользователь")
    stats = dict(await conn.fetchrow(q.STUDENT_PROFILE, user_id))
    history = [dict(row) for row in await conn.fetch(rating_q.HISTORY, user_id)]
    current = history[-1]["new_rating"] if history else None
    return {
        **stats,
        "rating": current,
        "max_rating": max((h["new_rating"] for h in history), default=None),
        "history": history,
        "title": ranks.badge(current),
        "titles": ranks.ladder(current),
    }


@router.get("/activity/{user_id}")
async def activity(
    user_id: int,
    conn: Conn,
    settings: SettingsDep,
    days: Annotated[int, Query(ge=7, le=366)] = 365,
) -> dict[str, Any]:
    """Тепловая карта: число отправленных попыток по дням. День активен, если была хотя бы одна попытка."""
    if await conn.fetchrow(user_q.GET_ACTIVE_BY_ID, user_id) is None:
        raise not_found("Пользователь")
    rows = await conn.fetch(q.ACTIVITY, user_id, settings.timezone, days)
    counts = [{"date": row["day"].isoformat(), "count": row["count"]} for row in rows]
    return {
        "days": counts,
        "total": sum(item["count"] for item in counts),
        "active_days": len(counts),
        "timezone": settings.timezone,
    }


@router.get("/difficulty/{user_id}")
async def difficulty_breakdown(user_id: int, conn: Conn) -> dict[str, Any]:
    """Решённые и нерешённые задачи по уровням сложности и по предметам — для диаграмм в профиле."""
    if await conn.fetchrow(user_q.GET_ACTIVE_BY_ID, user_id) is None:
        raise not_found("Пользователь")
    levels = [dict(row) for row in await conn.fetch(q.BY_DIFFICULTY, user_id)]
    subjects = [dict(row) for row in await conn.fetch(q.BY_SUBJECT, user_id)]
    return {"levels": levels, "subjects": subjects}


@router.get("/leaderboard")
async def leaderboard(
    conn: Conn,
    period: Period = "all",
    metric: Literal["points", "solved"] = "points",
    subject_id: int | None = None,
    city: Annotated[str | None, Query(max_length=60)] = None,
    school: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[dict[str, Any]]:
    rows = await conn.fetch(q.LEADERBOARD, limit, _since(period), subject_id, _clean(city), _clean(school), metric)
    user_titles = await titles_for(conn, [row["user_id"] for row in rows])
    return [
        {
            "rank": index,
            "user_id": row["user_id"],
            "username": row["username"],
            "name": row["name"],
            "avatar_url": public_url(row["avatar_path"]),
            "city": row["city"],
            "school": row["school"],
            "country_code": row["country_code"],
            "role": row["role"],
            "solved_tasks": row["solved_tasks"],
            "points": row["points"],
            "title": user_titles.get(row["user_id"]),
        }
        for index, row in enumerate(rows, start=1)
    ]


@router.get("/leaderboard/schools")
async def school_leaderboard(
    conn: Conn,
    period: Period = "all",
    subject_id: int | None = None,
    city: Annotated[str | None, Query(max_length=60)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[dict[str, Any]]:
    rows = await conn.fetch(q.SCHOOL_LEADERBOARD, limit, _since(period), subject_id, _clean(city))
    return [{"rank": index, **dict(row)} for index, row in enumerate(rows, start=1)]


@router.get("/leaderboard/cities")
async def city_leaderboard(
    conn: Conn,
    period: Period = "all",
    subject_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[dict[str, Any]]:
    rows = await conn.fetch(q.CITY_LEADERBOARD, limit, _since(period), subject_id)
    return [{"rank": index, **dict(row)} for index, row in enumerate(rows, start=1)]


@router.get("/leaderboard/olympiads")
async def olympiad_leaderboard(
    conn: Conn,
    city: Annotated[str | None, Query(max_length=60)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[dict[str, Any]]:
    """Рейтинг олимпиадников, как на Codeforces: по текущему рейтингу (меняется после каждой олимпиады)."""
    rows = await conn.fetch(rating_q.LEADERBOARD, limit, _clean(city))
    return [
        {
            "rank": index,
            **{k: v for k, v in dict(row).items() if k != "avatar_path"},
            "avatar_url": public_url(row["avatar_path"]),
            "title": ranks.badge(row["rating"]),
        }
        for index, row in enumerate(rows, start=1)
    ]


@router.get("/places")
async def places(conn: Conn, city: Annotated[str | None, Query(max_length=60)] = None) -> dict[str, list[str]]:
    """Подсказки для полей «город» и «школа» из уже введённых значений."""
    cities = [row["name"] for row in await conn.fetch(q.CITIES)]
    schools = [row["name"] for row in await conn.fetch(q.SCHOOLS, _clean(city))]
    return {"cities": cities, "schools": schools}
