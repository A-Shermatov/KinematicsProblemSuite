from tests.conftest import ApiClient


def test_subjects_and_themes_crud(client: ApiClient) -> None:
    admin = client.admin_token()
    subject = client.post("/api/admin/subjects", admin, json={"title": "Химия", "position": 3})
    assert subject.status_code == 201
    subject_id = subject.json()["id"]
    assert client.post("/api/admin/subjects", admin, json={"title": "химия"}).status_code == 409

    theme = client.post("/api/admin/themes", admin, json={"subject_id": subject_id, "title": "Растворы"})
    assert theme.status_code == 201
    assert theme.json()["subject_title"] == "Химия"

    themes = client.get("/api/themes", params={"subject_id": subject_id}).json()
    assert [t["title"] for t in themes] == ["Растворы"]
    assert client.get("/api/subjects").json()[0]["themes_count"] == 1

    # Предмет с темами удалить нельзя, сначала темы.
    assert client.delete(f"/api/admin/subjects/{subject_id}", admin).status_code == 409
    assert client.delete(f"/api/admin/themes/{theme.json()['id']}", admin).status_code == 204
    assert client.delete(f"/api/admin/subjects/{subject_id}", admin).status_code == 204
    assert client.get(f"/api/subjects/{subject_id}").status_code == 404


def test_only_admin_edits_structure(client: ApiClient) -> None:
    teacher = client.teacher()
    assert client.post("/api/admin/subjects", teacher, json={"title": "Химия"}).status_code == 403
    assert client.post("/api/admin/themes", teacher, json={"subject_id": 1, "title": "X"}).status_code == 403


def test_theme_for_missing_subject(client: ApiClient) -> None:
    response = client.post("/api/admin/themes", client.admin_token(), json={"subject_id": 999, "title": "X"})
    assert response.status_code == 404


def test_task_answer_is_hidden_from_students(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    task = client.task(teacher, theme["id"])
    assert task["answer"] == "20"

    student = client.student()
    public = client.get(f"/api/tasks/{task['id']}", student).json()
    assert "answer" not in public
    assert public["unit"] == "м/с"
    assert public["solved"] is False
    assert client.get(f"/api/tasks/{task['id']}/full", student).status_code == 403
    assert client.get(f"/api/tasks/{task['id']}/full", teacher).json()["answer"] == "20"


def test_tasks_filters(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    client.task(teacher, theme["id"], title="Лёгкая", difficulty=100)
    client.task(teacher, theme["id"], title="Сложная", difficulty=500)

    assert len(client.get("/api/tasks", params={"theme_id": theme["id"]}).json()) == 2
    hard = client.get("/api/tasks", params={"difficulty": 500}).json()
    assert [t["title"] for t in hard] == ["Сложная"]
    found = client.get("/api/tasks", params={"search": "лёгк"}).json()
    assert [t["title"] for t in found] == ["Лёгкая"]


def test_teacher_edits_only_own_tasks(client: ApiClient) -> None:
    theme = client.theme()
    owner = client.teacher("owner")
    stranger = client.teacher("stranger")
    task = client.task(owner, theme["id"])

    update = {"theme_id": theme["id"], "title": "Новое", "answer": "5", "unit": "м"}
    assert client.put(f"/api/tasks/{task['id']}", stranger, json=update).status_code == 403
    response = client.put(f"/api/tasks/{task['id']}", owner, json=update)
    assert response.status_code == 200
    assert response.json()["title"] == "Новое"

    assert client.delete(f"/api/tasks/{task['id']}", stranger).status_code == 403
    assert client.delete(f"/api/tasks/{task['id']}", client.admin_token()).status_code == 204
    assert client.get(f"/api/tasks/{task['id']}").status_code == 404


def test_task_validation(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    base = {"theme_id": theme["id"], "title": "Задача"}
    assert client.post("/api/tasks", teacher, json={**base, "answer": "двадцать"}).status_code == 422
    assert client.post("/api/tasks", teacher, json={**base, "answer": "5", "unit": "попугаи"}).status_code == 422
    assert client.post("/api/tasks", teacher, json={**base, "answer": "5", "difficulty": 150}).status_code == 422
    # Для ручной проверки ответ может быть любым текстом.
    response = client.post("/api/tasks", teacher, json={**base, "answer": "см. решение", "check_mode": "manual"})
    assert response.status_code == 201
    assert client.post("/api/tasks", client.student(), json={**base, "answer": "5"}).status_code == 403


def test_theme_with_tasks_cannot_be_deleted(client: ApiClient) -> None:
    theme = client.theme()
    client.task(client.teacher(), theme["id"])
    assert client.delete(f"/api/admin/themes/{theme['id']}", client.admin_token()).status_code == 409


def test_task_source(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    book = client.post(
        "/api/sources",
        teacher,
        json={"type": "book", "title": "  Рымкевич.   Задачник по физике ", "author": "А. П. Рымкевич", "year": 2019},
    )
    assert book.status_code == 201, book.text
    book = book.json()
    assert book["title"] == "Рымкевич. Задачник по физике" and book["tasks_count"] == 0

    task = client.task(teacher, theme["id"], source_id=book["id"], source_number=" 123 ")
    second = client.task(teacher, theme["id"], title="Вторая из книги", source_id=book["id"], source_number="124")
    assert task["source_title"] == "Рымкевич. Задачник по физике"
    assert task["source_number"] == "123"

    public = client.get(f"/api/tasks/{task['id']}").json()
    assert (public["source_type"], public["source_year"], public["source_author"]) == ("book", 2019, "А. П. Рымкевич")

    own = client.task(teacher, theme["id"], title="Авторская", is_original=True)
    assert (own["source_type"], own["source_title"]) == ("own", None)

    assert {t["id"] for t in client.get("/api/tasks", params={"source_type": "book"}).json()} == {
        task["id"],
        second["id"],
    }
    assert [t["id"] for t in client.get("/api/tasks", params={"source_type": "own"}).json()] == [own["id"]]
    by_source = client.get("/api/tasks", params={"source_id": book["id"]}).json()
    assert {t["id"] for t in by_source} == {task["id"], second["id"]}
    found = client.get("/api/tasks", params={"search": "рымкевич"}).json()
    assert {t["id"] for t in found} == {task["id"], second["id"]}

    listed = client.get("/api/sources", params={"search": "задачник"}).json()
    assert [(s["id"], s["tasks_count"]) for s in listed] == [(book["id"], 2)]


def test_sources_catalog(client: ApiClient) -> None:
    teacher = client.teacher()
    other = client.teacher("other")
    admin = client.admin_token()
    theme = client.theme()
    payload = {"type": "olympiad", "title": "Республиканская олимпиада", "year": 2021}
    source = client.post("/api/sources", teacher, json=payload).json()
    # Тот же источник (регистр не важен) второй раз не заводится; другой год — другой источник.
    assert client.post("/api/sources", other, json={**payload, "title": "республиканская ОЛИМПИАДА"}).status_code == 409
    assert client.post("/api/sources", other, json={**payload, "year": 2022}).status_code == 201
    assert client.post("/api/sources", client.student(), json=payload).status_code == 403
    assert client.post("/api/sources", teacher, json={**payload, "type": "magazine"}).status_code == 422
    assert client.post("/api/sources", teacher, json={**payload, "year": 1500}).status_code == 422

    # Автор правит свой источник, пока им не пользуются другие учителя; админ — всегда.
    renamed = {**payload, "title": "Республиканская олимпиада, финал"}
    assert client.put(f"/api/sources/{source['id']}", teacher, json=renamed).status_code == 200
    assert client.put(f"/api/sources/{source['id']}", other, json=payload).status_code == 403
    client.task(other, theme["id"], source_id=source["id"])
    assert client.put(f"/api/sources/{source['id']}", teacher, json=payload).status_code == 403
    assert client.put(f"/api/sources/{source['id']}", admin, json=payload).status_code == 200

    # Несуществующий источник в задаче — 404.
    missing = {"theme_id": theme["id"], "title": "X", "answer": "1", "source_id": 999999}
    assert client.post("/api/tasks", teacher, json=missing).status_code == 404

    # Слияние дубликатов и удаление — только админ.
    duplicate = client.post("/api/sources", teacher, json={**payload, "title": "Респ. олимпиада"}).json()
    moved = client.task(teacher, theme["id"], title="Из дубликата", source_id=duplicate["id"])
    url = f"/api/sources/{duplicate['id']}/merge"
    assert client.post(url, teacher, json={"into_id": source["id"]}).status_code == 403
    merged = client.post(url, admin, json={"into_id": source["id"]}).json()
    assert merged["tasks_count"] == 2
    assert client.get(f"/api/tasks/{moved['id']}").json()["source_id"] == source["id"]
    assert client.get(f"/api/sources/{duplicate['id']}").status_code == 404
    assert client.delete(f"/api/sources/{source['id']}", teacher).status_code == 403
    assert client.delete(f"/api/sources/{source['id']}", admin).status_code == 204
    assert client.get(f"/api/tasks/{moved['id']}").json()["source_id"] is None


def test_task_source_validation(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    base = {"theme_id": theme["id"], "title": "Задача", "answer": "5"}
    # Номер без источника отбрасывается.
    response = client.post("/api/tasks", teacher, json={**base, "source_number": "12"})
    assert response.status_code == 201
    assert response.json()["source_number"] is None
