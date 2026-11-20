from tests.conftest import ApiClient


def test_collections(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    other = client.teacher("other")
    tasks = [client.task(teacher, theme["id"], title=f"Задача {i}") for i in range(3)]
    foreign = client.task(other, theme["id"], title="Чужая")
    ids = [tasks[2]["id"], foreign["id"], tasks[0]["id"], tasks[2]["id"]]  # повтор отбрасывается

    assert client.post("/api/collections", client.student("intruder"), json={"title": "X"}).status_code == 403
    created = client.post("/api/collections", teacher, json={"title": " Кинематика: разминка ", "task_ids": ids})
    assert created.status_code == 201, created.text
    collection = created.json()
    assert (collection["title"], collection["tasks_count"]) == ("Кинематика: разминка", 3)
    bad = client.post("/api/collections", teacher, json={"title": "Плохая", "task_ids": [999999]})
    assert bad.status_code == 422

    student = client.student()
    url = f"/api/collections/{collection['id']}"
    detail = client.get(url, student).json()
    assert [t["id"] for t in detail["tasks"]] == [tasks[2]["id"], foreign["id"], tasks[0]["id"]]
    assert detail["can_edit"] is False and detail["solved_count"] == 0
    client.attempt(student, tasks[0]["id"], "20")
    assert client.get(url, student).json()["solved_count"] == 1
    assert [c["solved_count"] for c in client.get("/api/collections", student).json()] == [1]

    # Скрытая подборка видна только автору.
    hidden = {"title": "Черновик", "is_public": False, "task_ids": [tasks[1]["id"]]}
    assert client.put(url, other, json=hidden).status_code == 403
    assert client.put(url, teacher, json=hidden).status_code == 200
    assert client.get(url, student).status_code == 404
    assert client.get(url, teacher).json()["can_edit"] is True
    assert client.get("/api/collections", student).json() == []
    assert [c["id"] for c in client.get("/api/collections", teacher, params={"mine": True}).json()] == [
        collection["id"]
    ]

    # Удалённая задача пропадает из подборки.
    client.delete(f"/api/tasks/{tasks[1]['id']}", teacher)
    assert client.get(url, teacher).json()["tasks"] == []
    assert client.delete(url, other).status_code == 404  # скрытая подборка для чужих не существует
    assert client.delete(url, teacher).status_code == 204
    assert client.get(url, teacher).status_code == 404


def test_progress_filter(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    solved, tried, fresh = (client.task(teacher, theme["id"], title=f"Задача {i}") for i in range(3))
    student = client.student()
    client.attempt(student, solved["id"], "20")
    client.attempt(student, tried["id"], "1")
    by = lambda progress: [t["id"] for t in client.get("/api/tasks", student, params={"progress": progress}).json()]  # noqa: E731
    assert by("solved") == [solved["id"]]
    assert by("unsolved") == [tried["id"]]
    assert by("new") == [fresh["id"]]
    # Гостю фильтр не применяется.
    assert len(client.get("/api/tasks", params={"progress": "solved"}).json()) == 3
