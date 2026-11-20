"""Исправления условий во время олимпиады: что именно изменилось — для объявления участникам (как на Codeforces)."""

from __future__ import annotations

import difflib
import re
from typing import Any

CONTEXT = 40
"""Сколько символов неизменного текста показывать вокруг правки."""

_TEXT_FIELDS = {"title": "Название", "condition": "Условие", "unit": "Единицы"}
_LANG_LABEL = {"en": "англ.", "tg": "тадж."}


def _tokens(text: str) -> list[str]:
    return [token for token in re.split(r"(\s+)", text) if token]


def _trim(text: str, *, head: bool, tail: bool) -> str:
    """Неизменный кусок между правками: оставляем контекст по краям, середину — «…»."""
    if len(text) <= 2 * CONTEXT:
        return text
    left = text[:CONTEXT] if tail else ""
    right = text[-CONTEXT:] if head else ""
    return f"{left}…{right}"


def text_diff(old: str, new: str) -> list[dict[str, str]]:
    """Пословный дифф: [{op: equal|delete|insert, text}], длинные неизменные куски сокращены."""
    a, b = _tokens(old or ""), _tokens(new or "")
    segments: list[dict[str, str]] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            segments.append({"op": "equal", "text": "".join(a[i1:i2])})
            continue
        if op in ("delete", "replace"):
            segments.append({"op": "delete", "text": "".join(a[i1:i2])})
        if op in ("insert", "replace"):
            segments.append({"op": "insert", "text": "".join(b[j1:j2])})
    for index, segment in enumerate(segments):
        if segment["op"] == "equal":
            segment["text"] = _trim(segment["text"], head=index < len(segments) - 1, tail=index > 0)
    return segments


def changes(old: Any, new: dict[str, Any]) -> list[dict[str, Any]]:
    """Что изменилось в задаче. Ответ во время олимпиады не раскрываем — только факт исправления."""
    result: list[dict[str, Any]] = []
    for field, label in _TEXT_FIELDS.items():
        before, after = old[field] or "", new[field] or ""
        if before.strip() != after.strip():
            result.append({"field": field, "label": label, "diff": text_diff(before, after)})
    old_tr = old["translations"] or {}
    for lang, tr in (new.get("translations") or {}).items():
        before = (old_tr.get(lang) or {}).get("condition", "")
        if before.strip() != (tr.get("condition") or "").strip():
            label = f"Условие ({_LANG_LABEL.get(lang, lang)})"
            result.append({"field": f"condition_{lang}", "label": label, "diff": text_diff(before, tr["condition"])})
    if (old["answer"], old["answer_type"], float(old["tolerance"])) != (
        new["answer"],
        new["answer_type"],
        float(new["tolerance"]),
    ):
        result.append({"field": "answer", "label": "Ответ", "hidden": True})
    if old["max_points"] != new["max_points"]:
        result.append(
            {"field": "max_points", "label": "Баллы", "before": str(old["max_points"]), "after": str(new["max_points"])}
        )
    return result


def summary(label: str, task_title: str, items: list[dict[str, Any]]) -> str:
    """«Исправлено в задаче B «Камень»: условие, ответ (решения перепроверены)»."""
    parts = [item["label"].lower() for item in items]
    text = f"Исправлено в задаче {label} «{task_title}»: {', '.join(parts)}"
    if any(item["field"] == "answer" for item in items):
        text += " (автопроверка пересчитана)"
    return text + "."
