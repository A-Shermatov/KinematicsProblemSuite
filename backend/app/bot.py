"""Telegram-бот Donish. Запуск: `python -m app.bot` (в Docker — сервис `bot`).

Что делает:
- привязывает аккаунт по ссылке t.me/<бот>?start=<код> со страницы настроек профиля;
- каждое утро (09:00 по TIMEZONE) присылает «задачу дня» — случайную нерешённую задачу по силам;
- за час до олимпиады напоминает зарегистрированным участникам;
- отправляет уведомления из очереди `notifications` (решение проверено, итоги олимпиады, новое звание).

Команды: /task — задача прямо сейчас, /daily_on и /daily_off, /mute и /unmute, /unlink, /help.
Без TELEGRAM_BOT_TOKEN бот не запускается (просто ждёт, чтобы контейнер не перезапускался по кругу).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo

import asyncpg

from app.modules.telegram.notify import esc, site_url

log = logging.getLogger("donish.bot")

DAILY_AT = time(9, 0)
REMINDER_MINUTES = 60

HELP = (
    "Я бот платформы Donish 📚\n\n"
    "/task — задача прямо сейчас\n"
    "/daily_on, /daily_off — «задача дня» по утрам\n"
    "/mute, /unmute — уведомления о проверке решений и олимпиадах\n"
    "/unlink — отвязать аккаунт"
)


@dataclass
class Reply:
    text: str
    url: str = ""
    button: str = "Открыть"
    extra: dict[str, Any] = field(default_factory=dict)


# ---------- SQL ----------

USE_CODE = "DELETE FROM telegram_link_codes WHERE code = $1 AND expires_at > now() RETURNING user_id"
# Этот чат мог быть привязан к другому аккаунту — отвязываем.
FREE_CHAT = "DELETE FROM telegram_links WHERE chat_id = $2 AND user_id <> $1"
LINK = """
INSERT INTO telegram_links (user_id, chat_id, username) VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, username = EXCLUDED.username, linked_at = now()
"""

LINKED_USER = """
SELECT u.id, u.role, trim(u.first_name || ' ' || u.last_name) AS name, l.daily_task, l.notify
FROM telegram_links l JOIN users u ON u.id = l.user_id AND u.is_active
WHERE l.chat_id = $1
"""

SET_FLAG = "UPDATE telegram_links SET {column} = $2 WHERE chat_id = $1"
UNLINK = "DELETE FROM telegram_links WHERE chat_id = $1"

# Случайная нерешённая задача по силам: не сложнее, чем лучшая решённая + 200 (новичку — до 300).
PICK_TASK = """
WITH best AS (
    SELECT COALESCE(max(k.difficulty), 100) AS level
    FROM attempts a JOIN tasks k ON k.id = a.task_id
    WHERE a.student_id = $1 AND a.status IN ('correct', 'graded')
)
SELECT k.id, k.title, k.difficulty, t.title AS theme_title
FROM tasks k
JOIN themes t ON t.id = k.theme_id
CROSS JOIN best
WHERE k.is_active AND k.check_mode = 'auto' AND k.author_id <> $1
  AND k.difficulty <= GREATEST(best.level + 200, 300)
  AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.task_id = k.id AND a.student_id = $1
                  AND a.status IN ('correct', 'graded'))
ORDER BY random()
LIMIT 1
"""

DAILY_RECIPIENTS = """
SELECT l.user_id FROM telegram_links l
JOIN users u ON u.id = l.user_id AND u.is_active AND u.role = 'student'
WHERE l.daily_task
  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = l.user_id AND n.kind = 'daily' AND n.ref = $1)
"""

ENQUEUE_ANY = """
INSERT INTO notifications (user_id, kind, ref, text, url) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, kind, ref) DO NOTHING
"""

REMINDERS = f"""
INSERT INTO notifications (user_id, kind, ref, text, url)
SELECT p.user_id, 'reminder', o.id::text,
       '⏰ Через ' || GREATEST(1, ceil(extract(epoch FROM o.starts_at - now()) / 60))::int
       || ' мин начнётся олимпиада «' || replace(replace(o.title, '&', '&amp;'), '<', '&lt;') || '». Удачи!',
       $1 || '/olympiads/' || o.id
FROM olympiads o
JOIN olympiad_participants p ON p.olympiad_id = o.id
JOIN telegram_links l ON l.user_id = p.user_id AND l.notify
WHERE o.status = 'published' AND o.starts_at > now() AND o.starts_at <= now() + interval '{REMINDER_MINUTES} minutes'
ON CONFLICT (user_id, kind, ref) DO NOTHING
"""

PENDING = """
SELECT n.id, n.text, n.url, l.chat_id
FROM notifications n JOIN telegram_links l ON l.user_id = n.user_id
WHERE n.sent_at IS NULL AND n.created_at > now() - interval '3 days'
ORDER BY n.id
LIMIT 30
"""
MARK_SENT = "UPDATE notifications SET sent_at = now() WHERE id = $1"


# ---------- Логика (без сети — тестируется напрямую) ----------


def task_reply(task: asyncpg.Record, prefix: str) -> Reply:
    return Reply(
        f"{prefix} <b>{esc(task['title'])}</b>\n{esc(task['theme_title'])} · сложность {task['difficulty']}",
        url=site_url(f"/tasks/{task['id']}"),
        button="Решить",
    )


async def handle_message(conn: asyncpg.Connection, chat_id: int, username: str, text: str) -> list[Reply]:
    command, _, argument = text.strip().partition(" ")
    command = command.split("@")[0].lower()
    if command == "/start" and argument.strip():
        async with conn.transaction():
            user_id = await conn.fetchval(USE_CODE, argument.strip())
            if user_id is not None:
                await conn.execute(FREE_CHAT, user_id, chat_id)
                await conn.execute(LINK, user_id, chat_id, username or "")
        if user_id is None:
            return [Reply("Ссылка устарела или уже использована. Получите новую в настройках профиля на сайте.")]
        user = await conn.fetchrow(LINKED_USER, chat_id)
        return [
            Reply(
                f"Готово, {esc(user['name'])}! Аккаунт привязан ✅\n\n"
                "Каждое утро пришлю задачу дня, напомню об олимпиадах и сообщу, когда учитель проверит решение.\n\n"
                + HELP
            )
        ]
    user = await conn.fetchrow(LINKED_USER, chat_id)
    if user is None:
        return [
            Reply(
                "Привяжите аккаунт Donish: на сайте откройте «Настройки профиля» → Telegram → «Подключить».",
                url=site_url("/settings"),
                button="Открыть настройки",
            )
        ]
    if command == "/task":
        if user["role"] != "student":
            return [Reply("Задачи дня — для учеников.")]
        task = await conn.fetchrow(PICK_TASK, user["id"])
        if task is None:
            return [
                Reply("Вы решили все подходящие задачи 🎉 Загляните в каталог за новыми.", url=site_url("/catalog"))
            ]
        return [task_reply(task, "🧩 Попробуйте:")]
    flags = {
        "/daily_on": ("daily_task", True, "Буду присылать задачу дня каждое утро ☀️"),
        "/daily_off": ("daily_task", False, "Задачу дня больше не присылаю. Вернуть — /daily_on"),
        "/mute": ("notify", False, "Уведомления выключены. Вернуть — /unmute"),
        "/unmute": ("notify", True, "Уведомления включены 🔔"),
    }
    if command in flags:
        column, value, answer = flags[command]
        await conn.execute(SET_FLAG.format(column=column), chat_id, value)
        return [Reply(answer)]
    if command in ("/unlink", "/stop"):
        await conn.execute(UNLINK, chat_id)
        return [Reply("Аккаунт отвязан. Привязать снова можно в настройках профиля на сайте.")]
    return [Reply(HELP)]


async def enqueue_daily_tasks(conn: asyncpg.Connection, now: datetime) -> int:
    """Задача дня: после 09:00 по местному времени, один раз в день каждому подписанному ученику."""
    if now.time() < DAILY_AT:
        return 0
    day = now.date().isoformat()
    count = 0
    for row in await conn.fetch(DAILY_RECIPIENTS, day):
        task = await conn.fetchrow(PICK_TASK, row["user_id"])
        if task is None:
            continue
        reply = task_reply(task, "☀️ Задача дня:")
        await conn.execute(ENQUEUE_ANY, row["user_id"], "daily", day, reply.text, reply.url)
        count += 1
    return count


async def enqueue_reminders(conn: asyncpg.Connection) -> None:
    await conn.execute(REMINDERS, site_url())


# ---------- Telegram Bot API ----------


class TelegramError(RuntimeError):
    def __init__(self, code: int, description: str) -> None:
        super().__init__(f"{code}: {description}")
        self.code = code


def _call(token: str, method: str, payload: dict[str, Any], timeout: int = 35) -> Any:
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 — фиксированный https URL
            return json.loads(response.read())["result"]
    except urllib.error.HTTPError as exc:
        body = json.loads(exc.read() or b"{}")
        raise TelegramError(exc.code, body.get("description", "")) from exc


async def send(token: str, chat_id: int, reply: Reply) -> None:
    payload: dict[str, Any] = {"chat_id": chat_id, "text": reply.text, "parse_mode": "HTML", **reply.extra}
    # Telegram не принимает localhost в кнопках — тогда ссылка просто в тексте.
    if reply.url and "localhost" not in reply.url and "127.0.0.1" not in reply.url:
        payload["reply_markup"] = {"inline_keyboard": [[{"text": reply.button, "url": reply.url}]]}
    elif reply.url:
        payload["text"] += f"\n{reply.url}"
    await asyncio.to_thread(_call, token, "sendMessage", payload, 15)


async def poll_updates(token: str, pool: asyncpg.Pool) -> None:
    offset = 0
    while True:
        try:
            updates = await asyncio.to_thread(_call, token, "getUpdates", {"offset": offset, "timeout": 25})
        except (TelegramError, urllib.error.URLError, TimeoutError) as exc:
            log.warning("getUpdates: %s", exc)
            await asyncio.sleep(5)
            continue
        for update in updates:
            offset = update["update_id"] + 1
            message = update.get("message") or {}
            text, chat = message.get("text"), message.get("chat") or {}
            if not text or chat.get("type") != "private":
                continue
            try:
                async with pool.acquire() as conn:
                    replies = await handle_message(conn, chat["id"], message.get("from", {}).get("username", ""), text)
                for reply in replies:
                    await send(token, chat["id"], reply)
            except Exception:  # одно сообщение не должно ронять бота
                log.exception("Ошибка обработки сообщения")


async def deliver(token: str, pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        rows = await conn.fetch(PENDING)
        for row in rows:
            try:
                await send(token, row["chat_id"], Reply(row["text"], url=row["url"]))
            except TelegramError as exc:
                if exc.code == 403:  # пользователь заблокировал бота
                    await conn.execute(UNLINK, row["chat_id"])
                elif exc.code == 429:
                    break
                else:
                    log.warning("sendMessage: %s", exc)
            await conn.execute(MARK_SENT, row["id"])
            await asyncio.sleep(0.05)  # лимит Telegram — ~30 сообщений в секунду


async def scheduler(token: str, pool: asyncpg.Pool, tz: ZoneInfo) -> None:
    while True:
        try:
            async with pool.acquire() as conn:
                await enqueue_reminders(conn)
                await enqueue_daily_tasks(conn, datetime.now(tz))
            await deliver(token, pool)
        except Exception:
            log.exception("Ошибка планировщика")
        await asyncio.sleep(20)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        log.info("TELEGRAM_BOT_TOKEN не задан — бот выключен")
        await asyncio.Event().wait()  # ждать вечно, не выходя (иначе Docker будет перезапускать контейнер)
    pool = await asyncpg.create_pool(os.environ["DATABASE_URL"], min_size=1, max_size=3)
    tz = ZoneInfo(os.getenv("TIMEZONE", "Asia/Dushanbe"))
    log.info("Бот запущен")
    await asyncio.gather(poll_updates(token, pool), scheduler(token, pool, tz))


if __name__ == "__main__":
    asyncio.run(main())
