"""Языки платформы. Русский — основной: исходные поля задачи хранятся на нём, переводы — в JSONB translations."""

import json
from typing import Annotated, Any, Literal

from fastapi import Depends, Header
from pydantic import BaseModel, Field, field_validator

Lang = Literal["ru", "en", "tg"]
LANGS: tuple[Lang, ...] = ("ru", "en", "tg")
DEFAULT_LANG: Lang = "ru"
TranslationLang = Literal["en", "tg"]


def parse_lang(x_lang: str | None, accept_language: str | None) -> Lang:
    """X-Lang от нашего фронта важнее Accept-Language браузера; всё неизвестное — русский."""
    for raw in (x_lang, *(accept_language or "").split(",")):
        code = (raw or "").split(";")[0].strip().lower()[:2]
        if code in LANGS:
            return code  # type: ignore[return-value]
    return DEFAULT_LANG


async def get_lang(
    x_lang: Annotated[str | None, Header()] = None,
    accept_language: Annotated[str | None, Header()] = None,
) -> Lang:
    return parse_lang(x_lang, accept_language)


RequestLang = Annotated[Lang, Depends(get_lang)]


class TranslationIn(BaseModel):
    title: str = Field(default="", max_length=150)
    condition: str = Field(default="", max_length=20_000)

    @field_validator("title")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


def clean_translations(translations: dict[TranslationLang, TranslationIn]) -> str:
    """JSON для записи в БД: пустые переводы выбрасываем."""
    return json.dumps(
        {lang: t.model_dump() for lang, t in translations.items() if t.title or t.condition.strip()},
        ensure_ascii=False,
    )


def _loads(value: Any) -> dict[str, dict[str, str]]:
    if isinstance(value, str):
        value = json.loads(value)
    return value or {}


def localize(row: Any, lang: Lang, *, keep_translations: bool = False) -> dict[str, Any]:
    """Подставляет перевод title/condition. Пустое поле перевода — берём русское.

    В ответ добавляет lang — на каком языке фактически показано условие — и available_langs.
    """
    data = dict(row)
    translations = _loads(data.pop("translations", None))
    shown: Lang = DEFAULT_LANG
    tr = translations.get(lang) if lang != DEFAULT_LANG else None
    if tr:
        if tr.get("title"):
            data["title"] = tr["title"]
        if tr.get("condition", "").strip():
            data["condition"] = tr["condition"]
            shown = lang
        elif tr.get("title"):
            shown = lang
    data["lang"] = shown
    data["available_langs"] = [DEFAULT_LANG, *(code for code in LANGS if code in translations)]
    if keep_translations:
        data["translations"] = translations
    return data
