"""Расчёт изменения рейтинга после олимпиады — вариант формулы Codeforces (Elo для многих участников).

Идея: по текущим рейтингам считаем, какое место участник «должен был» занять (seed). Если занял место выше
ожидаемого — рейтинг растёт, ниже — падает. Чем сильнее соперники, которых он обошёл, тем больше прибавка.

1. seed_i = 1 + Σ P(j обходит i) — ожидаемое место, P по формуле Elo.
2. Целевое место m_i = √(seed_i · place_i) — среднее геометрическое ожидаемого и фактического.
3. need_i — рейтинг, при котором ожидаемое место равно m_i (бинарный поиск).
4. Δ_i = (need_i − r_i) / 2, затем поправки, чтобы сумма изменений была около нуля и рейтинги не «раздувались».
"""

from __future__ import annotations

import math
from dataclasses import dataclass

INITIAL_RATING = 1200
"""Рейтинг до первой олимпиады."""


@dataclass(frozen=True)
class Participant:
    user_id: int
    rating: int
    place: int  # 1 — лучший; при равенстве баллов и штрафа места одинаковые


def win_probability(rating_a: float, rating_b: float) -> float:
    """Вероятность, что участник с рейтингом a обойдёт участника с рейтингом b."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def _seed(rating: float, others: list[int]) -> float:
    return 1 + sum(win_probability(other, rating) for other in others)


def _rating_for_place(place: float, others: list[int]) -> float:
    """Рейтинг, при котором ожидаемое место среди others равно place."""
    low, high = -2000.0, 8000.0
    for _ in range(60):
        mid = (low + high) / 2
        if _seed(mid, others) < place:  # слишком сильный — ожидаемое место выше нужного
            high = mid
        else:
            low = mid
    return (low + high) / 2


def rating_changes(participants: list[Participant]) -> dict[int, int]:
    """Изменение рейтинга каждого участника; при одном участнике рейтинг не меняется."""
    if len(participants) < 2:
        return {p.user_id: 0 for p in participants}
    deltas: dict[int, float] = {}
    for p in participants:
        others = [o.rating for o in participants if o.user_id != p.user_id]
        expected = _seed(p.rating, others)
        target = math.sqrt(expected * p.place)
        deltas[p.user_id] = (_rating_for_place(target, others) - p.rating) / 2

    n = len(participants)
    # Сумма изменений ≈ 0 (чуть меньше нуля): рейтинг перераспределяется, а не печатается.
    shift = -sum(deltas.values()) / n - 1
    for uid in deltas:
        deltas[uid] += shift
    # Сильнейшие по рейтингу не должны в сумме расти — иначе верх рейтинга медленно инфлирует.
    top = sorted(participants, key=lambda p: -p.rating)[: min(n, max(1, 4 * round(math.sqrt(n))))]
    top_shift = min(max(-sum(deltas[p.user_id] for p in top) / len(top), -10), 0)
    return {uid: round(delta + top_shift) for uid, delta in deltas.items()}
