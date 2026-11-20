"""Звания за олимпиады. Других наград нет: звание отражает реальные результаты на олимпиадах.

Призовое место — 1–3 место (с ненулевым баллом) на олимпиаде с опубликованными итогами.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TitleRule:
    code: str
    icon: str
    name: str
    description: str
    metric: str  # prizes | wins
    target: int
    rank: int  # чем больше, тем выше звание


RULES: list[TitleRule] = [
    TitleRule("prize_1", "🥉", "Призёр олимпиады", "Займите призовое место (1–3) на олимпиаде", "prizes", 1, 1),
    TitleRule("prize_3", "🥈", "Трижды призёр", "Займите 3 призовых места", "prizes", 3, 2),
    TitleRule("win_1", "🥇", "Победитель олимпиады", "Займите первое место на олимпиаде", "wins", 1, 3),
    TitleRule("prize_5", "🏅", "Мастер олимпиад", "Займите 5 призовых мест", "prizes", 5, 4),
    TitleRule("win_3", "🏆", "Многократный победитель", "Займите первое место на 3 олимпиадах", "wins", 3, 5),
    TitleRule("prize_10", "👑", "Гроссмейстер олимпиад", "Займите 10 призовых мест", "prizes", 10, 6),
]


def evaluate(prizes: int, wins: int) -> list[dict[str, Any]]:
    values = {"prizes": prizes, "wins": wins}
    return [
        {
            "code": rule.code,
            "icon": rule.icon,
            "name": rule.name,
            "description": rule.description,
            "earned": values[rule.metric] >= rule.target,
            "progress": min(values[rule.metric], rule.target),
            "target": rule.target,
        }
        for rule in RULES
    ]


def best(prizes: int, wins: int) -> dict[str, str] | None:
    """Высшее заработанное звание — показывается рядом с именем."""
    values = {"prizes": prizes, "wins": wins}
    earned = [rule for rule in RULES if values[rule.metric] >= rule.target]
    if not earned:
        return None
    top = max(earned, key=lambda rule: rule.rank)
    return {"code": top.code, "icon": top.icon, "name": top.name}
