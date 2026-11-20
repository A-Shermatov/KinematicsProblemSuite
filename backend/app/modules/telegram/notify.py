"""Уведомления в Telegram: сайт кладёт их в очередь `notifications`, бот (`python -m app.bot`) отправляет.

Уведомление создаётся, только если ученик привязал Telegram и не отключил уведомления.
Дубли (то же событие дважды) отсекаются уникальным ключом (user_id, kind, ref).
"""

from __future__ import annotations

import html
import os

import asyncpg

ENQUEUE = """
INSERT INTO notifications (user_id, kind, ref, text, url)
SELECT $1, $2, $3, $4, $5
WHERE EXISTS (SELECT 1 FROM telegram_links WHERE user_id = $1 AND notify)
ON CONFLICT (user_id, kind, ref) DO NOTHING
"""


def site_url(path: str = "") -> str:
    return os.getenv("SITE_PUBLIC_URL", "http://localhost:8080").rstrip("/") + path


def esc(value: object) -> str:
    return html.escape(str(value), quote=False)


async def enqueue(conn: asyncpg.Connection, user_id: int, kind: str, ref: str, text: str, path: str = "") -> None:
    await conn.execute(ENQUEUE, user_id, kind, ref, text, site_url(path) if path else "")


async def attempt_graded(conn: asyncpg.Connection, attempt: asyncpg.Record) -> None:
    grade = attempt["teacher_grade"]
    text = f"✅ Учитель проверил ваше решение задачи «{esc(attempt['task_title'])}»: <b>{grade}</b> из 100."
    if attempt["feedback"]:
        text += f"\n💬 {esc(attempt['feedback'])}"
    await enqueue(conn, attempt["student_id"], "graded", str(attempt["id"]), text, f"/tasks/{attempt['task_id']}")


async def olympiad_results(conn: asyncpg.Connection, olympiad: asyncpg.Record, results: list[asyncpg.Record]) -> None:
    from app.modules.rating import queries as rating_q
    from app.modules.rating.ranks import rank_for

    total = sum(1 for row in results if row["place"] is not None)
    changes = {row["user_id"]: row for row in await conn.fetch(rating_q.OLYMPIAD_CHANGES, olympiad["id"])}
    for row in results:
        medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(row["place"], "🏁")
        where = f"ваше место <b>{row['place']}</b> из {total}" if row["place"] else "вы участвовали вне конкурса"
        text = f"{medal} Итоги олимпиады «{esc(olympiad['title'])}» опубликованы: {where}, {row['total']} баллов."
        change = changes.get(row["user_id"])
        if change:
            delta = change["new_rating"] - change["old_rating"]
            text += f"\n📈 Рейтинг: {change['old_rating']} → <b>{change['new_rating']}</b> ({delta:+d})."
        await enqueue(conn, row["user_id"], "results", str(olympiad["id"]), text, f"/olympiads/{olympiad['id']}")
        # Новое звание: после первой рейтинговой олимпиады и при каждом повышении. Ключ — код звания,
        # поэтому о каждом сообщаем один раз.
        if change:
            first = await conn.fetchval(rating_q.CHANGES_COUNT, row["user_id"]) == 1
            old, new = rank_for(change["old_rating"]), rank_for(change["new_rating"])
            if new and old and (first or new.min_rating > old.min_rating):
                text = f"{new.icon} Новое звание: <b>{esc(new.name)}</b>! Оно теперь видно рядом с вашим именем."
                await enqueue(conn, row["user_id"], "title", new.code, text, f"/users/{row['user_id']}")
