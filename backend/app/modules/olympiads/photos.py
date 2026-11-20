"""Проверка фото решений на списывание: одинаковые фото у разных участников одной олимпиады.

Два отпечатка:
* sha256 — побайтно тот же файл (переслали фото);
* dHash (перцептивный хеш 64 бита) — то же фото после пересжатия, смены размера или формата.
  Считается только для достаточно больших и не однотонных картинок, иначе совпадения случайны.
"""

from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass

try:  # Pillow есть в образе; без него остаётся только побайтное сравнение.
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]

MIN_SIDE = 64
"""Меньшие картинки не сравниваются по dHash."""
MAX_DISTANCE = 6
"""Сколько бит из 64 может отличаться у «того же» фото."""


@dataclass(frozen=True)
class Fingerprint:
    sha256: str
    phash: int | None


def _dhash(data: bytes) -> int | None:
    if Image is None:
        return None
    try:
        with Image.open(io.BytesIO(data)) as image:
            if min(image.size) < MIN_SIDE:
                return None
            gray = image.convert("L").resize((9, 8))
            pixels = list(gray.getdata())
    except Exception:  # noqa: BLE001 — нечитаемая картинка: сравниваем только побайтно
        return None
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (pixels[row * 9 + col] > pixels[row * 9 + col + 1])
    if bits in (0, (1 << 64) - 1):  # однотонная картинка — у всех одинаковая
        return None
    return bits - (1 << 64) if bits >= 1 << 63 else bits  # в BIGINT со знаком


def fingerprint(data: bytes) -> Fingerprint:
    return Fingerprint(hashlib.sha256(data).hexdigest(), _dhash(data))


def distance(a: int, b: int) -> int:
    return ((a ^ b) & ((1 << 64) - 1)).bit_count()


def same_photo(mine: Fingerprint, other_sha: str | None, other_phash: int | None) -> bool:
    if other_sha and other_sha == mine.sha256:
        return True
    return mine.phash is not None and other_phash is not None and distance(mine.phash, other_phash) <= MAX_DISTANCE
