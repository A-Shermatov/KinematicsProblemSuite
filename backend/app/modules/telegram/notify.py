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
    from app.modules.stats.router import titles_for

    total = len(results)
    for row in results:
        medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(row["place"], "🏁")
        text = (
            f"{medal} Итоги олимпиады «{esc(olympiad['title'])}» опубликованы: "
            f"ваше место <b>{row['place']}</b> из {total}, {row['total']} баллов."
        )
        await enqueue(conn, row["user_id"], "results", str(olympiad["id"]), text, f"/olympiads/{olympiad['id']}")
    # Новые звания: ключ — код звания, поэтому каждое приходит один раз.
    user_titles = await titles_for(conn, [row["user_id"] for row in results])
    for user_id, title in user_titles.items():
        if title:
            text = f"{title['icon']} Новое звание: <b>{esc(title['name'])}</b>! Оно теперь видно рядом с вашим именем."
            await enqueue(conn, user_id, "title", title["code"], text, f"/users/{user_id}")
