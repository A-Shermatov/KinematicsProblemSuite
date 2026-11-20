import pytest

from app.modules.solutions.checker import (
    check_answer,
    parse_quantity,
    parse_unit,
    validate_expected_answer,
)


def number(student: str, expected: str = "20", unit: str | None = "м/с", tolerance: float = 0.01) -> bool:
    return check_answer(student, expected=expected, answer_type="number", unit=unit, tolerance=tolerance).correct


@pytest.mark.parametrize(
    "student",
    [
        "20",
        "20.0",
        "20,0",
        " 20 ",
        "2e1",
        "2·10^1",
        "2*10^1",
        "2 × 10^(1)",
        "20 м/с",
        "20м/с",
        "20 m/s",
        "72 км/ч",
        "72 km/h",
        "2000 см/с",
        "20 м/c",
        "20.1",
        "19.9",
    ],
)
def test_number_accepted(student: str) -> None:
    assert number(student)


@pytest.mark.parametrize("student", ["21", "-20", "20 м", "20 м/с^2", "20 кг", "abc", "", "2 10^1", "20 парсек"])
def test_number_rejected(student: str) -> None:
    assert not number(student)


def test_tolerance_is_relative() -> None:
    assert number("1000.5", expected="1000", unit=None, tolerance=0.001)
    assert not number("1002", expected="1000", unit=None, tolerance=0.001)


def test_zero_expected_value() -> None:
    assert number("0", expected="0", unit=None)
    assert number("0.0 м/с", expected="0")
    assert not number("0.001", expected="0", unit=None)


def test_unit_inside_expected_answer() -> None:
    assert number("9.8 м/с²", expected="9.8 м/с^2", unit=None)
    assert number("980 см/с^2", expected="9.8 м/с^2", unit=None)


def test_dimensionless_task_rejects_units() -> None:
    assert not number("5 м", expected="5", unit=None)
    assert number("5", expected="5", unit=None)


def test_fraction_and_negative_numbers() -> None:
    assert number("1/2", expected="0.5", unit=None)
    assert number("−3", expected="-3", unit=None)


def test_feedback_messages() -> None:
    result = check_answer("20 кг", expected="20", answer_type="number", unit="м/с", tolerance=0.01)
    assert result.feedback == "Неверная размерность ответа"
    result = check_answer("двадцать", expected="20", answer_type="number", unit="м/с", tolerance=0.01)
    assert "числом" in result.feedback


def test_text_answers() -> None:
    def text(student: str, expected: str) -> bool:
        return check_answer(student, expected=expected, answer_type="text", unit=None, tolerance=0).correct

    assert text("  Ёлка ", "елка")
    assert text("вверх", "вверх|up")
    assert text("UP", "вверх|up")
    assert not text("вниз", "вверх|up")


def test_parse_unit_compound() -> None:
    factor, dims = parse_unit("кг·м/с²")
    assert factor == 1.0
    assert dims == (1, 1, -2)
    factor, dims = parse_unit("км/ч")
    assert factor == pytest.approx(1000 / 3600)
    assert dims == (1, 0, -1)


def test_parse_quantity() -> None:
    quantity = parse_quantity("1,5·10^-3 км")
    assert quantity.value == pytest.approx(1.5e-3)
    assert quantity.unit == "км"


@pytest.mark.parametrize(
    ("answer", "answer_type", "unit"),
    [("abc", "number", None), ("5", "number", "попугаи"), ("", "text", None)],
)
def test_validate_expected_answer_rejects(answer: str, answer_type: str, unit: str | None) -> None:
    with pytest.raises(ValueError):
        validate_expected_answer(answer, answer_type, unit)


def test_validate_expected_answer_accepts() -> None:
    validate_expected_answer("9.8", "number", "м/с^2")
    validate_expected_answer("12 км", "number", None)
    validate_expected_answer("вверх", "text", None)
