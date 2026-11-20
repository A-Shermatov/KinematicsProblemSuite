"""Значки (достижения) ученика. Считаются на лету из истории решений — отдельной таблицы нет."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class BadgeRule:
    code: str
    icon: str
    title: str
    description: str
    metric: str
    target: int


RULES: list[BadgeRule] = [
    BadgeRule("first_solve", "🎯", "Первая задача", "Решите первую задачу", "solved_tasks", 1),
    BadgeRule("solved_10", "📘", "Десятка", "Решите 10 задач", "solved_tasks", 10),
    BadgeRule("solved_50", "📚", "Полсотни", "Решите 50 задач", "solved_tasks", 50),
    BadgeRule("solved_100", "🏛", "Сотня", "Решите 100 задач", "solved_tasks", 100),
    BadgeRule("streak_3", "🔥", "Три дня подряд", "Решайте задачи 3 дня подряд", "best_streak", 3),
    BadgeRule("streak_7", "⚡", "Неделя без пропусков", "Решайте задачи 7 дней подряд", "best_streak", 7),
    BadgeRule("streak_30", "🌋", "Месяц без пропусков", "Решайте задачи 30 дней подряд", "best_streak", 30),
    BadgeRule("theme_master", "🧩", "Мастер темы", "Решите все задачи одной темы (от 3 задач)", "mastered_themes", 1),
    BadgeRule("hard_solver", "🧠", "Олимпиадник", "Решите задачу высшей сложности", "hard_solved", 1),
    BadgeRule("hard_10", "🏆", "Гроза олимпиад", "Решите 10 задач высшей сложности", "hard_solved", 10),
    BadgeRule("olympiad_participant", "🎫", "Участник олимпиады", "Примите участие в олимпиаде", "olympiads", 1),
    BadgeRule("olympiad_prize", "🥉", "Призёр олимпиады", "Займите призовое место на олимпиаде", "olympiad_prizes", 1),
    BadgeRule("olympiad_win", "🥇", "Победитель олимпиады", "Займите первое место на олимпиаде", "olympiad_wins", 1),
]


def evaluate(stats: dict[str, Any]) -> list[dict[str, Any]]:
    badges = []
    for rule in RULES:
        value = int(stats.get(rule.metric) or 0)
        badges.append(
            {
                "code": rule.code,
                "icon": rule.icon,
                "title": rule.title,
                "description": rule.description,
                "earned": value >= rule.target,
                "progress": min(value, rule.target),
                "target": rule.target,
            }
        )
    return badges
