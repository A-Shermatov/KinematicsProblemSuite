from datetime import datetime

from tests.conftest import ApiClient
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def finished_olympiad(client: ApiClient) -> tuple[str, str, int, dict, dict]:
    """Олимпиада с одним официальным участником (ali, 10 из 15) и опубликованными итогами."""
    teacher = client.teacher()
    admin = client.admin_token()
    oid = create_olympiad(client, teacher)["id"]
    first = add_task(client, teacher, oid)
    second = add_task(client, teacher, oid, title="Поезд", answer="72", unit="км/ч", max_points=5, position=1)
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    client.post(f"/api/admin/olympiads/{oid}/review", admin, json={"status": "published"})
    ali = client.student("ali")
    client.post(f"/api/olympiads/{oid}/register", ali)
    set_phase(client, oid, "running")
    client.post(f"/api/olympiads/{oid}/tasks/{first['id']}/submit", ali, data={"answer": "20"}, files=photo())
    set_phase(client, oid, "checking")
    for item in client.get(f"/api/olympiads/{oid}/submissions", teacher).json():
        client.post(
            f"/api/olympiads/{oid}/submissions/{item['id']}/grade", teacher, json={"points": item["auto_points"]}
        )
    assert client.post(f"/api/olympiads/{oid}/publish-results", teacher).json()["phase"] == "finished"
    return teacher, ali, oid, first, second


def test_virtual_participation(client: ApiClient) -> None:
    teacher, ali, oid, first, second = finished_olympiad(client)
    vali = client.student("vali")

    # Пока не начал — участия нет, ответы в архиве видны.
    assert client.get(f"/api/olympiads/{oid}/virtual", vali).json() is None
    assert client.get(f"/api/olympiads/{oid}", vali).json()["tasks"][0]["answer"] == "20"

    # Организатор и официальные участники виртуально не участвуют.
    assert client.post(f"/api/olympiads/{oid}/virtual", teacher).status_code == 403
    assert client.post(f"/api/olympiads/{oid}/virtual", ali).status_code == 409

    run = client.post(f"/api/olympiads/{oid}/virtual", vali)
    assert run.status_code == 201, run.text
    run = run.json()
    assert run["active"] is True and run["max_score"] == 15
    # Длительность — как у официальной олимпиады.
    official = client.get(f"/api/olympiads/{oid}").json()
    span = datetime.fromisoformat(run["ends_at"]) - datetime.fromisoformat(run["started_at"])
    official_span = datetime.fromisoformat(official["ends_at"]) - datetime.fromisoformat(official["starts_at"])
    assert abs((span - official_span).total_seconds()) < 1
    assert client.post(f"/api/olympiads/{oid}/virtual", vali).status_code == 409

    # Во время участия ответы скрыты, результат тоже.
    assert client.get(f"/api/olympiads/{oid}", vali).json()["tasks"][0]["answer"] is None
    base = f"/api/olympiads/{oid}/virtual/tasks"
    answered = client.post(f"{base}/{first['id']}", vali, json={"answer": "25"}).json()
    assert answered["submissions"][0]["correct"] is None and answered["total"] is None
    client.post(f"{base}/{first['id']}", vali, json={"answer": "20 м"})  # засчитывается последний
    client.post(f"{base}/{second['id']}", vali, json={"answer": "20 м/с"})
    assert client.post(f"{base}/999999", vali, json={"answer": "1"}).status_code == 404
    # В виртуальной таблице незавершённые не показываются.
    assert client.get(f"/api/olympiads/{oid}/virtual/standings").json() == []

    done = client.post(f"/api/olympiads/{oid}/virtual/finish", vali).json()
    assert done["active"] is False
    assert done["total"] == 15 and done["would_place"] == 1 and done["official_participants"] == 1
    assert {s["correct_answer"] for s in done["submissions"]} == {"20", "72"}
    assert client.post(f"{base}/{first['id']}", vali, json={"answer": "1"}).status_code == 409
    assert client.get(f"/api/olympiads/{oid}", vali).json()["tasks"][0]["answer"] == "20"

    standings = client.get(f"/api/olympiads/{oid}/virtual/standings").json()
    assert [(r["username"], r["total"], r["would_place"]) for r in standings] == [("vali", 15, 1)]

    # Официальные итоги не меняются.
    rows = client.get(f"/api/olympiads/{oid}/results").json()["rows"]
    assert [(r["username"], r["place"]) for r in rows] == [("ali", 1)]


def test_virtual_only_for_finished(client: ApiClient) -> None:
    teacher = client.teacher()
    oid = create_olympiad(client, teacher)["id"]
    add_task(client, teacher, oid)
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    client.post(f"/api/admin/olympiads/{oid}/review", client.admin_token(), json={"status": "published"})
    student = client.student()
    assert client.post(f"/api/olympiads/{oid}/virtual", student).status_code == 409
    assert client.get(f"/api/olympiads/{oid}/virtual/standings").status_code == 404
    assert client.post(f"/api/olympiads/{oid}/virtual/finish", student).status_code == 404
