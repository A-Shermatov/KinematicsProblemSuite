"""Сохранение загруженных картинок на диск. Отдаются статикой по /uploads/…"""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

# Проверяем «магические байты», а не только расширение файла.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    "webp": (b"RIFF",),
}

UPLOAD_URL_PREFIX = "/uploads"


def _detect_image_type(head: bytes) -> str | None:
    for ext, signatures in _SIGNATURES.items():
        if any(head.startswith(sig) for sig in signatures):
            if ext == "webp" and head[8:12] != b"WEBP":
                continue
            return ext
    return None


async def save_image(upload: UploadFile, *, upload_dir: Path, subdir: str, max_bytes: int) -> str:
    """Сохраняет картинку и возвращает относительный путь вида «attempts/ab12….png»."""
    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            413,
            detail=f"Файл больше {max_bytes // (1024 * 1024)} МБ",
        )
    ext = _detect_image_type(data[:16])
    if ext is None:
        raise HTTPException(415, detail="Можно загружать только PNG, JPEG, GIF или WebP")

    target_dir = upload_dir / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (target_dir / name).write_bytes(data)
    return f"{subdir}/{name}"


def delete_file(upload_dir: Path, relative_path: str | None) -> None:
    if not relative_path:
        return
    path = (upload_dir / relative_path).resolve()
    if upload_dir.resolve() in path.parents and path.is_file():
        path.unlink()


def public_url(relative_path: str | None) -> str | None:
    return f"{UPLOAD_URL_PREFIX}/{relative_path}" if relative_path else None
