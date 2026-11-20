from tests.conftest import ApiClient
from tests.test_api_olympiad_levels import publish
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def held(client: ApiClient, teacher: str, title: str, tasks: list[dict], answers: dict[str, list[str]]) -> int:
    """Провести олимпиаду: задачи, участники с ответами по задачам, итоги."""
    oid = create_olympiad(client, teacher, title=title)["id"]
    created = [add_task(client, teacher, oid, **task) for task in tasks]
    publish(client, teacher, oid)
    tokens = {name: client.student(name) for name in answers}
    for token in tokens.values():
        client.post(f"/api/olympiads/{oid}/register", token)
    set_phase(client, oid, "running")
    for name, replies in answers.items():
        for task, reply in zip(created, replies, strict=True):
            if reply:
                url = f"/api/olympiads/{oid}/tasks/{task['id']}/submit"
                assert client.post(url, tokens[name], data={"answer": reply}, files=photo()).status_code == 200
    set_phase(client, oid, "checking")
    client.post(f"/api/olympiads/{oid}/publish-results", teacher, params={"force": "true"})
    return oid


def test_archive_filters_and_sorting(client: ApiClient) -> None:
    teacher = client.teacher()
    first = held(
        client,
        teacher,
        "Осенняя олимпиада",
        [{"title": "Камень", "difficulty": 300}, {"title": "Маятник", "difficulty": 900}],
        {"ali": ["20", "1"], "vali": ["20", ""]},
    )
    held(client, teacher, "Зимняя олимпиада", [{"title": "Поезд", "difficulty": 500}], {"sami": ["1"]})
    upcoming = create_olympiad(client, teacher, title="Будущая")["id"]  # ещё не прошла — в архив не попадает
    add_task(client, teacher, upcoming, title="Секрет")

    archive = client.get("/api/olympiads/problems").json()
    assert archive["total"] == 3
    assert [(i["title"], i["label"]) for i in archive["items"]][-2:] == [("Камень", "A"), ("Маятник", "B")]
    stone = next(i for i in archive["items"] if i["title"] == "Камень")
    assert (stone["tried"], stone["solved"], stone["avg_percent"], stone["olympiad_id"]) == (2, 2, 100, first)

    by_difficulty = client.get("/api/olympiads/problems", params={"sort": "difficulty_desc"}).json()["items"]
    assert [i["difficulty"] for i in by_difficulty] == [900, 500, 300]
    hardest_solved = client.get("/api/olympiads/problems", params={"sort": "solved_asc"}).json()["items"]
    assert hardest_solved[0]["solved"] == 0
    ranged = client.get("/api/olympiads/problems", params={"difficulty_min": 400, "difficulty_max": 900}).json()
    assert {i["title"] for i in ranged["items"]} == {"Маятник", "Поезд"}
    found = client.get("/api/olympiads/problems", params={"q": "зимняя"}).json()
    assert [i["title"] for i in found["items"]] == ["Поезд"]
    page = client.get("/api/olympiads/problems", params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 3 and len(page["items"]) == 1

    newcomer = client.student("newcomer")
    assert client.get("/api/olympiads/problems", newcomer, params={"progress": "solved"}).json()["total"] == 0
    ali = client.login("ali")["access_token"]
    solved = client.get("/api/olympiads/problems", ali, params={"progress": "solved"}).json()
    assert [(i["title"], i["my_best"]) for i in solved["items"]] == [("Камень", 10)]
    unsolved = client.get("/api/olympiads/problems", ali, params={"progress": "unsolved"}).json()
    assert {i["title"] for i in unsolved["items"]} == {"Маятник", "Поезд"}
