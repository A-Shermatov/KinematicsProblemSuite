"""Задачи с параметрами: в условии {v}, у каждого ученика свои значения, ответ считается по формуле.

Параметр задаётся диапазоном: {"v": {"min": 36, "max": 108, "step": 18}}. Значения детерминированы для пары
(задача, ученик) — при перезагрузке страницы числа не меняются. Формула ответа — арифметика и функции
(sqrt, sin, cos, tan, asin, acos, atan, ln, log10, exp, abs, pi, e) без доступа к Python: разбирается через ast.
"""

from __future__ import annotations

import ast
import hashlib
import math
import operator
import random
import re
from typing import Any

NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,15}$")
PLACEHOLDER = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]{0,15})\}")
MAX_PARAMS = 6
MAX_VALUES = 1000

_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCTIONS = {
    "sqrt": math.sqrt,
    "sin": lambda x: math.sin(math.radians(x)),  # углы в задачах — в градусах
    "cos": lambda x: math.cos(math.radians(x)),
    "tan": lambda x: math.tan(math.radians(x)),
    "asin": lambda x: math.degrees(math.asin(x)),
    "acos": lambda x: math.degrees(math.acos(x)),
    "atan": lambda x: math.degrees(math.atan(x)),
    "ln": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "abs": abs,
}
_CONSTANTS = {"pi": math.pi, "e": math.e}


class ParamError(ValueError):
    pass


def evaluate(formula: str, values: dict[str, float]) -> float:
    """Значение формулы ответа. Имена параметров пишутся как есть или в фигурных скобках: v/3.6 или {v}/3.6."""
    source = PLACEHOLDER.sub(r"\1", formula).replace("^", "**").replace(",", ".")
    try:
        tree = ast.parse(source, mode="eval")
    except SyntaxError as exc:
        raise ParamError("Не удалось разобрать формулу ответа") from exc

    def walk(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, int | float) and not isinstance(node.value, bool):
            return float(node.value)
        if isinstance(node, ast.Name):
            if node.id in values:
                return float(values[node.id])
            if node.id in _CONSTANTS:
                return _CONSTANTS[node.id]
            raise ParamError(f"Неизвестное имя «{node.id}» в формуле")
        if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
            left, right = walk(node.left), walk(node.right)
            if isinstance(node.op, ast.Pow) and abs(right) > 100:
                raise ParamError("Слишком большая степень в формуле")
            return _BINARY[type(node.op)](left, right)
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
            return _UNARY[type(node.op)](walk(node.operand))
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in _FUNCTIONS
            and len(node.args) == 1
            and not node.keywords
        ):
            return float(_FUNCTIONS[node.func.id](walk(node.args[0])))
        raise ParamError("В формуле разрешены числа, параметры, + − × ÷ ^ и функции sqrt, sin, cos, ln…")

    try:
        result = walk(tree)
    except (ZeroDivisionError, OverflowError, ValueError) as exc:
        if isinstance(exc, ParamError):
            raise
        raise ParamError("Формула не вычисляется при этих значениях параметров") from exc
    if not math.isfinite(result):
        raise ParamError("Формула не вычисляется при этих значениях параметров")
    return result


def choices(spec: dict[str, Any]) -> list[float]:
    low, high, step = float(spec["min"]), float(spec["max"]), float(spec["step"])
    count = int(math.floor((high - low) / step + 1e-9)) + 1
    return [round(low + i * step, 10) for i in range(count)]


def validate(params: dict[str, dict[str, Any]], formula: str) -> None:
    if len(params) > MAX_PARAMS:
        raise ParamError(f"Не больше {MAX_PARAMS} параметров")
    for name, spec in params.items():
        if not NAME.match(name) or name in _FUNCTIONS or name in _CONSTANTS:
            raise ParamError(f"Недопустимое имя параметра «{name}»: латинские буквы и цифры, например v0")
        try:
            low, high, step = float(spec["min"]), float(spec["max"]), float(spec["step"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ParamError(f"У параметра «{name}» нужны min, max и step") from exc
        if step <= 0 or high < low:
            raise ParamError(f"У параметра «{name}»: step > 0 и max ≥ min")
        if (high - low) / step + 1 > MAX_VALUES:
            raise ParamError(f"У параметра «{name}» слишком много значений (до {MAX_VALUES})")
    if not formula.strip():
        raise ParamError("Укажите формулу ответа")
    # Формула должна считаться на крайних значениях всех параметров.
    for pick in (0, -1):
        evaluate(formula, {name: choices(spec)[pick] for name, spec in params.items()})


def values_for(task_id: int, user_id: int | None, params: dict[str, dict[str, Any]]) -> dict[str, float]:
    """Значения параметров для ученика. Гость видит вариант «0»."""
    seed = hashlib.sha256(f"{task_id}:{user_id or 0}".encode()).digest()
    rng = random.Random(seed)
    return {name: rng.choice(choices(spec)) for name, spec in sorted(params.items())}


def format_number(value: float) -> str:
    text = f"{value:.10g}"
    if "e" in text:
        mantissa, exponent = text.split("e")
        return f"{mantissa}·10^{int(exponent)}"
    return text


def render(text: str, values: dict[str, float]) -> str:
    """Подставляет значения в условие: {v} → 72."""
    return PLACEHOLDER.sub(lambda m: format_number(values[m.group(1)]) if m.group(1) in values else m.group(0), text)


def expected_answer(formula: str, values: dict[str, float]) -> str:
    return f"{evaluate(formula, values):.10g}"
