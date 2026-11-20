import asyncio
from datetime import datetime
from typing import Any

import pytest

from tests.conftest import TEST_DATABASE_URL, ApiClient
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def run(fn: Any) -> Any:
    """Выполнить корутину fn(conn) на тестовой базе."""

    async def go() -> Any:
        import asyncpg

        conn = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            return await fn(conn)
        finally:
            await conn.close()

    return asyncio.run(go())


def fetch(query: str, *args: object) -> list[dict]:
    return run(lambda conn: _fetch(conn, query, *args))


async def _fetch(conn: Any, query: str, *args: object) -> list[dict]:
    return [dict(row) for row in await conn.fetch(query, *args)]


def link(client: ApiClient, token: str, chat_id: int, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import bot

    monkeypatch.setenv("TELEGRAM_BOT_USERNAME", "donish_test_bot")
    response = client.post("/api/telegram/link", token)
    assert response.status_code == 200, response.text
    url = response.json()["url"]
    assert url.startswith("https://t.me/donish_test_bot?start=")
    code = url.split("start=")[1]
    replies = run(lambda conn: bot.handle_message(conn, chat_id, "tg_user", f"/start {code}"))
    assert "Аккаунт привязан" in replies[0].text


def test_link_and_commands(client: ApiClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import bot

    monkeypatch.delenv("TELEGRAM_BOT_USERNAME", raising=False)
    student = client.student()
    assert client.post("/api/telegram/link", student).status_code == 503
    assert client.get("/api/telegram", student).json()["linked"] is False

    # Не привязан — бот предлагает привязать.
    assert "Привяжите аккаунт" in run(lambda c: bot.handle_message(c, 555, "x", "/task"))[0].text
    link(client, student, 555, monkeypatch)
    assert client.get("/api/telegram", student).json() | {} == {
        "enabled": False,  # токена нет — но привязка работает
        "bot_username": "donish_test_bot",
        "linked": True,
        "username": "tg_user",
        "daily_task": True,
        "notify": True,
    }
    # Код одноразовый.
    assert "устарела" in run(lambda c: bot.handle_message(c, 777, "y", "/start wrongcode"))[0].text

    teacher = client.teacher()
    theme = client.theme()
    task = client.task(teacher, theme["id"], difficulty=200)
    reply = run(lambda c: bot.handle_message(c, 555, "x", "/task"))[0]
    assert task["title"] in reply.text and reply.url.endswith(f"/tasks/{task['id']}")

    run(lambda c: bot.handle_message(c, 555, "x", "/daily_off"))
    assert client.get("/api/telegram", student).json()["daily_task"] is False
    assert client.put("/api/telegram", student, json={"daily_task": True, "notify": False}).json()["notify"] is False
    assert "/task" in run(lambda c: bot.handle_message(c, 555, "x", "/help"))[0].text
    run(lambda c: bot.handle_message(c, 555, "x", "/unlink"))
    assert client.get("/api/telegram", student).json()["linked"] is False


def test_daily_task_and_grading_notifications(client: ApiClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import bot

    teacher = client.teacher()
    theme = client.theme()
    auto = client.task(teacher, theme["id"], difficulty=200)
    manual = client.task(teacher, theme["id"], check_mode="manual", difficulty=200)
    student = client.student()
    link(client, student, 1001, monkeypatch)
    sid = client.get("/api/users/me", student).json()["id"]

    # До 9 утра — ничего, после — одна задача дня (повторный запуск не дублирует).
    assert run(lambda c: bot.enqueue_daily_tasks(c, datetime(2026, 11, 20, 8, 59))) == 0
    assert run(lambda c: bot.enqueue_daily_tasks(c, datetime(2026, 11, 20, 9, 0))) == 1
    assert run(lambda c: bot.enqueue_daily_tasks(c, datetime(2026, 11, 20, 15, 0))) == 0
    daily = fetch("SELECT text, url FROM notifications WHERE user_id = $1 AND kind = 'daily'", sid)
    assert len(daily) == 1 and f"/tasks/{auto['id']}" in daily[0]["url"]  # ручные задачи не предлагаются

    attempt = client.attempt(student, manual["id"], "инерция").json()
    client.post(f"/api/attempts/{attempt['id']}/grade", teacher, json={"grade": 90, "feedback": "Хорошо"})
    graded = fetch("SELECT text FROM notifications WHERE user_id = $1 AND kind = 'graded'", sid)
    assert len(graded) == 1 and "<b>90</b>" in graded[0]["text"] and "Хорошо" in graded[0]["text"]

    pending = run(lambda c: _fetch(c, bot.PENDING))
    assert {row["chat_id"] for row in pending} == {1001} and len(pending) == 2


def test_olympiad_reminder_results_and_title(client: ApiClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import bot

    teacher = client.teacher()
    oid = create_olympiad(client, teacher)["id"]
    task = add_task(client, teacher, oid)
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    client.post(f"/api/admin/olympiads/{oid}/review", client.admin_token(), json={"status": "published"})
    ali = client.student("ali")
    client.post(f"/api/olympiads/{oid}/register", ali)
    link(client, ali, 2002, monkeypatch)
    ali_id = client.get("/api/users/me", ali).json()["id"]

    client.sql("UPDATE olympiads SET starts_at = now() + interval '30 minutes', ends_at = now() + interval '3 hours'")
    run(bot.enqueue_reminders)
    run(bot.enqueue_reminders)
    reminders = fetch("SELECT text FROM notifications WHERE user_id = $1 AND kind = 'reminder'", ali_id)
    assert len(reminders) == 1 and "мин начнётся олимпиада" in reminders[0]["text"]

    set_phase(client, oid, "running")
    client.post(f"/api/olympiads/{oid}/tasks/{task['id']}/submit", ali, data={"answer": "20"}, files=photo())
    set_phase(client, oid, "checking")
    for item in client.get(f"/api/olympiads/{oid}/submissions", teacher).json():
        client.post(f"/api/olympiads/{oid}/submissions/{item['id']}/grade", teacher, json={"points": 10})
    client.post(f"/api/olympiads/{oid}/publish-results", teacher)

    kinds = {
        row["kind"]: row["text"] for row in fetch("SELECT kind, text FROM notifications WHERE user_id = $1", ali_id)
    }
    assert "место <b>1</b> из 1" in kinds["results"]
    assert "Победитель олимпиады" in kinds["title"]
