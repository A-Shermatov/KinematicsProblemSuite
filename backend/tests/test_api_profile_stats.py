from tests.conftest import ApiClient


def test_activity_heatmap(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    task = client.task(teacher, theme["id"])
    student = client.student()
    sid = client.get("/api/users/me", student).json()["id"]

    empty = client.get(f"/api/stats/activity/{sid}").json()
    assert empty == {"days": [], "total": 0, "active_days": 0, "timezone": "Asia/Dushanbe"}

    first = client.attempt(student, task["id"], "1").json()  # неверная попытка тоже считается активностью
    client.attempt(student, task["id"], "2")
    # Переносим одну попытку на вчера, другую — на месяц назад.
    client.sql("UPDATE attempts SET created_at = now() - interval '1 day' WHERE id = $1", first["id"])
    third = client.attempt(student, task["id"], "20").json()
    client.sql("UPDATE attempts SET created_at = now() - interval '30 days' WHERE id = $1", third["id"])

    activity = client.get(f"/api/stats/activity/{sid}").json()
    assert activity["total"] == 3
    assert activity["active_days"] == 3
    assert all(day["count"] == 1 for day in activity["days"])
    assert client.get(f"/api/stats/activity/{sid}", params={"days": 7}).json()["total"] == 2
    assert client.get("/api/stats/activity/999999").status_code == 404


def test_difficulty_breakdown(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    easy = client.task(teacher, theme["id"], title="Лёгкая", difficulty=300)
    hard = client.task(teacher, theme["id"], title="Трудная", difficulty=500)
    student = client.student()
    sid = client.get("/api/users/me", student).json()["id"]

    client.attempt(student, easy["id"], "1")
    client.attempt(student, easy["id"], "20")  # решена со второй попытки
    client.attempt(student, hard["id"], "1")  # не решена

    data = client.get(f"/api/stats/difficulty/{sid}").json()
    assert data["levels"] == [
        {"difficulty": 300, "solved": 1, "unsolved": 0},
        {"difficulty": 500, "solved": 0, "unsolved": 1},
    ]
    assert data["subjects"] == [{"subject_id": theme["subject_id"], "subject_title": "Физика", "solved": 1}]
