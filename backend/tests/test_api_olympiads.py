from datetime import UTC, datetime, timedelta

from tests.conftest import ApiClient, tiny_png


def iso(delta: timedelta) -> str:
    return (datetime.now(UTC) + delta).isoformat()


def photo() -> dict:
    return {"image": ("solution.png", tiny_png(), "image/png")}


def create_olympiad(client: ApiClient, teacher: str, **overrides: object) -> dict:
    payload = {
        "title": "Осенняя олимпиада по физике",
        "description": "Три часа, четыре задачи",
        "starts_at": iso(timedelta(days=1)),
        "ends_at": iso(timedelta(days=1, hours=3)),
        **overrides,
    }
    response = client.post("/api/olympiads", teacher, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def add_task(client: ApiClient, token: str, olympiad_id: int, **overrides: object) -> dict:
    payload = {
        "title": "Камень",
        "condition": "$v_0 = 20$ м/с",
        "answer": "20",
        "unit": "м",
        "max_points": 10,
        **overrides,
    }
    response = client.post(f"/api/olympiads/{olympiad_id}/tasks", token, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def set_phase(client: ApiClient, olympiad_id: int, phase: str) -> None:
    if phase == "running":
        client.sql(
            "UPDATE olympiads SET starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour' "
            "WHERE id = $1",
            olympiad_id,
        )
    elif phase == "checking":
        client.sql(
            "UPDATE olympiads SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 minute' "
            "WHERE id = $1",
            olympiad_id,
        )


def test_validation(client: ApiClient) -> None:
    teacher = client.teacher()
    base = {"title": "Олимпиада", "starts_at": iso(timedelta(days=1)), "ends_at": iso(timedelta(days=1, hours=2))}
    assert client.post("/api/olympiads", teacher, json={**base, "ends_at": iso(timedelta(hours=1))}).status_code == 422
    assert (
        client.post("/api/olympiads", teacher, json={**base, "starts_at": iso(timedelta(hours=-1))}).status_code == 422
    )
    assert client.post("/api/olympiads", teacher, json={**base, "ends_at": iso(timedelta(days=20))}).status_code == 422
    naive = {**base, "starts_at": "2030-01-01T10:00:00", "ends_at": "2030-01-01T12:00:00"}
    assert client.post("/api/olympiads", teacher, json=naive).status_code == 422
    assert client.post("/api/olympiads", client.student(), json=base).status_code == 403

    olympiad = create_olympiad(client, teacher)
    # Без задач на проверку не отправить.
    assert client.post(f"/api/olympiads/{olympiad['id']}/submit-for-review", teacher).status_code == 422
    bad_answer = {"title": "X", "answer": "много"}
    assert client.post(f"/api/olympiads/{olympiad['id']}/tasks", teacher, json=bad_answer).status_code == 422
    stranger = client.teacher("stranger")
    assert (
        client.post(f"/api/olympiads/{olympiad['id']}/tasks", stranger, json={"title": "X", "answer": "1"}).status_code
        == 403
    )


def test_full_lifecycle(client: ApiClient) -> None:
    teacher = client.teacher()
    admin = client.admin_token()
    olympiad = create_olympiad(client, teacher)
    oid = olympiad["id"]
    assert olympiad["status"] == "draft"
    first = add_task(client, teacher, oid)
    second = add_task(client, teacher, oid, title="Поезд", answer="72", unit="км/ч", max_points=5, position=1)

    ali = client.student("ali")
    vali = client.student("vali")
    late = client.student("late")
    # Черновик не виден ученикам.
    assert client.get(f"/api/olympiads/{oid}", ali).status_code == 404

    # Модерация: отказ требует причину, после правки — повторная отправка.
    assert client.post(f"/api/olympiads/{oid}/submit-for-review", teacher).json()["status"] == "pending"
    assert (
        client.put(
            f"/api/olympiads/{oid}",
            teacher,
            json={"title": "Новое", "starts_at": olympiad["starts_at"], "ends_at": olympiad["ends_at"]},
        ).status_code
        == 409
    )
    assert [o["id"] for o in client.get("/api/admin/olympiads", admin, params={"status": "pending"}).json()] == [oid]
    assert client.post(f"/api/admin/olympiads/{oid}/review", admin, json={"status": "rejected"}).status_code == 422
    rejected = client.post(
        f"/api/admin/olympiads/{oid}/review", admin, json={"status": "rejected", "reason": "Добавьте правила"}
    )
    assert rejected.json()["reject_reason"] == "Добавьте правила"
    updated = client.put(
        f"/api/olympiads/{oid}",
        teacher,
        json={
            "title": olympiad["title"],
            "description": "Правила: ...",
            "starts_at": olympiad["starts_at"],
            "ends_at": olympiad["ends_at"],
        },
    )
    assert updated.json()["status"] == "draft"
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    published = client.post(f"/api/admin/olympiads/{oid}/review", admin, json={"status": "published"})
    assert published.json()["status"] == "published"

    # Регистрация до начала, условия ещё скрыты.
    listing = client.get("/api/olympiads", ali, params={"phase": "upcoming"}).json()
    assert [o["id"] for o in listing] == [oid]
    assert client.post(f"/api/olympiads/{oid}/register", teacher).status_code == 403
    for student in (ali, vali):
        assert client.post(f"/api/olympiads/{oid}/register", student).json()["is_registered"] is True
    assert client.get(f"/api/olympiads/{oid}", ali).json()["tasks"] == []
    assert client.get(f"/api/olympiads/{oid}", teacher).json()["tasks"][0]["answer"] == "20"

    # Олимпиада идёт.
    set_phase(client, oid, "running")
    detail = client.get(f"/api/olympiads/{oid}", ali).json()
    assert detail["phase"] == "running"
    assert len(detail["tasks"]) == 2 and detail["tasks"][0]["answer"] is None
    assert client.delete(f"/api/olympiads/{oid}/register", ali).status_code == 409
    submit = f"/api/olympiads/{oid}/tasks/{first['id']}/submit"
    assert client.post(submit, ali, data={"answer": "20"}).status_code == 422  # без фото нельзя
    wrong = client.post(submit, ali, data={"answer": "25"}, files=photo())
    assert wrong.status_code == 200, wrong.text
    assert wrong.json()["points"] == 0 and wrong.json()["correct_answer"] is None  # результат скрыт до итогов
    client.post(submit, ali, data={"answer": "20 м"}, files=photo())  # засчитывается последнее
    client.post(f"/api/olympiads/{oid}/tasks/{second['id']}/submit", ali, data={"answer": "20 м/с"}, files=photo())
    client.post(submit, vali, data={"answer": "20"}, files=photo())
    assert client.post(submit, late, data={"answer": "20"}, files=photo()).status_code == 403
    assert len(client.get(f"/api/olympiads/{oid}/my-submissions", ali).json()) == 2
    assert client.get(f"/api/olympiads/{oid}/results", ali).status_code == 403

    # Проверка жюри после окончания.
    set_phase(client, oid, "checking")
    assert client.post(submit, ali, data={"answer": "20"}, files=photo()).status_code == 409
    assert client.post(f"/api/olympiads/{oid}/register", late).status_code == 409
    jury = client.get(f"/api/olympiads/{oid}/submissions", teacher, params={"ungraded": True}).json()
    assert len(jury) == 3
    assert client.get(f"/api/olympiads/{oid}/submissions", ali).status_code == 403
    auto = {(s["username"], s["task_id"]): s for s in jury}
    assert auto[("ali", first["id"])]["auto_points"] == 10
    assert auto[("ali", second["id"])]["auto_points"] == 5  # 20 м/с = 72 км/ч

    preview = client.get(f"/api/olympiads/{oid}/results", teacher).json()
    assert preview["published"] is False
    assert client.post(f"/api/olympiads/{oid}/publish-results", teacher).status_code == 409  # не всё проверено

    ali_first = auto[("ali", first["id"])]
    over = client.post(f"/api/olympiads/{oid}/submissions/{ali_first['id']}/grade", teacher, json={"points": 11})
    assert over.status_code == 422
    graded = client.post(
        f"/api/olympiads/{oid}/submissions/{ali_first['id']}/grade",
        teacher,
        json={"points": 8, "comment": "Нет рисунка"},
    )
    assert graded.json()["points"] == 8
    for item in jury:
        if item["id"] != ali_first["id"]:
            client.post(
                f"/api/olympiads/{oid}/submissions/{item['id']}/grade", admin, json={"points": item["auto_points"]}
            )

    finished = client.post(f"/api/olympiads/{oid}/publish-results", teacher).json()
    assert finished["phase"] == "finished"
    assert finished["tasks"][0]["answer"] == "20"

    results = client.get(f"/api/olympiads/{oid}/results").json()
    assert results["max_score"] == 15
    rows = {r["username"]: r for r in results["rows"]}
    assert (rows["ali"]["place"], rows["ali"]["total"], rows["ali"]["diploma"]) == (1, 13, 1)
    assert (rows["vali"]["place"], rows["vali"]["total"], rows["vali"]["diploma"]) == (2, 10, 2)
    assert rows["ali"]["task_points"][str(first["id"])] == 8
    mine = client.get(f"/api/olympiads/{oid}/my-submissions", ali).json()
    assert {s["jury_comment"] for s in mine} == {"Нет рисунка", ""}
    assert (
        client.post(
            f"/api/olympiads/{oid}/submissions/{ali_first['id']}/grade", teacher, json={"points": 1}
        ).status_code
        == 409
    )

    board = client.get("/api/stats/leaderboard/olympiads").json()
    assert [r["username"] for r in board] == ["ali", "vali"]
    assert board[0]["gold"] == 1 and board[0]["points"] == 87  # 13 из 15 = 86.7%
    ali_id = client.get("/api/users/me", ali).json()["id"]
    badges = {b["code"]: b["earned"] for b in client.get(f"/api/stats/achievements/{ali_id}").json()["badges"]}
    assert badges["olympiad_win"] and badges["olympiad_prize"] and badges["olympiad_participant"]
