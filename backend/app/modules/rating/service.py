"""Пересчёт рейтинга по олимпиадам с опубликованными итогами — по порядку окончания."""

from __future__ import annotations

import asyncpg

from app.modules.olympiads import queries as olympiads_q
from app.modules.rating import queries as q
from app.modules.rating.elo import INITIAL_RATING, Participant, rating_changes
from app.modules.rating.ranks import badge


async def current_ratings(conn: asyncpg.Connection, user_ids: list[int]) -> dict[int, int]:
    if not user_ids:
        return {}
    return {row["user_id"]: row["rating"] for row in await conn.fetch(q.CURRENT_RATINGS, user_ids)}


async def badges_for(conn: asyncpg.Connection, user_ids: list[int]) -> dict[int, dict | None]:
    """Звание каждого пользователя по рейтингу (None — ещё без рейтинга)."""
    ratings = await current_ratings(conn, user_ids)
    return {uid: badge(ratings.get(uid)) for uid in user_ids}


async def _rate(conn: asyncpg.Connection, olympiad_id: int) -> None:
    rows = await conn.fetch(olympiads_q.RESULTS, olympiad_id)
    ratings = await current_ratings(conn, [row["user_id"] for row in rows])
    participants = [
        Participant(row["user_id"], ratings.get(row["user_id"], INITIAL_RATING), row["place"]) for row in rows
    ]
    deltas = rating_changes(participants)
    for row, participant in zip(rows, participants, strict=True):
        new = participant.rating + deltas[participant.user_id]
        await conn.execute(
            q.INSERT_CHANGE, olympiad_id, row["user_id"], row["place"], row["total"], participant.rating, new
        )
    await conn.execute(q.MARK_RATED, olympiad_id)


async def apply_pending(conn: asyncpg.Connection) -> int:
    """Учесть в рейтинге все олимпиады с опубликованными, но ещё не учтёнными итогами. Возвращает их число."""
    async with conn.transaction():
        await conn.execute(q.LOCK)  # одновременный пересчёт из нескольких процессов
        pending = [row["id"] for row in await conn.fetch(q.PENDING)]
        for olympiad_id in pending:
            await _rate(conn, olympiad_id)
    return len(pending)


async def recompute_all(conn: asyncpg.Connection) -> int:
    """Пересчитать рейтинг с нуля — например, после удаления олимпиады или правки итогов."""
    async with conn.transaction():
        await conn.execute(q.LOCK)
        await conn.execute(q.RESET)
        return await apply_pending(conn)
