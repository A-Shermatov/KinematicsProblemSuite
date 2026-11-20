"""Распознавание задач с фото и из PDF через Google Gemini API (есть бесплатный уровень).

Включается переменной окружения GEMINI_API_KEY — ключ бесплатно выдаётся в Google AI Studio
(https://aistudio.google.com/apikey). Без ключа импорт из файлов работает, а фото/PDF — нет.
Модель можно сменить через GEMINI_MODEL. Запрос идёт через стандартную библиотеку (urllib),
чтобы не тянуть лишние зависимости.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app.modules.imports.parsers import ImportFormatError, normalize_draft

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Модели по очереди: если первая перегружена (503) или исчерпан её бесплатный лимит (429), пробуем следующую.
# Алиасы *-latest Google сам переводит на актуальные модели бесплатного уровня.
DEFAULT_MODELS = ("gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash")
TIMEOUT_SECONDS = 120
# Повторы одной модели при временной перегрузке: паузы в секундах между попытками.
RETRY_DELAYS = (2, 5)
TEMPORARY_ERRORS = {429, 500, 502, 503, 504}

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
    return bool(os.getenv("GEMINI_API_KEY"))


def models() -> list[str]:
    """GEMINI_MODEL может содержать одну модель или несколько через запятую."""
    configured = [name.strip() for name in (os.getenv("GEMINI_MODEL") or "").split(",") if name.strip()]
    return configured or list(DEFAULT_MODELS)


class _TemporaryError(Exception):
    def __init__(self, code: int) -> None:
        super().__init__(code)
        self.code = code


def _call(model: str, body: bytes) -> dict[str, Any]:
    request = urllib.request.Request(
        API_URL.format(model=urllib.parse.quote(model, safe="-._")),
        data=body,
        headers={"content-type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 — фиксированный https URL
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        if exc.code in TEMPORARY_ERRORS or exc.code == 404:  # 404 — модель переименована/недоступна: берём следующую
            raise _TemporaryError(exc.code) from exc
        detail = exc.read().decode("utf-8", "replace")[:300]
        if exc.code in (400, 401, 403) and "API key" in detail:
            raise AIUnavailableError("Ключ GEMINI_API_KEY не подходит — создайте новый в Google AI Studio") from exc
        raise AIUnavailableError(f"Сервис распознавания вернул ошибку {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise _TemporaryError(0) from exc


def _request(content: bytes, media_type: str, sleep: Any = time.sleep) -> dict[str, Any]:
    body = json.dumps(
        {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"inline_data": {"mime_type": media_type, "data": base64.b64encode(content).decode("ascii")}},
                        {"text": PROMPT},
                    ],
                }
            ],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
    ).encode("utf-8")
    codes: list[int] = []
    for model in models():
        for delay in (*RETRY_DELAYS, None):
            try:
                return _call(model, body)
            except _TemporaryError as exc:
                codes.append(exc.code)
                # Нет модели (404) или сеть не ответила (0, долгий таймаут) — сразу к следующей модели.
                if exc.code in (0, 404) or delay is None:
                    break
                sleep(delay)
    if codes and all(code == 429 for code in codes):
        raise AIUnavailableError("Бесплатный лимит распознавания временно исчерпан — попробуйте через минуту")
    raise AIUnavailableError("Сервис распознавания сейчас перегружен — попробуйте через пару минут")


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


def response_text(response: dict[str, Any]) -> str:
    """Текст ответа Gemini; если ответа нет (например, заблокирован фильтром) — понятная ошибка."""
    candidates = response.get("candidates") or []
    if not candidates:
        raise ImportFormatError("Сервис распознавания не вернул ответа — попробуйте другое фото")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts)


async def recognize(content: bytes, media_type: str) -> tuple[list[dict[str, Any]], str]:
    """Черновики задач и заметки модели. Черновик дополнительно содержит answer_is_guess."""
    if not ai_enabled():
        raise AIUnavailableError("Распознавание фото и PDF не настроено: администратор должен задать GEMINI_API_KEY")
    response = await asyncio.to_thread(_request, content, media_type)
    data = extract_json(response_text(response))
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
