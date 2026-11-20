from tests.conftest import ApiClient

TEXT = """## Скорость поезда
Поезд едет со скоростью $v = 72$ км/ч. Найдите скорость поезда в м/с.
Ответ: 20 м/с
---
## Тормоза
Автомобиль тормозит с ускорением 5 м/с² от скорости 20 м/с. Найдите тормозной путь.
Ответ: 40 м
Сложность: 300
---
## Объясните
Почему небо голубое? Объясните явление рассеяния света.
Ответ: рассеяние Рэлея
"""


def upload(name: str, content: bytes) -> dict:
    return {"file": (name, content, "application/octet-stream")}


def test_import_flow(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    existing = client.task(
        teacher,
        theme["id"],
        condition="Автомобиль тормозит с ускорением 5 м/с² от скорости 20 м/с. Найдите тормозной путь.",
    )

    assert (
        client.post("/api/tasks/import/parse", client.student(), files=upload("t.txt", TEXT.encode())).status_code
        == 403
    )
    parsed = client.post("/api/tasks/import/parse", teacher, files=upload("tasks.md", TEXT.encode()))
    assert parsed.status_code == 200, parsed.text
    result = parsed.json()
    assert result["method"] == "file"
    drafts = result["drafts"]
    assert [d["title"] for d in drafts] == ["Скорость поезда", "Тормоза", "Объясните"]
    assert drafts[1]["duplicate"]["id"] == existing["id"]  # такая задача уже есть
    assert drafts[0]["duplicate"] is None and drafts[0]["answer_type"] == "number"
    assert drafts[2]["answer_type"] == "text"

    source = client.post("/api/sources", teacher, json={"type": "book", "title": "Сборник для импорта"}).json()
    items = [
        {
            **{k: d[k] for k in ("title", "condition", "answer", "unit", "answer_type")},
            "difficulty": d["difficulty"] or 100,
        }
        for d in drafts
    ]
    items.append(
        {"title": "Плохой ответ", "condition": "Новая задача без числового ответа, но числовой тип.", "answer": "много"}
    )
    committed = client.post(
        "/api/tasks/import/commit",
        teacher,
        json={"theme_id": theme["id"], "source_id": source["id"], "tasks": items},
    ).json()
    assert len(committed["created"]) == 2
    assert [(f["index"], f["title"]) for f in committed["failed"]] == [(1, "Тормоза"), (3, "Плохой ответ")]
    assert "уже добавляли" in committed["failed"][0]["error"]
    tasks = client.get("/api/tasks", params={"source_id": source["id"]}).json()
    assert sorted(t["title"] for t in tasks) == ["Объясните", "Скорость поезда"]


def test_import_errors(client: ApiClient) -> None:
    teacher = client.teacher()
    assert client.post("/api/tasks/import/parse", teacher, files=upload("x.exe", b"MZ")).status_code == 422
    assert client.post("/api/tasks/import/parse", teacher, files=upload("x.json", b"{oops")).status_code == 422
    assert client.post("/api/tasks/import/parse", teacher, files=upload("empty.txt", b"   ")).status_code == 422
    # Без ключа Claude API фото не распознаются, но файлы работают.
    caps = client.get("/api/tasks/import/capabilities", teacher).json()
    assert caps["ai_enabled"] is False and ".csv" in caps["file_formats"]
    assert client.post("/api/tasks/import/parse", teacher, files=upload("photo.jpg", b"\xff\xd8")).status_code == 503
