import io
import zipfile

import pytest

from app.modules.imports.ai import extract_json
from app.modules.imports.parsers import ImportFormatError, parse_csv, parse_docx, parse_json, parse_text

TEXT = """## Скорость поезда
Поезд едет со скоростью $v = 72$ км/ч. Найдите скорость в м/с.
Ответ: 20 м/с
Сложность: 2
---
Камень падает с высоты 20 м. Найдите время падения.

$$h = \\frac{g t^2}{2}$$
Ответ: 2 с

Задача 5. Тормозной путь
Автомобиль тормозит.
Ответ: 40
Номер: 5.14
"""


def test_text_blocks() -> None:
    drafts = parse_text(TEXT)
    assert [d["title"] for d in drafts] == ["Скорость поезда", "Камень падает с высоты 20 м", "Тормозной путь"]
    assert drafts[0]["answer"] == "20 м/с" and drafts[0]["difficulty"] == 200
    assert "$$h = \\frac{g t^2}{2}$$" in drafts[1]["condition"] and "Ответ" not in drafts[1]["condition"]
    assert drafts[2]["source_number"] == "5.14"


def test_csv_cp1251_and_semicolon() -> None:
    content = "Название;Условие;Ответ;Сложность\nПоезд;Поезд едет 72 км/ч;20 м/с;300\n".encode("cp1251")
    assert parse_csv(content) == [
        {
            "title": "Поезд",
            "condition": "Поезд едет 72 км/ч",
            "answer": "20 м/с",
            "unit": None,
            "difficulty": 300,
            "source_number": None,
        }
    ]
    with pytest.raises(ImportFormatError):
        parse_csv(b"a,b\n1,2\n")


def test_json_formats() -> None:
    assert parse_json(b'[{"condition": "A", "answer": "1"}]')[0]["title"] == "A"
    assert parse_json('{"tasks": [{"название": "Б", "условие": "В", "ответ": "2"}]}'.encode())[0]["title"] == "Б"
    for bad in (b"{", b"[1, 2]", b"[]"):
        with pytest.raises(ImportFormatError):
            parse_json(bad)


def test_docx() -> None:
    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        "<w:p><w:r><w:t>## Задача из Word</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>Найдите </w:t></w:r><w:r><w:t>массу.</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>Ответ: 5 кг</w:t></w:r></w:p></w:body></w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", xml)
    assert parse_docx(buffer.getvalue())[0] | {} == {
        "title": "Задача из Word",
        "condition": "Найдите массу.",
        "answer": "5 кг",
        "unit": None,
        "difficulty": None,
        "source_number": None,
    }
    with pytest.raises(ImportFormatError):
        parse_docx(b"not a zip")


def test_extract_json_from_model_answer() -> None:
    assert extract_json('Вот:\n```json\n{"tasks": [{"condition": "x"}]}\n```')["tasks"] == [{"condition": "x"}]
    assert extract_json('{"tasks": [], "notes": ""}')["tasks"] == []
    with pytest.raises(ImportFormatError):
        extract_json("не могу прочитать")
