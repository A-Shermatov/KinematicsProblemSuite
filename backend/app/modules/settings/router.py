from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.deps import Conn
from app.modules.settings import service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def public_settings(conn: Conn) -> dict[str, Any]:
    """Публичные настройки, нужные интерфейсу: шкала сложности, требования к паролю, поле страны."""
    settings = await service.load(conn)
    return {
        **settings.model_dump(),
        "difficulty_step": service.DIFFICULTY_STEP,
        "difficulty_levels": service.difficulty_levels(settings),
    }
