from tests.conftest import ApiClient
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def publish(client: ApiClient, teacher: str, oid: int) -> None:
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    client.post(f"/api/admin/olympiads/{oid}/review", client.admin_token(), json={"status": "published"})


def test_levels_crud(client: ApiClient) -> None:
    titles = [level["title"] for level in client.get("/api/olympiads/levels").json()]
    assert {"До 5 класса", "5–8 класс", "9–11 класс"} <= set(titles)
    admin = client.admin_token()
    bad = client.post("/api/admin/olympiad-levels", admin, json={"title": "X", "min_rating": 1500, "max_rating": 1200})
    assert bad.status_code == 422
    created = client.post(
        "/api/admin/olympiad-levels", admin, json={"title": "Студенты", "min_rating": 1900, "position": 9}
    )
    assert created.status_code == 201
    level = created.json()
    assert client.post("/api/admin/olympiad-levels", client.teacher(), json={"title": "Нельзя"}).status_code == 403
    edited = client.put(f"/api/admin/olympiad-levels/{level['id']}", admin, json={**level, "max_rating": 2400})
    assert edited.json()["max_rating"] == 2400
    assert client.delete(f"/api/admin/olympiad-levels/{level['id']}", admin).status_code == 204
    assert client.delete(f"/api/admin/olympiad-levels/{level['id']}", admin).status_code == 404


def test_out_of_competition_and_early_finish(client: ApiClient) -> None:
    levels = {level["title"]: level for level in client.get("/api/olympiads/levels").json()}
    junior = levels["До 5 класса"]  # официально — рейтинг ниже 1200
    teacher = client.teacher()
    assert client.post("/api/olympiads", teacher, json={**_payload(), "level_id": 999999}).status_code == 422
    olympiad = create_olympiad(client, teacher, level_id=junior["id"])
    assert (olympiad["level_title"], olympiad["level_max_rating"]) == ("До 5 класса", 1200)
    oid = olympiad["id"]
    task = add_task(client, teacher, oid)
    publish(client, teacher, oid)
    assert [o["id"] for o in client.get("/api/olympiads", params={"level_id": junior["id"]}).json()] == [oid]
    assert client.get("/api/olympiads", params={"level_id": levels["9–11 класс"]["id"]}).json() == []

    # У vali уже рейтинг 1300 — выше уровня, участвует вне конкурса.
    students = {name: client.student(name) for name in ("ali", "sami", "vali")}
    vali_id = client.get("/api/users/me", students["vali"]).json()["id"]
    other = create_olympiad(client, teacher, title="Прошлая олимпиада")["id"]
    client.sql(
        "INSERT INTO rating_changes (olympiad_id, user_id, place, total, old_rating, new_rating) "
        "VALUES ($1, $2, 1, 10, 1200, 1300)",
        other,
        vali_id,
    )
    for name, token in students.items():
        detail = client.post(f"/api/olympiads/{oid}/register", token).json()
        assert detail["is_official"] is (name != "vali")

    set_phase(client, oid, "running")
    submit = f"/api/olympiads/{oid}/tasks/{task['id']}/submit"
    client.post(submit, students["vali"], data={"answer": "20"}, files=photo())
    client.post(submit, students["ali"], data={"answer": "20"}, files=photo())
    client.post(submit, students["sami"], data={"answer": "1"}, files=photo())

    # Досрочное завершение: только организатор или админ и только пока идёт.
    assert client.post(f"/api/olympiads/{oid}/finish", students["ali"]).status_code == 403
    finished = client.post(f"/api/olympiads/{oid}/finish", teacher)
    assert finished.status_code == 200 and finished.json()["phase"] == "checking"
    assert client.post(f"/api/olympiads/{oid}/finish", client.admin_token()).status_code == 409
    assert client.post(submit, students["ali"], data={"answer": "20"}, files=photo()).status_code == 409

    client.post(f"/api/olympiads/{oid}/publish-results", teacher, params={"force": "true"})
    rows = client.get(f"/api/olympiads/{oid}/results").json()["rows"]
    # vali решил, но вне конкурса: в таблице есть, места и диплома нет.
    assert [(r["username"], r["place"], r["official"], r["diploma"]) for r in rows] == [
        ("vali", None, False, None),
        ("ali", 1, True, 1),
        ("sami", 2, True, None),
    ]
    standings = client.get(f"/api/olympiads/{oid}/standings").json()["rows"]
    changes = {r["username"]: r["rating_change"] for r in standings}
    assert changes["vali"] is None  # рейтинг вне конкурса не меняется
    assert changes["ali"]["new"] > 1200 > changes["sami"]["new"]


def _payload() -> dict:
    from datetime import timedelta

    from tests.test_api_olympiads import iso

    return {"title": "Олимпиада", "starts_at": iso(timedelta(days=1)), "ends_at": iso(timedelta(days=1, hours=2))}
