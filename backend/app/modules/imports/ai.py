"""Распознавание задач с фото и из PDF через Claude API (Anthropic).

Включается переменной окружения ANTHROPIC_API_KEY. Без ключа импорт из файлов работает, а фото/PDF — нет.
Модель можно сменить через ANTHROPIC_MODEL. Запрос идёт через стандартную библиотеку (urllib),
чтобы не тянуть лишние зависимости.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

from app.modules.imports.parsers import ImportFormatError, normalize_draft

API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-5-5"
TIMEOUT_SECONDS = 180

PROMPT = """На изображении (или в документе) — задачи по физике, математике или химии для школьников.
Перепиши КАЖДУЮ задачу и верни ТОЛЬКО JSON без пояснений, в формате:

{"tasks": [{"title": "...", "condition": "...", "answer": "...", "answer_is_guess": false,
            "difficulty": 300, "source_number": "..."}],
 "notes": "..."}

Правила:
- condition — полный текст условия на языке оригинала, Markdown; формулы и величины в LaTeX: $v = 72$ км/ч,
  отдельные формулы — $$...$$. Ничего не добавляй от себя и не решай в условии.
- title — короткое название задачи (2–5 слов) на языке оригинала.
- answer — ответ с единицами, если он есть в источнике (например, в разделе ответов): "20 м/с".
  Если ответа в источнике нет — реши задачу сам, дай ответ и поставь "answer_is_guess": true.
  Если решить нельзя — answer пустой.
- difficulty — оценка сложности по шкале 100 (очень просто) … 1000 (финал олимпиады), кратно 100.
- source_number — номер задачи в источнике, если он виден (например "5.14"), иначе пустая строка.
- notes — кратко, если что-то не удалось разобрать (плохо видно, обрезано). Иначе пустая строка.
"""


class AIUnavailableError(RuntimeError):
    pass


def ai_enabled() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _request(content: bytes, media_type: str) -> dict[str, Any]:
    data = base64.standard_b64encode(content).decode("ascii")
    block_type = "document" if media_type == "application/pdf" else "image"
    body = {
        "model": os.getenv("ANTHROPIC_MODEL") or DEFAULT_MODEL,
        "max_tokens": 16000,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": block_type, "source": {"type": "base64", "media_type": media_type, "data": data}},
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
    }
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": os.environ["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 — фиксированный https URL
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise AIUnavailableError(f"Сервис распознавания вернул ошибку {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise AIUnavailableError("Сервис распознавания недоступен, попробуйте позже") from exc


def extract_json(text: str) -> dict[str, Any]:
    """JSON из ответа модели: допускаем обёртку ```json … ``` и текст вокруг."""
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    candidate = fenced.group(1) if fenced else text[text.find("{") : text.rfind("}") + 1]
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ImportFormatError("Не удалось распознать задачи на изображении") from exc
    if not isinstance(data, dict) or not isinstance(data.get("tasks"), list):
        raise ImportFormatError("Не удалось распознать задачи на изображении")
    return data


async def recognize(content: bytes, media_type: str) -> tuple[list[dict[str, Any]], str]:
    """Черновики задач и заметки модели. Черновик дополнительно содержит answer_is_guess."""
    if not ai_enabled():
        raise AIUnavailableError("Распознавание фото и PDF не настроено: администратор должен задать ANTHROPIC_API_KEY")
    response = await asyncio.to_thread(_request, content, media_type)
    text = "".join(block.get("text", "") for block in response.get("content", []) if block.get("type") == "text")
    data = extract_json(text)
    drafts = []
    for item in data["tasks"]:
        if not isinstance(item, dict):
            continue
        draft = normalize_draft(item)
        draft["answer_is_guess"] = bool(item.get("answer_is_guess")) and bool(draft["answer"])
        if draft["condition"]:
            drafts.append(draft)
    if not drafts:
        raise ImportFormatError("На изображении не найдено задач")
    return drafts, str(data.get("notes") or "")
