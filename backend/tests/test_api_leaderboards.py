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
    easy = [client.task(teacher, theme["id"], title=f"Лёгкая {i}", difficulty=1) for i in range(3)]
    hard = client.task(teacher, theme["id"], title="Сложная", difficulty=5)

    ali = student_in(client, "ali", "Худжанд", "Лицей №1")
    vali = student_in(client, "vali", "худжанд", "лицей №1")  # другой регистр — та же школа
    dilya = student_in(client, "dilya", "Душанбе", "Школа №5")

    for task in easy:  # 3 задачи, 3 очка
        client.attempt(ali, task["id"], "20")
    client.attempt(vali, hard["id"], "20")  # 1 задача, 5 очков
    client.attempt(dilya, easy[0]["id"], "20")  # 1 задача, 1 очко
    client.attempt(dilya, easy[1]["id"], "999")  # неверно — не считается

    by_points = client.get("/api/stats/leaderboard").json()
    assert [r["username"] for r in by_points] == ["vali", "ali", "dilya"]
    assert by_points[0]["points"] == 5
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
    assert schools[0]["points"] == 8
    assert schools[0]["rank"] == 1
    assert client.get("/api/stats/leaderboard/schools", params={"city": "Душанбе"}).json()[0]["school"] == "Школа №5"

    cities = client.get("/api/stats/leaderboard/cities").json()
    assert [c["points"] for c in cities] == [8, 1]
    assert cities[0]["schools"] == 1

    places = client.get("/api/stats/places", params={"city": "худжанд"}).json()
    assert places["cities"][0].lower() == "худжанд"
    assert [s.lower() for s in places["schools"]] == ["лицей №1"]


def test_achievements(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    tasks = [client.task(teacher, theme["id"], title=f"Задача {i}", difficulty=5 if i == 0 else 2) for i in range(3)]
    student = client.student()
    sid = client.get("/api/users/me", student).json()["id"]

    empty = client.get(f"/api/stats/achievements/{sid}").json()
    assert empty["solved_tasks"] == 0
    assert not any(b["earned"] for b in empty["badges"])

    for task in tasks:
        client.attempt(student, task["id"], "20")
    result = client.get(f"/api/stats/achievements/{sid}").json()
    earned = {b["code"] for b in result["badges"] if b["earned"]}
    assert earned == {"first_solve", "theme_master", "hard_solver"}
    assert result["points"] == 9
    assert result["current_streak"] == 1
    solved_10 = next(b for b in result["badges"] if b["code"] == "solved_10")
    assert (solved_10["progress"], solved_10["target"]) == (3, 10)

    assert client.get("/api/stats/achievements/999999").status_code == 404
