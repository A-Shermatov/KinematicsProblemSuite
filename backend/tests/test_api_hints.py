from tests.conftest import ApiClient

HINTS = ["Переведите км/ч в м/с", "Разделите на 3,6", "72 / 3,6 = ?"]


def setup_task(client: ApiClient, **extra: object) -> tuple[str, dict]:
    teacher = client.teacher()
    theme = client.theme()
    task = client.task(
        teacher,
        theme["id"],
        difficulty=500,
        hints=HINTS,
        explanation="$v = 72 / 3{,}6 = 20$ м/с",
        mistakes=[{"answer": "7.2", "message": "Вы разделили на 10, а не на 3,6"}],
        **extra,
    )
    return teacher, task


def test_hints_and_explanation(client: ApiClient) -> None:
    teacher, task = setup_task(client)
    url = f"/api/tasks/{task['id']}"
    # Автор видит всё, публично подсказки и разбор не отдаются.
    assert task["hints"] == HINTS and task["mistakes"][0]["answer"] == "7.2"
    assert "hints" not in client.get(url).json()
    author = client.get(f"{url}/help", teacher).json()
    assert author["hints"] == HINTS and author["explanation"] and author["can_open_hints"] is False

    student = client.student()
    help_ = client.get(f"{url}/help", student).json()
    assert (help_["hints_total"], help_["hints"], help_["points"], help_["explanation"]) == (3, [], 500, None)
    assert help_["has_explanation"] and help_["attempts_until_explanation"] == 3

    opened = client.post(f"{url}/hints", student).json()
    assert opened["hints"] == HINTS[:1] and opened["points"] == 400
    opened = client.post(f"{url}/hints", student).json()
    assert opened["hints"] == HINTS[:2] and opened["points"] == 300
    client.post(f"{url}/hints", student)
    assert client.post(f"{url}/hints", student).status_code == 409
    assert client.post(f"{url}/hints", teacher).status_code == 403
    assert client.post(f"{url}/hints").status_code == 401

    # Разбор открывается после верного ответа; очки — с учётом трёх подсказок (500 → 200).
    client.attempt(student, task["id"], "20")
    assert client.get(f"{url}/help", student).json()["explanation"].startswith("$v")
    sid = client.get("/api/users/me", student).json()["id"]
    assert client.get(f"/api/stats/achievements/{sid}").json()["points"] == 200
    board = client.get("/api/stats/leaderboard").json()
    assert [(r["user_id"], r["points"]) for r in board] == [(sid, 200)]


def test_explanation_after_wrong_attempts_and_mistake_feedback(client: ApiClient) -> None:
    _, task = setup_task(client)
    student = client.student()
    url = f"/api/tasks/{task['id']}/help"
    teacher_mistake = client.attempt(student, task["id"], "7.2").json()
    assert teacher_mistake["status"] == "incorrect" and "разделили на 10" in teacher_mistake["feedback"]
    units = client.attempt(student, task["id"], "72").json()
    assert "км/ч и м/с" in units["feedback"]
    assert client.get(url, student).json()["attempts_until_explanation"] == 1
    sign = client.attempt(student, task["id"], "-20").json()
    assert "знак" in sign["feedback"]
    help_ = client.get(url, student).json()
    assert help_["explanation"] and help_["attempts_until_explanation"] == 0
    # Без подсказок задача даёт все очки.
    client.attempt(student, task["id"], "20 м/с")
    sid = client.get("/api/users/me", student).json()["id"]
    assert client.get(f"/api/stats/achievements/{sid}").json()["points"] == 500


def test_hint_validation(client: ApiClient) -> None:
    teacher = client.teacher()
    theme = client.theme()
    base = {
        "theme_id": theme["id"],
        "title": "Т",
        "condition": "Достаточно длинное условие задачи про скорость.",
        "answer": "1",
    }
    assert client.post("/api/tasks", teacher, json={**base, "hints": ["a", "b", "c", "d"]}).status_code == 422
    created = client.post("/api/tasks", teacher, json={**base, "hints": ["  ", "Подсказка"]}).json()
    assert created["hints"] == ["Подсказка"]
