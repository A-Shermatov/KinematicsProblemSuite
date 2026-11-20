from tests.conftest import PASSWORD, ApiClient


def student_in(client: ApiClient, username: str, city: str | None, school: str | None) -> str:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": PASSWORD, "first_name": username, "city": city, "school": school},
    )
    assert response.status_code == 201, response.text
    return client.login(username)["access_token"]


def test_city_and_school_are_optional_and_cleaned(client: ApiClient) -> None:
    token = student_in(client, "adult", None, None)
    me = client.get("/api/users/me", token).json()
    assert me["city"] is None and me["school"] is None

    updated = client.patch(
        "/api/users/me",
        token,
        json={"username": "adult", "first_name": "Взрослый", "city": "  Худжанд ", "school": " лицей   №1 "},
    ).json()
    assert updated["city"] == "Худжанд"
    assert updated["school"] == "лицей №1"

    cleared = client.patch("/api/users/me", token, json={"username": "adult", "first_name": "Взрослый", "school": "  "})
    assert cleared.json()["school"] is None


def test_leaderboards(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    easy = [client.task(teacher, theme["id"], title=f"Лёгкая {i}", difficulty=100) for i in range(3)]
    hard = client.task(teacher, theme["id"], title="Сложная", difficulty=500)

    ali = student_in(client, "ali", "Худжанд", "Лицей №1")
    vali = student_in(client, "vali", "худжанд", "лицей №1")  # другой регистр — та же школа
    dilya = student_in(client, "dilya", "Душанбе", "Школа №5")

    for task in easy:  # 3 задачи, 300 очков
        client.attempt(ali, task["id"], "20")
    client.attempt(vali, hard["id"], "20")  # 1 задача, 500 очков
    client.attempt(dilya, easy[0]["id"], "20")  # 1 задача, 100 очков
    client.attempt(dilya, easy[1]["id"], "999")  # неверно — не считается

    by_points = client.get("/api/stats/leaderboard").json()
    assert [r["username"] for r in by_points] == ["vali", "ali", "dilya"]
    assert by_points[0]["points"] == 500
    by_solved = client.get("/api/stats/leaderboard", params={"metric": "solved"}).json()
    assert [r["username"] for r in by_solved][0] == "ali"

    in_city = client.get("/api/stats/leaderboard", params={"city": "ХУДЖАНД"}).json()
    assert {r["username"] for r in in_city} == {"ali", "vali"}
    in_school = client.get("/api/stats/leaderboard", params={"city": "Худжанд", "school": "ЛИЦЕЙ №1"}).json()
    assert len(in_school) == 2
    other_subject = client.get("/api/stats/leaderboard", params={"subject_id": 999}).json()
    assert other_subject == []

    schools = client.get("/api/stats/leaderboard/schools").json()
    assert schools[0]["students"] == 2
    assert schools[0]["points"] == 800
    assert schools[0]["rank"] == 1
    assert client.get("/api/stats/leaderboard/schools", params={"city": "Душанбе"}).json()[0]["school"] == "Школа №5"

    cities = client.get("/api/stats/leaderboard/cities").json()
    assert [c["points"] for c in cities] == [800, 100]
    assert cities[0]["schools"] == 1

    places = client.get("/api/stats/places", params={"city": "худжанд"}).json()
    assert places["cities"][0].lower() == "худжанд"
    assert [s.lower() for s in places["schools"]] == ["лицей №1"]


def test_achievements(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    tasks = [
        client.task(teacher, theme["id"], title=f"Задача {i}", difficulty=1000 if i == 0 else 200) for i in range(3)
    ]
    student = client.student()
    sid = client.get("/api/users/me", student).json()["id"]

    empty = client.get(f"/api/stats/achievements/{sid}").json()
    assert empty["solved_tasks"] == 0 and empty["title"] is None
    assert not any(t["earned"] for t in empty["titles"])

    for task in tasks:
        client.attempt(student, task["id"], "20")
    result = client.get(f"/api/stats/achievements/{sid}").json()
    assert result["points"] == 1400 and result["solved_tasks"] == 3
    # Решённые задачи званий не дают — только олимпиады.
    assert result["title"] is None
    assert "current_streak" not in result and "badges" not in result
    assert [t["code"] for t in result["titles"]] == ["prize_1", "prize_3", "win_1", "prize_5", "win_3", "prize_10"]
    assert client.get("/api/stats/achievements/999999").status_code == 404


def test_titles_rules() -> None:
    from app.modules.stats import titles

    assert titles.best(0, 0) is None
    assert titles.best(1, 0)["code"] == "prize_1"
    assert titles.best(1, 1)["code"] == "win_1"
    assert titles.best(5, 1)["code"] == "prize_5"
    assert titles.best(10, 0)["name"] == "Гроссмейстер олимпиад"
    prize_3 = next(t for t in titles.evaluate(2, 0) if t["code"] == "prize_3")
    assert (prize_3["earned"], prize_3["progress"], prize_3["target"]) == (False, 2, 3)
