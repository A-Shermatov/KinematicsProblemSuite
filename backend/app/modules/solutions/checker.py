"""Автопроверка ответов: числа с погрешностью, единицы измерения и их перевод.

Примеры ответов, которые считаются одинаковыми для задачи с ответом «20 м/с»:
    "20", "20.0", "20,0", "2e1", "2·10^1", "20 м/с", "20м/с", "72 км/ч", "20 m/s"
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

# Размерность: показатели степени (длина, масса, время).
Dims = tuple[int, int, int]

_L: Dims = (1, 0, 0)
_M: Dims = (0, 1, 0)
_T: Dims = (0, 0, 1)

# Базовые единицы: множитель к СИ и размерность. Русские и латинские обозначения.
_BASE_UNITS: dict[str, tuple[float, Dims]] = {
    # длина
    "m": (1.0, _L),
    "м": (1.0, _L),
    "km": (1e3, _L),
    "км": (1e3, _L),
    "dm": (0.1, _L),
    "дм": (0.1, _L),
    "cm": (1e-2, _L),
    "см": (1e-2, _L),
    "mm": (1e-3, _L),
    "мм": (1e-3, _L),
    # масса
    "kg": (1.0, _M),
    "кг": (1.0, _M),
    "g": (1e-3, _M),
    "г": (1e-3, _M),
    "t": (1e3, _M),
    "т": (1e3, _M),
    # время
    "s": (1.0, _T),
    "с": (1.0, _T),
    "сек": (1.0, _T),
    "sec": (1.0, _T),
    "c": (1.0, _T),  # латинская «c» вместо кириллической «с» — частая опечатка
    "ms": (1e-3, _T),
    "мс": (1e-3, _T),
    "min": (60.0, _T),
    "мин": (60.0, _T),
    "h": (3600.0, _T),
    "ч": (3600.0, _T),
    # производные
    "n": (1.0, (1, 1, -2)),
    "н": (1.0, (1, 1, -2)),
    "j": (1.0, (2, 1, -2)),
    "дж": (1.0, (2, 1, -2)),
    "kj": (1e3, (2, 1, -2)),
    "кдж": (1e3, (2, 1, -2)),
    "w": (1.0, (2, 1, -3)),
    "вт": (1.0, (2, 1, -3)),
    "kw": (1e3, (2, 1, -3)),
    "квт": (1e3, (2, 1, -3)),
    "hz": (1.0, (0, 0, -1)),
    "гц": (1.0, (0, 0, -1)),
    "rad": (1.0, (0, 0, 0)),
    "рад": (1.0, (0, 0, 0)),
}

_SUPERSCRIPTS = str.maketrans({"²": "^2", "³": "^3", "⁻": "^-", "¹": "1"})
_MINUS = str.maketrans({"−": "-", "–": "-", "—": "-"})

_NUMBER_RE = re.compile(
    r"""^\s*
    (?P<mantissa>[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)?
    \s*
    (?:(?P<times>[*·×xх])?\s*10\s*\^\s*\(?\s*(?P<exp>[+-]?\d+)\s*\)?)?
    (?P<rest>.*)$""",
    re.VERBOSE,
)
_FRACTION_RE = re.compile(r"^\s*([+-]?\d+)\s*/\s*(\d+)\s*$")


@dataclass(frozen=True)
class Quantity:
    value: float
    unit: str | None  # как написано (нормализовано), None — без единиц


@dataclass(frozen=True)
class CheckResult:
    correct: bool
    feedback: str


class UnitError(ValueError):
    pass


def _normalize_text(text: str) -> str:
    text = text.translate(_MINUS).replace("ё", "е").replace("Ё", "Е")
    return re.sub(r"\s+", " ", text).strip().lower()


def parse_unit(unit: str) -> tuple[float, Dims]:
    """Разбирает выражение вида «м/с^2», «км/ч», «кг·м/с²», «Н*м»."""
    expr = _normalize_text(unit).translate(_SUPERSCRIPTS).replace(" ", "").replace("·", "*").replace("×", "*")
    expr = expr.rstrip(".")
    if not expr:
        raise UnitError("пустые единицы")

    factor = 1.0
    dims = [0, 0, 0]
    for index, group in enumerate(expr.split("/")):
        sign = 1 if index == 0 else -1
        for part in group.split("*"):
            if not part:
                raise UnitError(unit)
            match = re.fullmatch(r"([a-zа-я]+)(?:\^?(-?\d+))?", part)
            if not match or match.group(1) not in _BASE_UNITS:
                raise UnitError(unit)
            power = int(match.group(2) or 1) * sign
            base_factor, base_dims = _BASE_UNITS[match.group(1)]
            factor *= base_factor**power
            for i in range(3):
                dims[i] += base_dims[i] * power
    return factor, (dims[0], dims[1], dims[2])


def parse_quantity(text: str) -> Quantity:
    """Число (+ необязательные единицы). Бросает ValueError, если числа нет."""
    raw = _normalize_text(text)
    fraction = _FRACTION_RE.match(raw)
    if fraction:
        denominator = int(fraction.group(2))
        if denominator == 0:
            raise ValueError("деление на ноль")
        return Quantity(int(fraction.group(1)) / denominator, None)

    match = _NUMBER_RE.match(raw)
    if not match or (match.group("mantissa") is None and match.group("exp") is None):
        raise ValueError("не число")
    mantissa_raw = match.group("mantissa")
    if mantissa_raw is not None and match.group("exp") is not None and match.group("times") is None:
        # «2 10^3» без знака умножения — не принимаем, это скорее опечатка.
        raise ValueError("не число")
    mantissa = float(mantissa_raw.replace(",", ".")) if mantissa_raw is not None else 1.0
    exponent = int(match.group("exp")) if match.group("exp") is not None else 0
    value = mantissa * 10.0**exponent
    if not math.isfinite(value):
        raise ValueError("не число")
    rest = match.group("rest").strip()
    return Quantity(value, rest or None)


def _to_si(quantity: Quantity, fallback_unit: str | None) -> tuple[float, Dims | None]:
    unit = quantity.unit or fallback_unit
    if not unit:
        return quantity.value, None
    factor, dims = parse_unit(unit)
    return quantity.value * factor, dims


def check_number(student: str, expected: str, unit: str | None, tolerance: float) -> CheckResult:
    try:
        student_q = parse_quantity(student)
    except ValueError:
        return CheckResult(False, "Ответ должен быть числом, например 12.5 или 1,2·10^3")
    expected_q = parse_quantity(expected)
    expected_unit = expected_q.unit or unit

    if student_q.unit and expected_unit:
        try:
            student_si, student_dims = _to_si(student_q, None)
        except UnitError:
            if _normalize_text(student_q.unit) == _normalize_text(expected_unit):
                student_si, student_dims = student_q.value, None
                expected_si, expected_dims = expected_q.value, None
            else:
                return CheckResult(False, f"Не удалось распознать единицы «{student_q.unit}»")
        else:
            expected_si, expected_dims = _to_si(expected_q, unit)
            if student_dims != expected_dims:
                return CheckResult(False, "Неверная размерность ответа")
    elif student_q.unit and not expected_unit:
        try:
            _, student_dims = parse_unit(student_q.unit)
        except UnitError:
            return CheckResult(False, f"Не удалось распознать единицы «{student_q.unit}»")
        if student_dims != (0, 0, 0):
            return CheckResult(False, "В этой задаче ответ безразмерный")
        student_si, expected_si = _to_si(student_q, None)[0], expected_q.value
    else:
        # Единицы не указаны — считаем, что ответ дан в единицах задачи.
        student_si, expected_si = student_q.value, expected_q.value

    tol = max(tolerance, 1e-9)
    if math.isclose(student_si, expected_si, rel_tol=tol, abs_tol=1e-12):
        return CheckResult(True, "Верно!")
    return CheckResult(False, "Неверно, попробуйте ещё раз")


def check_text(student: str, expected: str) -> CheckResult:
    """Текстовый ответ. Несколько допустимых вариантов в задаче разделяются символом «|»."""
    answer = _normalize_text(student)
    options = {_normalize_text(option) for option in expected.split("|") if option.strip()}
    if answer in options:
        return CheckResult(True, "Верно!")
    return CheckResult(False, "Неверно, попробуйте ещё раз")


def check_answer(student: str, *, expected: str, answer_type: str, unit: str | None, tolerance: float) -> CheckResult:
    if not student.strip():
        return CheckResult(False, "Пустой ответ")
    if answer_type == "number":
        return check_number(student, expected, unit, tolerance)
    return check_text(student, expected)


def validate_expected_answer(answer: str, answer_type: str, unit: str | None) -> None:
    """Проверка ответа задачи при её создании учителем — чтобы автопроверка потом не падала."""
    if answer_type != "number":
        if not answer.strip():
            raise ValueError("Ответ не может быть пустым")
        return
    try:
        quantity = parse_quantity(answer)
    except ValueError as exc:
        raise ValueError("Числовой ответ задачи должен быть числом, например 12.5 или 1.2e3") from exc
    effective_unit = quantity.unit or unit
    if effective_unit:
        try:
            parse_unit(effective_unit)
        except UnitError as exc:
            raise ValueError(f"Неизвестные единицы «{effective_unit}»") from exc


# ---------- Подсказки к неверному ответу ----------


def _comparable(student: str, expected: str, unit: str | None) -> tuple[float, float] | None:
    """Значения ответа ученика и эталона в одних единицах — или None, если сравнить нельзя."""
    try:
        student_q = parse_quantity(student)
        expected_q = parse_quantity(expected)
    except ValueError:
        return None
    try:
        if student_q.unit and (expected_q.unit or unit):
            student_si, student_dims = _to_si(student_q, None)
            expected_si, expected_dims = _to_si(expected_q, unit)
            if student_dims != expected_dims:
                return None
            return student_si, expected_si
    except UnitError:
        return None
    return student_q.value, expected_q.value


def _close(a: float, b: float, rel: float = 0.01) -> bool:
    return math.isclose(a, b, rel_tol=rel)


def mistake_hint(
    student: str,
    *,
    expected: str,
    answer_type: str,
    unit: str | None,
    tolerance: float,
    mistakes: list[dict[str, str]],
) -> str | None:
    """Пояснение к неверному ответу: сначала частые ошибки, которые указал учитель, затем типичные промахи."""
    for mistake in mistakes:
        if check_answer(
            student, expected=mistake["answer"], answer_type=answer_type, unit=unit, tolerance=tolerance
        ).correct:
            return mistake["message"]
    if answer_type != "number":
        return None
    values = _comparable(student, expected, unit)
    if values is None:
        return None
    given, right = values
    if right == 0 or given == 0:
        return None
    ratio = given / right
    if _close(ratio, -1):
        return "Проверьте знак ответа"
    if _close(ratio, 3.6) or _close(ratio, 1 / 3.6):
        return "Похоже, перепутаны км/ч и м/с (1 м/с = 3,6 км/ч)"
    if _close(ratio, 2) or _close(ratio, 0.5):
        return "Ответ отличается ровно в 2 раза — проверьте формулу (например, множитель ½)"
    if _close(ratio, 9.8 / 10, 0.003) or _close(ratio, 10 / 9.8, 0.003) or _close(ratio, 9.81 / 10, 0.003):
        return "Ответ очень близок — проверьте, какое значение g нужно взять (9,8 или 10 м/с²)"
    exponent = round(math.log10(abs(ratio)))
    if exponent != 0 and abs(exponent) <= 9 and _close(abs(ratio), 10.0**exponent):
        return "Порядок величины не тот — проверьте перевод единиц (степени десяти: км → м, г → кг, см² → м²…)"
    return None
