"""Импорт задач: из файла (JSON, CSV, текст, Word) или с фото/PDF через ИИ.

Двухшаговый процесс: /parse возвращает черновики (ничего не сохраняя) с отметками о дублях,
учитель правит и подтверждает, /commit создаёт выбранные задачи.
"""

from __future__ import annotations

import re
from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from app.deps import Conn, SettingsDep, Staff
from app.modules.content.router import find_duplicates, insert_task
from app.modules.content.schemas import TaskIn
from app.modules.imports import ai
from app.modules.imports.parsers import AI_FORMATS, TEXT_FORMATS, ImportFormatError, parse_file
from app.modules.imports.schemas import (
    ImportFailure,
    ImportIn,
    ImportResult,
    ParseResult,
    TaskDraft,
    TranslateIn,
    TranslateOut,
)
from app.modules.imports.translate import translate as translate_fields
from app.storage import public_url, save_image

router = APIRouter(prefix="/tasks/import", tags=["import"])

MAX_IMPORT_BYTES = 10 * 1024 * 1024
_NUMBER = re.compile(r"^\s*[-+−]?\d")


def _answer_type(answer: str) -> str:
    return "number" if not answer or _NUMBER.match(answer) else "text"


@router.get("/capabilities")
async def capabilities(_: Staff) -> dict[str, object]:
    """Какие форматы доступны: фото и PDF — только если настроен ключ Gemini API."""
    return {
        "file_formats": sorted(TEXT_FORMATS),
        "ai_formats": sorted(AI_FORMATS),
        "ai_enabled": ai.ai_enabled(),
        "ai_models": await ai.model_choices(),
    }


@router.post("/parse", response_model=ParseResult)
async def parse(
    file: Annotated[UploadFile, File()],
    _: Staff,
    conn: Conn,
    model: Annotated[str | None, Form(description="Модель Gemini для фото/PDF; auto — по умолчанию")] = None,
) -> ParseResult:
    extension = PurePath(file.filename or "").suffix.lower()
    if extension not in TEXT_FORMATS and extension not in AI_FORMATS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Поддерживаются JSON, CSV, TXT, Markdown, Word (.docx), а также фото (PNG, JPG, WebP) и PDF",
        )
    content = await file.read(MAX_IMPORT_BYTES + 1)
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл больше 10 МБ")
    if model and model != ai.AUTO and model not in ai.configured_models():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Эта модель недоступна для распознавания")
    notes = ""
    used_model: str | None = None
    try:
        if extension in TEXT_FORMATS:
            method = "file"
            raw = parse_file(extension, content)
        else:
            method = "ai"
            raw, notes, used_model = await ai.recognize(content, AI_FORMATS[extension], model)
    except ImportFormatError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from None
    except ai.AIUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from None

    drafts = []
    for item in raw:
        found = await find_duplicates(conn, item["title"], item["condition"], None, limit=3)
        drafts.append(
            TaskDraft(
                **item,
                answer_type=_answer_type(item["answer"]),
                duplicate=found.exact,
                similar=found.similar,
            )
        )
    return ParseResult(method=method, drafts=drafts, notes=notes, model=used_model)


def _error_text(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        return str(exc.detail)
    if isinstance(exc, ValidationError):
        return "; ".join(str(error["msg"]).removeprefix("Value error, ") for error in exc.errors())
    return "Не удалось сохранить задачу"


@router.post("/commit", response_model=ImportResult)
async def commit(data: ImportIn, user: Staff, conn: Conn) -> ImportResult:
    """Создаёт задачи по одной: ошибка в одной (дубль, неверный ответ) не мешает остальным."""
    created: list[int] = []
    failed: list[ImportFailure] = []
    for index, item in enumerate(data.tasks):
        try:
            task = TaskIn(
                theme_id=data.theme_id,
                title=item.title,
                condition=item.condition,
                difficulty=item.difficulty,
                check_mode=data.check_mode,
                answer_type=item.answer_type,
                answer=item.answer,
                unit=item.unit,
                source_id=data.source_id,
                source_number=item.source_number,
                is_original=data.is_original,
            )
            created.append(await insert_task(conn, task, user))
        except (HTTPException, ValidationError) as exc:
            failed.append(ImportFailure(index=index, title=item.title, error=_error_text(exc)))
    return ImportResult(created=created, failed=failed)


@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_condition_image(
    file: Annotated[UploadFile, File()], _: Staff, settings: SettingsDep
) -> dict[str, str]:
    """Рисунок к условию задачи (схема, график). Возвращает URL для вставки в Markdown: ![рисунок](url)."""
    path = await save_image(file, upload_dir=settings.upload_dir, subdir="tasks", max_bytes=settings.max_upload_bytes)
    return {"url": public_url(path) or ""}


@router.post("/translate", response_model=TranslateOut)
async def translate(data: TranslateIn, _: Staff) -> TranslateOut:
    """Перевод условия (ИИ) с сохранением формул, параметров и рисунков — для вкладок EN/TJ в редакторе."""
    if data.source == data.target:
        raise HTTPException(422, detail="Выберите другой язык перевода")
    fields = {"title": data.title, "condition": data.condition, "hints": data.hints, "explanation": data.explanation}
    try:
        result, model = await translate_fields(fields, data.source, data.target, data.model)
    except ai.AIUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from None
    return TranslateOut(**result, model=model)
