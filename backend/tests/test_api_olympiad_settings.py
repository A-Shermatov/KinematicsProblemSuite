from datetime import datetime, timedelta

from tests.conftest import ApiClient
from tests.test_api_olympiad_virtual import finished_olympiad
from tests.test_api_olympiads import add_task, create_olympiad, iso


def test_delayed_virtual_start(client: ApiClient) -> None:
    _, _, oid, first, _ = finished_olympiad(client)
    vali = client.student("vali")
    url = f"/api/olympiads/{oid}/virtual"
    assert client.post(url, vali, json={"delay_minutes": 61}).status_code == 422
    admin = client.admin_token()
    current = client.get("/api/admin/settings", admin).json()
    assert current["virtual_start_max_minutes"] == 60
    client.put("/api/admin/settings", admin, json={**current, "virtual_start_max_minutes": 15})
    assert client.post(url, vali, json={"delay_minutes": 30}).status_code == 422

    run = client.post(url, vali, json={"delay_minutes": 10}).json()
    assert (run["scheduled"], run["active"]) == (True, False)
    start = datetime.fromisoformat(run["started_at"])
    assert timedelta(minutes=9) < start - datetime.now(start.tzinfo) <= timedelta(minutes=10)
    answer = client.post(f"{url}/tasks/{first['id']}", vali, json={"answer": "20"})
    assert answer.status_code == 409 and "ещё не началось" in answer.json()["detail"]
    assert client.get(f"/api/olympiads/{oid}/editorial", vali).status_code == 409

    # Отложенный старт можно отменить и начать сразу.
    assert client.delete(url, vali).status_code == 204
    assert client.delete(url, vali).status_code == 409
    started = client.post(url, vali).json()
    assert (started["scheduled"], started["active"]) == (False, True)
    assert client.delete(url, vali).status_code == 409  # уже идёт — отменить нельзя
    client.put("/api/admin/settings", admin, json=current)


def test_duration_limits_and_admin_edits(client: ApiClient) -> None:
    teacher, admin = client.teacher(), client.admin_token()
    settings = client.get("/api/admin/settings", admin).json()
    too_long = {"title": "Марафон", "starts_at": iso(timedelta(days=1)), "ends_at": iso(timedelta(days=1, hours=5))}
    response = client.post("/api/olympiads", teacher, json=too_long)
    assert response.status_code == 422 and "4 ч" in response.json()["detail"]  # без уровня — 4 часа
    client.put("/api/admin/settings", admin, json={**settings, "olympiad_max_duration_minutes": 360})
    assert client.post("/api/olympiads", teacher, json=too_long).status_code == 201
    client.put("/api/admin/settings", admin, json=settings)

    levels = client.get("/api/olympiads/levels").json()
    level = next(item for item in levels if item["title"] == "5–8 класс")
    assert level["max_duration_minutes"] == 180

    # Админ правит опубликованную олимпиаду и её задачи до начала.
    olympiad = create_olympiad(client, teacher)
    oid = olympiad["id"]
    task = add_task(client, teacher, oid)
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    client.post(f"/api/admin/olympiads/{oid}/review", admin, json={"status": "published"})
    edit = {"title": "Новое название", "starts_at": olympiad["starts_at"], "ends_at": olympiad["ends_at"]}
    assert client.put(f"/api/olympiads/{oid}", teacher, json=edit).status_code == 409
    assert client.put(f"/api/olympiads/{oid}", admin, json=edit).json()["title"] == "Новое название"
    assert client.post(f"/api/olympiads/{oid}/tasks", admin, json={"title": "Ещё", "answer": "1"}).status_code == 201
    assert client.delete(f"/api/olympiads/{oid}/tasks/{task['id']}", admin).status_code == 204
