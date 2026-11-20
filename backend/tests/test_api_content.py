from tests.conftest import ApiClient


def test_subjects_and_themes_crud(client: ApiClient) -> None:
    admin = client.admin_token()
    subject = client.post("/api/subjects", admin, json={"title": "Химия", "position": 3})
    assert subject.status_code == 201
    subject_id = subject.json()["id"]
    assert client.post("/api/subjects", admin, json={"title": "химия"}).status_code == 409

    theme = client.post("/api/themes", admin, json={"subject_id": subject_id, "title": "Растворы"})
    assert theme.status_code == 201
    assert theme.json()["subject_title"] == "Химия"

    themes = client.get("/api/themes", params={"subject_id": subject_id}).json()
    assert [t["title"] for t in themes] == ["Растворы"]
    assert client.get("/api/subjects").json()[0]["themes_count"] == 1

    # Предмет с темами удалить нельзя, сначала темы.
    assert client.delete(f"/api/subjects/{subject_id}", admin).status_code == 409
    assert client.delete(f"/api/themes/{theme.json()['id']}", admin).status_code == 204
    assert client.delete(f"/api/subjects/{subject_id}", admin).status_code == 204
    assert client.get(f"/api/subjects/{subject_id}").status_code == 404


def test_only_admin_edits_structure(client: ApiClient) -> None:
    teacher = client.teacher()
    assert client.post("/api/subjects", teacher, json={"title": "Химия"}).status_code == 403
    assert client.post("/api/themes", teacher, json={"subject_id": 1, "title": "X"}).status_code == 403


def test_theme_for_missing_subject(client: ApiClient) -> None:
    response = client.post("/api/themes", client.admin_token(), json={"subject_id": 999, "title": "X"})
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
    client.task(teacher, theme["id"], title="Лёгкая", difficulty=1)
    client.task(teacher, theme["id"], title="Сложная", difficulty=5)

    assert len(client.get("/api/tasks", params={"theme_id": theme["id"]}).json()) == 2
    hard = client.get("/api/tasks", params={"difficulty": 5}).json()
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
    assert client.post("/api/tasks", teacher, json={**base, "answer": "5", "difficulty": 9}).status_code == 422
    # Для ручной проверки ответ может быть любым текстом.
    response = client.post("/api/tasks", teacher, json={**base, "answer": "см. решение", "check_mode": "manual"})
    assert response.status_code == 201
    assert client.post("/api/tasks", client.student(), json={**base, "answer": "5"}).status_code == 403


def test_theme_with_tasks_cannot_be_deleted(client: ApiClient) -> None:
    theme = client.theme()
    client.task(client.teacher(), theme["id"])
    assert client.delete(f"/api/themes/{theme['id']}", client.admin_token()).status_code == 409
