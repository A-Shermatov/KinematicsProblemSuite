"""Разбор файлов с задачами без ИИ: JSON, CSV, текст/Markdown, Word (.docx).

Каждый парсер возвращает список черновиков — словарей с ключами
title, condition, answer, unit, difficulty, source_number. Черновик ничего не сохраняет:
учитель проверяет и правит его на странице импорта, и только потом задачи создаются.
"""

from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from typing import Any
from xml.etree import ElementTree

Draft = dict[str, Any]

# Названия колонок/полей на русском, английском и таджикском.
FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "title": ("title", "name", "название", "заголовок", "ном"),
    "condition": ("condition", "text", "statement", "условие", "текст", "задача", "шарт"),
    "answer": ("answer", "ответ", "ҷавоб"),
    "unit": ("unit", "units", "единицы", "ед", "ед.", "воҳид"),
    "difficulty": ("difficulty", "level", "сложность", "уровень", "мураккабӣ"),
    "source_number": ("number", "source_number", "номер", "№", "рақам"),
}
_ALIAS_TO_FIELD = {alias: field for field, aliases in FIELD_ALIASES.items() for alias in aliases}

MAX_TASKS = 200


class ImportFormatError(ValueError):
    """Файл не удалось разобрать — текст ошибки показывается учителю."""


def _clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _difficulty(value: Any) -> int | None:
    match = re.search(r"\d+", _clean(value))
    if not match:
        return None
    number = int(match.group())
    # Старая шкала 1–5 → 100–500; остальное округляем до сотни.
    if 1 <= number <= 10:
        number *= 100
    number = round(number / 100) * 100
    return number if number >= 100 else None


def _title_from(condition: str) -> str:
    """Название по первой фразе условия, если его не указали."""
    text = re.sub(r"\$+[^$]*\$+", "", condition)  # без формул
    text = re.sub(r"[*_#>`]", "", text).strip()
    first = re.split(r"(?<=[.!?])\s|\n", text, maxsplit=1)[0].strip(" .")
    return (first[:77] + "…") if len(first) > 80 else (first or "Задача")


def normalize_draft(raw: dict[str, Any]) -> Draft:
    data: dict[str, Any] = {}
    for key, value in raw.items():
        field = _ALIAS_TO_FIELD.get(_clean(key).lower())
        if field and field not in data:
            data[field] = value
    condition = _clean(data.get("condition"))
    title = _clean(data.get("title")) or _title_from(condition)
    return {
        "title": title[:150],
        "condition": condition,
        "answer": _clean(data.get("answer")),
        "unit": _clean(data.get("unit")) or None,
        "difficulty": _difficulty(data.get("difficulty")),
        "source_number": _clean(data.get("source_number"))[:30] or None,
    }


def _finish(drafts: list[Draft]) -> list[Draft]:
    drafts = [d for d in drafts if d["condition"] or d["answer"]]
    if not drafts:
        raise ImportFormatError("В файле не найдено ни одной задачи")
    if len(drafts) > MAX_TASKS:
        raise ImportFormatError(f"За один раз можно импортировать не больше {MAX_TASKS} задач")
    return drafts


# ---------- JSON ----------


def parse_json(content: bytes) -> list[Draft]:
    try:
        data = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportFormatError(f"Некорректный JSON: {exc}") from exc
    if isinstance(data, dict):
        data = data.get("tasks", data.get("задачи"))
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise ImportFormatError('Ожидается список задач: [{"title": …, "condition": …, "answer": …}, …]')
    return _finish([normalize_draft(item) for item in data])


# ---------- CSV ----------


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1251"):  # Excel в русской Windows сохраняет CSV в cp1251
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ImportFormatError("Не удалось прочитать файл: сохраните его в кодировке UTF-8")


def parse_csv(content: bytes) -> list[Draft]:
    text = _decode_text(content)
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=";,\t")
    except csv.Error:

        class dialect(csv.excel):  # noqa: N801 — локальный диалект с угаданным разделителем
            delimiter = ";" if text.count(";") > text.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    known = [name for name in (reader.fieldnames or []) if _clean(name).lower() in _ALIAS_TO_FIELD]
    if not any(_ALIAS_TO_FIELD[_clean(name).lower()] in ("condition", "answer") for name in known):
        raise ImportFormatError("В первой строке CSV нужны названия колонок: «Название», «Условие», «Ответ»…")
    return _finish([normalize_draft(row) for row in reader])


# ---------- Текст / Markdown ----------

_SEPARATOR = re.compile(r"^\s*(-{3,}|={3,}|\*{3,})\s*$")
_HEADING = re.compile(r"^\s*(#{1,3}\s+(?P<h>.+)|(?P<n>(задача|task|масъала)\s*№?\s*\d+[.):]?\s*(?P<rest>.*)))$", re.I)
_FIELD_LINE = re.compile(
    r"^\s*(?P<key>ответ|answer|ҷавоб|сложность|difficulty|мураккабӣ|номер|number|рақам|единицы|unit|воҳид)\s*[:：]\s*(?P<value>.+?)\s*$",
    re.I,
)


def parse_text(text: str) -> list[Draft]:
    """Задачи разделяются строкой «---» или заголовком («## Название», «Задача 5. …»).

    Внутри задачи строки «Ответ: …», «Сложность: …», «Номер: …», «Единицы: …» — служебные,
    остальное — условие (Markdown и формулы LaTeX сохраняются как есть).
    """
    blocks: list[dict[str, Any]] = []
    current: dict[str, Any] = {"title": "", "lines": [], "fields": {}}

    def flush() -> None:
        if current["title"] or any(line.strip() for line in current["lines"]) or current["fields"]:
            blocks.append(current.copy())

    for line in text.replace("\r\n", "\n").split("\n"):
        if _SEPARATOR.match(line):
            flush()
            current = {"title": "", "lines": [], "fields": {}}
            continue
        heading = _HEADING.match(line)
        if heading:
            flush()
            title = heading.group("h") or heading.group("rest") or heading.group("n")
            current = {"title": title.strip(), "lines": [], "fields": {}, "numbered": heading.group("n")}
            continue
        field = _FIELD_LINE.match(line)
        if field:
            current["fields"][field.group("key")] = field.group("value")
            continue
        current["lines"].append(line)
    flush()

    drafts = []
    for block in blocks:
        raw = {**block["fields"], "condition": "\n".join(block["lines"]).strip(), "title": block["title"]}
        number = re.search(r"\d+", block.get("numbered") or "")
        if number and "номер" not in {k.lower() for k in block["fields"]}:
            raw["number"] = number.group()
        drafts.append(normalize_draft(raw))
    return _finish(drafts)


# ---------- Word ----------

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_text(content: bytes) -> str:
    """Текст документа Word по абзацам — без сторонних библиотек."""
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            xml = archive.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise ImportFormatError("Файл не похож на документ Word (.docx)") from exc
    root = ElementTree.fromstring(xml)
    paragraphs = []
    for paragraph in root.iter(f"{_W}p"):
        parts = []
        for node in paragraph.iter():
            if node.tag == f"{_W}t" and node.text:
                parts.append(node.text)
            elif node.tag in (f"{_W}tab",):
                parts.append("\t")
            elif node.tag in (f"{_W}br", f"{_W}cr"):
                parts.append("\n")
        paragraphs.append("".join(parts))
    return "\n".join(paragraphs)


def parse_docx(content: bytes) -> list[Draft]:
    return parse_text(docx_text(content))


# ---------- Выбор парсера ----------

TEXT_FORMATS = {".json": "json", ".csv": "csv", ".txt": "text", ".md": "text", ".docx": "docx"}
AI_FORMATS = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def parse_file(extension: str, content: bytes) -> list[Draft]:
    kind = TEXT_FORMATS.get(extension)
    if kind == "json":
        return parse_json(content)
    if kind == "csv":
        return parse_csv(content)
    if kind == "text":
        return parse_text(_decode_text(content))
    if kind == "docx":
        return parse_docx(content)
    raise ImportFormatError("Неподдерживаемый формат файла")
