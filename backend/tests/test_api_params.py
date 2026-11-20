import pytest

from app.modules.content import params as p
from tests.conftest import ApiClient

PARAMS = {"v": {"min": 36, "max": 144, "step": 18}}
CONDITION = "Поезд едет со скоростью {v} км/ч. Найдите скорость поезда в м/с."


def test_formula_engine() -> None:
    assert p.evaluate("{v} / 3.6", {"v": 72}) == pytest.approx(20)
    assert p.evaluate("sqrt(2*g*h)", {"g": 10, "h": 20}) == pytest.approx(20)
    assert p.evaluate("v^2 + sin(30)", {"v": 3}) == pytest.approx(9.5)
    for bad in ("__import__('os')", "v.real", "[1]", "x + 1", "2 ** 1000", "1/0"):
        with pytest.raises(p.ParamError):
            p.evaluate(bad, {"v": 1})
    assert p.values_for(1, 7, PARAMS) == p.values_for(1, 7, PARAMS)  # одни и те же числа при повторе
    assert p.render("{v} км/ч, {unknown}", {"v": 72.0}) == "72 км/ч, {unknown}"
    assert p.format_number(0.000012) == "1.2·10^-5"


def make_task(client: ApiClient, **extra: object) -> tuple[str, dict]:
    teacher = client.teacher()
    theme = client.theme()
    payload = {
        "theme_id": theme["id"],
        "title": "Поезд",
        "condition": CONDITION,
        "unit": "м/с",
        "params": PARAMS,
        "answer_formula": "v / 3.6",
        **extra,
    }
    response = client.post("/api/tasks", teacher, json=payload)
    assert response.status_code == 201, response.text
    return teacher, response.json()


def test_parametric_task(client: ApiClient) -> None:
    teacher, task = make_task(client)
    assert task["params"]["v"]["step"] == 18 and task["answer_formula"] == "v / 3.6"
    assert task["answer"] == "10"  # пример для минимальных значений (36 км/ч)

    students = [client.student(f"st{i}") for i in range(6)]
    shown = {}
    for token in students:
        page = client.get(f"/api/tasks/{task['id']}", token).json()
        assert page["is_parametric"] and "{v}" not in page["condition"]
        speed = float(page["condition"].split("скоростью ")[1].split(" ")[0])
        shown[token] = speed
        # Повторный запрос — те же числа.
        assert client.get(f"/api/tasks/{task['id']}", token).json()["condition"] == page["condition"]
    assert len(set(shown.values())) > 1, "у разных учеников должны быть разные числа"

    token, speed = next(iter(shown.items()))
    other = next(v for v in shown.values() if v != speed)
    wrong = client.attempt(token, task["id"], f"{other / 3.6:.4f}").json()
    assert wrong["status"] == "incorrect"
    right = client.attempt(token, task["id"], f"{speed / 3.6:.4f}").json()
    assert right["status"] == "correct"
    assert float(right["correct_answer"]) == pytest.approx(speed / 3.6)
    # Подсказка о единицах работает и для личного ответа: ученик ответил в км/ч.
    assert "км/ч и м/с" in client.attempt(students[1], task["id"], f"{shown[students[1]]}").json()["feedback"]

    # Учитель видит шаблон.
    assert client.get(f"/api/tasks/{task['id']}/full", teacher).json()["condition"] == CONDITION


def test_parametric_validation(client: ApiClient) -> None:
    teacher = client.teacher()
    theme = client.theme()
    base = {"theme_id": theme["id"], "title": "Т", "condition": CONDITION}
    cases = [
        {"params": PARAMS, "answer_formula": ""},
        {"params": PARAMS, "answer_formula": "x / 3.6"},
        {"params": {"1v": {"min": 1, "max": 2, "step": 1}}, "answer_formula": "1"},
        {"params": {"v": {"min": 5, "max": 1, "step": 1}}, "answer_formula": "v"},
        {"params": {"v": {"min": 0, "max": 10, "step": 1}}, "answer_formula": "1 / v"},
        {"params": {"v": {"min": 0, "max": 1e6, "step": 1}}, "answer_formula": "v"},
    ]
    for case in cases:
        assert client.post("/api/tasks", teacher, json={**base, **case}).status_code == 422, case
