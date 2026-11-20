"""Звания по рейтингу — как цвета и звания на Codeforces."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Rank:
    code: str
    icon: str
    name: str
    min_rating: int


RANKS: list[Rank] = [
    Rank("newbie", "🌱", "Новичок", 0),
    Rank("pupil", "📗", "Ученик", 1200),
    Rank("specialist", "🔬", "Знаток", 1400),
    Rank("expert", "🎓", "Эксперт", 1600),
    Rank("candidate", "⭐", "Кандидат в мастера", 1900),
    Rank("master", "🏅", "Мастер", 2100),
    Rank("grandmaster", "🏆", "Гроссмейстер", 2400),
    Rank("legend", "👑", "Легенда", 3000),
]


def rank_for(rating: int | None) -> Rank | None:
    """Звание по рейтингу; None — ещё не участвовал в олимпиадах с опубликованными итогами."""
    if rating is None:
        return None
    return [rank for rank in RANKS if rating >= rank.min_rating][-1]


def badge(rating: int | None) -> dict[str, Any] | None:
    """Звание рядом с именем: код (по нему цвет), иконка, название и сам рейтинг."""
    rank = rank_for(rating)
    if rank is None:
        return None
    return {"code": rank.code, "icon": rank.icon, "name": rank.name, "rating": rating}


def ladder(rating: int | None) -> list[dict[str, Any]]:
    """Лестница званий: какие достигнуты и сколько осталось до следующих."""
    current = rating if rating is not None else 0
    items = []
    for index, rank in enumerate(RANKS):
        upper = RANKS[index + 1].min_rating if index + 1 < len(RANKS) else None
        items.append(
            {
                "code": rank.code,
                "icon": rank.icon,
                "name": rank.name,
                "min_rating": rank.min_rating,
                "max_rating": upper - 1 if upper else None,
                "earned": rating is not None and current >= rank.min_rating,
                "current": rank_for(rating) == rank,
            }
        )
    return items
