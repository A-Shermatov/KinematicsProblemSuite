from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query

from app.deps import Conn, User
from app.modules.stats import queries as q
from app.storage import public_url

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/me")
async def my_stats(user: User, conn: Conn) -> dict[str, Any]:
    """Сводка для личного кабинета. Ученик — прогресс; учитель и админ — их задачи (сводка по платформе в /admin)."""
    if not user.is_student:
        return {"role": user.role, **dict(await conn.fetchrow(q.TEACHER_SUMMARY, user.id))}
    summary = dict(await conn.fetchrow(q.STUDENT_SUMMARY, user.id))
    by_theme = [dict(row) for row in await conn.fetch(q.STUDENT_BY_THEME, user.id)]
    return {"role": "student", **summary, "by_theme": by_theme}


@router.get("/leaderboard")
async def leaderboard(
    conn: Conn,
    period: Literal["week", "month", "all"] = "all",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[dict[str, Any]]:
    since = {
        "week": datetime.now(UTC) - timedelta(days=7),
        "month": datetime.now(UTC) - timedelta(days=30),
        "all": None,
    }[period]
    rows = await conn.fetch(q.LEADERBOARD, limit, since)
    return [
        {
            "rank": index,
            "user_id": row["user_id"],
            "username": row["username"],
            "name": row["name"],
            "avatar_url": public_url(row["avatar_path"]),
            "solved_tasks": row["solved_tasks"],
            "points": row["points"],
        }
        for index, row in enumerate(rows, start=1)
    ]
