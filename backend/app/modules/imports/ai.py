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
LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"

# Модели бесплатного уровня Gemini API, из которых учитель выбирает. Порядок — он же порядок запасных:
# если выбранная модель перегружена (503) или исчерпан её лимит (429), пробуем следующие.
# Список можно заменить переменной GEMINI_MODELS (id через запятую). Модели, которых нет у ключа, скрываются.
FREE_MODELS: dict[str, tuple[str, str]] = {
    "gemini-flash-latest": ("Gemini Flash (последняя)", "Быстрая и точная — рекомендуется"),
    "gemini-3.8-flash": ("Gemini 3.8 Flash", "Самая умная Flash: сложные формулы и рукописный текст"),
    "gemini-3.7-flash": ("Gemini 3.7 Flash", "Хорошо читает фото и PDF"),
    "gemini-flash-lite-latest": ("Gemini Flash-Lite (последняя)", "Самая быстрая, выше лимиты, но проще"),
    "gemini-2.5-flash": ("Gemini 2.5 Flash", "Проверенная модель предыдущего поколения"),
    "gemini-2.5-flash-lite": ("Gemini 2.5 Flash-Lite", "Лёгкая модель предыдущего поколения"),
}
AUTO = "auto"
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


def configured_models() -> list[str]:
    """Модели для выбора: GEMINI_MODELS (или старая GEMINI_MODEL), иначе бесплатные по умолчанию."""
    raw = os.getenv("GEMINI_MODELS") or os.getenv("GEMINI_MODEL") or ""
    configured = [name.strip() for name in raw.split(",") if name.strip()]
    return configured or list(FREE_MODELS)


_available_cache: tuple[float, set[str] | None] = (0.0, None)


def _list_available() -> set[str] | None:
    """Модели, доступные этому ключу (generateContent). None — список получить не удалось."""
    request = urllib.request.Request(LIST_URL, headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:  # noqa: S310 — фиксированный https URL
            data = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    return {
        item["name"].removeprefix("models/")
        for item in data.get("models", [])
        if "generateContent" in item.get("supportedGenerationMethods", [])
    }


async def model_choices() -> list[dict[str, str]]:
    """Список для выбора в интерфейсе; модели, которых нет у ключа, скрываются (список кешируется на час)."""
    global _available_cache
    if not ai_enabled():
        return []
    checked_at, available = _available_cache
    if time.monotonic() - checked_at > 3600:
        available = await asyncio.to_thread(_list_available)
        _available_cache = (time.monotonic(), available)
    names = [name for name in configured_models() if available is None or name in available]
    return [
        {"id": name, "label": FREE_MODELS.get(name, (name, ""))[0], "hint": FREE_MODELS.get(name, ("", ""))[1]}
        for name in names or configured_models()
    ]


def models(preferred: str | None = None) -> list[str]:
    """Порядок попыток: выбранная модель, затем остальные как запасные."""
    order = configured_models()
    if preferred and preferred != AUTO:
        order = [preferred, *(name for name in order if name != preferred)]
    return order


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
        detail = exc.read().decode("utf-8", "replace")[:500]
        if exc.code == 429 and "limit: 0" in detail:
            raise _TemporaryError(404) from exc  # модель не входит в бесплатный уровень этого ключа — к следующей
        if exc.code in TEMPORARY_ERRORS or exc.code == 404:  # 404 — модель переименована/недоступна: берём следующую
            raise _TemporaryError(exc.code) from exc
        detail = detail[:300]
        if exc.code in (400, 401, 403) and "API key" in detail:
            raise AIUnavailableError("Ключ GEMINI_API_KEY не подходит — создайте новый в Google AI Studio") from exc
        raise AIUnavailableError(f"Сервис распознавания вернул ошибку {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise _TemporaryError(0) from exc


def _request(
    content: bytes, media_type: str, preferred: str | None = None, sleep: Any = time.sleep
) -> tuple[dict[str, Any], str]:
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
    for model in models(preferred):
        for delay in (*RETRY_DELAYS, None):
            try:
                return _call(model, body), model
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


async def recognize(content: bytes, media_type: str, model: str | None = None) -> tuple[list[dict[str, Any]], str, str]:
    """Черновики задач, заметки модели и какая модель в итоге ответила. Черновик содержит answer_is_guess."""
    if not ai_enabled():
        raise AIUnavailableError("Распознавание фото и PDF не настроено: администратор должен задать GEMINI_API_KEY")
    response, used = await asyncio.to_thread(_request, content, media_type, model)
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
    return drafts, str(data.get("notes") or ""), used
