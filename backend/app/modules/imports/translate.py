"""Перевод условия задачи (ИИ Gemini) с сохранением формата: Markdown, формулы LaTeX, параметры {v}, рисунки.

Модели прямо велено не трогать формулы; после ответа проверяем, что формулы, параметры и ссылки на рисунки
остались на месте, — иначе просим ещё раз, а затем честно сообщаем об ошибке.
"""

from __future__ import annotations

import asyncio
import json
import re
from collections import Counter
from typing import Any

from app.modules.imports.ai import AIUnavailableError, ai_enabled, generate, response_text

LANG_NAMES = {"ru": "русский", "en": "английский", "tg": "таджикский (кириллица)"}

PROMPT = """Переведи поля задачи для школьников с языка «{source}» на язык «{target}».
Правила — строго:
1. Формулы в $...$ и $$...$$ не переводи и не меняй, кроме слов внутри \\text{{...}}
   (например \\text{{м/с}} → \\text{{m/s}}).
2. Параметры в фигурных скобках вроде {{v}} или {{h_0}} оставь как есть.
3. Markdown (**жирный**, списки, > цитаты), переносы строк и ссылки на рисунки ![...](url) сохрани; url не меняй.
4. Числа не меняй. Единицы измерения переводи принятыми на языке перевода сокращениями.
5. Перевод — естественный учебный язык, как в школьном задачнике.
Верни JSON с теми же ключами, что во входе, и только переведённым текстом в значениях.

Вход:
{fields}"""

_MATH = re.compile(r"\$\$.+?\$\$|\$[^$\n]+?\$", re.S)
_TEXT_IN_MATH = re.compile(r"\\text\{[^{}]*\}")
_PARAM = re.compile(r"(?<![\\$\w])\{([A-Za-z_][A-Za-z0-9_]*)\}")
_IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)\)")


def fingerprint(text: str) -> Counter[str]:
    """Что обязано пережить перевод: формулы (без \\text{…}), параметры и адреса рисунков."""
    parts: Counter[str] = Counter()
    for formula in _MATH.findall(text):
        parts["math:" + re.sub(r"\s+", "", _TEXT_IN_MATH.sub("", formula))] += 1
    for name in _PARAM.findall(_MATH.sub("", text)):
        parts["param:" + name] += 1
    for url in _IMAGE.findall(text):
        parts["image:" + url] += 1
    return parts


def broken(source: dict[str, Any], result: dict[str, Any]) -> list[str]:
    """Поля, где перевод потерял или испортил формулы, параметры или рисунки."""
    bad = []
    for key, value in source.items():
        got = result.get(key)
        if isinstance(value, list):
            if (
                not isinstance(got, list)
                or len(got) != len(value)
                or any(fingerprint(a) != fingerprint(str(b)) for a, b in zip(value, got, strict=True))
            ):
                bad.append(key)
        elif not isinstance(got, str) or (value.strip() and not got.strip()) or fingerprint(value) != fingerprint(got):
            bad.append(key)
    return bad


def _body(fields: dict[str, Any], source: str, target: str) -> bytes:
    prompt = PROMPT.format(
        source=LANG_NAMES[source], target=LANG_NAMES[target], fields=json.dumps(fields, ensure_ascii=False, indent=2)
    )
    return json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
    ).encode("utf-8")


def _parse(text: str) -> dict[str, Any]:
    start, end = text.find("{"), text.rfind("}")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AIUnavailableError("Сервис перевода вернул непонятный ответ — попробуйте ещё раз") from exc
    if not isinstance(data, dict):
        raise AIUnavailableError("Сервис перевода вернул непонятный ответ — попробуйте ещё раз")
    return data


async def translate(
    fields: dict[str, Any], source: str, target: str, model: str | None = None
) -> tuple[dict[str, Any], str]:
    """Перевод непустых полей; пустые возвращаются пустыми. Две попытки, если формулы пострадали."""
    if not ai_enabled():
        raise AIUnavailableError("Перевод не настроен: администратор должен задать GEMINI_API_KEY")
    todo = {k: v for k, v in fields.items() if (v.strip() if isinstance(v, str) else any(x.strip() for x in v))}
    if not todo:
        return fields, ""
    for _attempt in range(2):
        response, used = await asyncio.to_thread(generate, _body(todo, source, target), model)
        result = _parse(response_text(response))
        if not broken(todo, result):
            return {**fields, **{k: result[k] for k in todo}}, used
    raise AIUnavailableError("Перевод испортил формулы или рисунки — попробуйте ещё раз или переведите вручную")
