from tests.conftest import ApiClient
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def at_minute(client: ApiClient, username: str, minute: int) -> None:
    """Перенести отправки участника на N-ю минуту от начала олимпиады."""
    client.sql(
        "UPDATE olympiad_submissions sb SET submitted_at = o.starts_at + $2 * interval '1 minute' "
        "FROM olympiads o, users u WHERE o.id = sb.olympiad_id AND u.id = sb.user_id AND u.username = $1",
        username,
        minute,
    )


def test_live_standings(client: ApiClient) -> None:
    teacher = client.teacher()
    oid = create_olympiad(client, teacher)["id"]
    first = add_task(client, teacher, oid)
    add_task(client, teacher, oid, title="Вторая", max_points=5)
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    url = f"/api/olympiads/{oid}/standings"
    assert client.get(url).status_code == 404  # ещё не опубликована
    client.post(f"/api/admin/olympiads/{oid}/review", client.admin_token(), json={"status": "published"})
    assert client.get(url).status_code == 409  # ещё не началась

    students = {name: client.student(name) for name in ("ali", "vali", "sami")}
    for token in students.values():
        client.post(f"/api/olympiads/{oid}/register", token)
    set_phase(client, oid, "running")
    submit = f"/api/olympiads/{oid}/tasks/{first['id']}/submit"
    client.post(submit, students["ali"], data={"answer": "1"}, files=photo())  # сначала неверно
    client.post(submit, students["ali"], data={"answer": "20"}, files=photo())
    client.post(submit, students["vali"], data={"answer": "20"}, files=photo())
    client.post(submit, students["sami"], data={"answer": "5"}, files=photo())
    at_minute(client, "ali", 10)
    at_minute(client, "vali", 25)
    at_minute(client, "sami", 3)

    # «Мои отправки»: обе попытки ali, засчитывается последняя; вердикт скрыт до итогов.
    history = client.get(f"/api/olympiads/{oid}/my-history", students["ali"]).json()
    assert [(h["answer"], h["current"], h["auto_correct"]) for h in history] == [("20", True, None), ("1", False, None)]

    live = client.get(url).json()
    assert live["phase"] == "running" and live["provisional"] is True
    assert [t["label"] for t in live["tasks"]] == ["A", "B"]
    # Оба решили задачу A — выше тот, кто быстрее (ali на 10-й минуте, vali на 25-й).
    assert [(r["username"], r["place"], r["total"], r["penalty"]) for r in live["rows"]] == [
        ("ali", 1, 10, 10),
        ("vali", 2, 10, 25),
        ("sami", 3, 0, 0),  # неверный ответ не даёт штрафа
    ]
    ali_cell = live["rows"][0]["cells"][str(first["id"])]
    assert ali_cell == {"points": 10, "minute": 10, "attempts": 2, "graded": False}

    # Жюри проверило по-разному: у ali решение неполное — места меняются.
    set_phase(client, oid, "checking")
    for name, minute in (("ali", 10), ("vali", 25), ("sami", 3)):
        at_minute(client, name, minute)
    grades = {"ali": 6, "vali": 10, "sami": 0}
    for item in client.get(f"/api/olympiads/{oid}/submissions", teacher).json():
        payload = {"points": grades[item["username"]]}
        assert (
            client.post(f"/api/olympiads/{oid}/submissions/{item['id']}/grade", teacher, json=payload).status_code
            == 200
        )
    checked = client.get(url).json()
    assert checked["provisional"] is True
    assert [(r["username"], r["total"]) for r in checked["rows"]] == [("vali", 10), ("ali", 6), ("sami", 0)]
    assert checked["rows"][0]["cells"][str(first["id"])]["graded"] is True

    client.post(f"/api/olympiads/{oid}/publish-results", teacher)
    final = client.get(f"/api/olympiads/{oid}/results").json()["rows"]
    assert [(r["username"], r["place"], r["diploma"]) for r in final] == [
        ("vali", 1, 1),
        ("ali", 2, 2),
        ("sami", 3, None),
    ]
    assert client.get(url).json()["provisional"] is False
    history = client.get(f"/api/olympiads/{oid}/my-history", students["ali"]).json()
    assert [(h["answer"], h["auto_correct"]) for h in history] == [("20", True), ("1", False)]
