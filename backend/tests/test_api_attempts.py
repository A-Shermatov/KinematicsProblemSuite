from pathlib import Path

from tests.conftest import ApiClient, tiny_png


def setup_task(client: ApiClient, **overrides: object) -> tuple[str, str, dict]:
    theme = client.theme()
    teacher = client.teacher()
    task = client.task(teacher, theme["id"], **overrides)
    return teacher, client.student(), task


def test_auto_check_with_unit_conversion(client: ApiClient) -> None:
    _, student, task = setup_task(client)

    wrong = client.attempt(student, task["id"], "25")
    assert wrong.status_code == 201
    assert wrong.json()["status"] == "incorrect"
    assert wrong.json()["correct_answer"] is None  # ответ не раскрываем до верного решения

    right = client.attempt(student, task["id"], "72 км/ч")
    assert right.status_code == 201
    body = right.json()
    assert body["status"] == "correct"
    assert body["system_grade"] == 100
    assert body["correct_answer"] == "20"

    assert client.get(f"/api/tasks/{task['id']}", student).json()["solved"] is True


def test_manual_review_flow(client: ApiClient) -> None:
    teacher, student, task = setup_task(client, check_mode="manual", answer="Доказательство")
    attempt = client.attempt(student, task["id"], "Моё доказательство").json()
    assert attempt["status"] == "pending"

    pending = client.get("/api/attempts", teacher, params={"status": "pending"}).json()
    assert [a["id"] for a in pending] == [attempt["id"]]

    assert client.post(f"/api/attempts/{attempt['id']}/grade", student, json={"grade": 100}).status_code == 403
    other_teacher = client.teacher("other")
    assert client.post(f"/api/attempts/{attempt['id']}/grade", other_teacher, json={"grade": 100}).status_code == 403

    graded = client.post(f"/api/attempts/{attempt['id']}/grade", teacher, json={"grade": 80, "feedback": "Хорошо"})
    assert graded.status_code == 200
    assert graded.json()["status"] == "graded"
    assert graded.json()["teacher_grade"] == 80

    mine = client.get("/api/attempts", student).json()
    assert mine[0]["feedback"] == "Хорошо"


def test_who_can_submit(client: ApiClient) -> None:
    teacher, _, task = setup_task(client)
    assert client.attempt(teacher, task["id"], "20").status_code == 403  # автор
    assert client.attempt(client.admin_token(), task["id"], "20").status_code == 403
    assert client.attempt(client.teacher("other"), task["id"], "20").status_code == 201  # чужой учитель может
    assert client.attempt(client.student("student2"), 999, "20").status_code == 404
    assert client.post("/api/attempts", data={"task_id": str(task["id"]), "answer": "20"}).status_code == 401


def test_empty_answer_rejected(client: ApiClient) -> None:
    _, student, task = setup_task(client)
    assert client.attempt(student, task["id"], "   ").status_code == 422


def test_image_upload(client: ApiClient, upload_dir: Path) -> None:
    _, student, task = setup_task(client, check_mode="manual", answer="см. решение")
    response = client.attempt(student, task["id"], "", files={"image": ("solution.png", tiny_png(), "image/png")})
    assert response.status_code == 201, response.text
    url = response.json()["image_url"]
    assert url.startswith("/uploads/attempts/") and url.endswith(".png")
    assert (upload_dir / url.removeprefix("/uploads/")).exists()
    assert client.get(url).status_code == 200

    fake = client.attempt(student, task["id"], "x", files={"image": ("evil.png", b"<script>", "image/png")})
    assert fake.status_code == 415


def test_attempt_visibility(client: ApiClient) -> None:
    teacher, student, task = setup_task(client)
    attempt = client.attempt(student, task["id"], "20").json()
    stranger = client.student("stranger")

    assert client.get(f"/api/attempts/{attempt['id']}", student).status_code == 200
    assert client.get(f"/api/attempts/{attempt['id']}", teacher).status_code == 200
    assert client.get(f"/api/attempts/{attempt['id']}", stranger).status_code == 403
    assert client.get("/api/attempts", stranger).json() == []
    assert client.get("/api/attempts", student, params={"scope": "authored"}).status_code == 403
    assert client.get("/api/admin/attempts", student).status_code == 403
    assert len(client.get("/api/admin/attempts", client.admin_token()).json()) == 1


def test_rate_limit(client: ApiClient) -> None:
    _, student, task = setup_task(client)
    for _ in range(10):
        assert client.attempt(student, task["id"], "1").status_code == 201
    assert client.attempt(student, task["id"], "1").status_code == 429


def test_stats_and_leaderboard(client: ApiClient) -> None:
    teacher, student, task = setup_task(client, difficulty=3)
    client.attempt(student, task["id"], "1")
    client.attempt(student, task["id"], "20")

    stats = client.get("/api/stats/me", student).json()
    assert stats["role"] == "student"
    assert stats["attempts"] == 2
    assert stats["correct"] == 1
    assert stats["solved_tasks"] == 1
    assert stats["by_theme"][0]["total_tasks"] == 1

    teacher_stats = client.get("/api/stats/me", teacher).json()
    assert teacher_stats["tasks"] == 1
    assert teacher_stats["attempts"] == 2
    assert teacher_stats["students"] == 1

    admin_stats = client.get("/api/admin/stats", client.admin_token()).json()
    assert admin_stats["students"] == 1
    assert admin_stats["teachers"] == 1

    board = client.get("/api/stats/leaderboard").json()
    assert board[0]["username"] == "student"
    assert board[0]["points"] == 3
    assert client.get("/api/stats/leaderboard", params={"period": "week"}).json()[0]["rank"] == 1
