from tests.conftest import ApiClient
from tests.test_api_olympiad_levels import publish
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def test_jury_and_teacher_participants(client: ApiClient) -> None:
    author, judge, coach = client.teacher("author"), client.teacher("judge"), client.teacher("coach")
    client.student("pupil")
    oid = create_olympiad(client, author)["id"]
    task = add_task(client, author, oid)
    members = f"/api/olympiads/{oid}/jury-members"
    assert client.post(members, author, json={"username": "pupil"}).status_code == 422  # не учитель
    assert client.post(members, author, json={"username": "nobody"}).status_code == 422
    assert client.post(members, judge, json={"username": "judge"}).status_code == 403  # только организатор
    added = client.post(members, author, json={"username": "@judge"})
    assert added.status_code == 201 and [(m["username"], m["status"]) for m in added.json()] == [("judge", "pending")]
    publish(client, author, oid)

    # Пока приглашение не принято, прав жюри нет.
    invited = client.get(f"/api/olympiads/{oid}", judge).json()
    assert (invited["is_jury"], invited["jury_invited"]) == (False, True)
    assert client.get(f"/api/olympiads/{oid}/submissions", judge).status_code == 403
    assert [i["olympiad_id"] for i in client.get("/api/olympiads/jury-invitations/mine", judge).json()] == [oid]
    assert client.post(f"/api/olympiads/{oid}/jury-invitation/accept", judge).json()["is_jury"] is True
    assert client.get("/api/olympiads/jury-invitations/mine", judge).json() == []
    assert client.post(f"/api/olympiads/{oid}/jury-invitation/accept", judge).status_code == 404

    # Выпадающий список: учителя с предметами их задач, без автора, жюри и участников.
    client.task(coach, client.theme()["id"])
    candidates = client.get(f"/api/olympiads/{oid}/jury-candidates", author).json()
    assert [(c["username"], c["tasks"]) for c in candidates] == [("coach", 1)] and candidates[0]["subjects"]
    assert client.get(f"/api/olympiads/{oid}/jury-candidates", coach).status_code == 403

    # Жюри видит условия и ответы заранее, олимпиада есть в его «Моих олимпиадах».
    seen = client.get(f"/api/olympiads/{oid}", judge).json()
    assert seen["is_jury"] is True and seen["tasks"][0]["answer"] == "20"
    assert [(o["id"], o["is_jury"]) for o in client.get("/api/olympiads/mine", judge).json()] == [(oid, True)]

    # Учитель может участвовать, если он не автор и не в жюри.
    assert client.post(f"/api/olympiads/{oid}/register", author).status_code == 403
    assert client.post(f"/api/olympiads/{oid}/register", judge).status_code == 403
    assert client.post(f"/api/olympiads/{oid}/register", client.admin_token()).status_code == 403
    assert client.post(f"/api/olympiads/{oid}/register", coach).json()["is_registered"] is True
    assert client.post(members, author, json={"username": "coach"}).status_code == 409  # участник не может быть в жюри
    assert client.get(f"/api/olympiads/{oid}", coach).json()["tasks"] == []  # условия — только с начала

    set_phase(client, oid, "running")
    submit = f"/api/olympiads/{oid}/tasks/{task['id']}/submit"
    assert client.post(submit, coach, data={"answer": "20"}, files=photo()).status_code == 200

    # Жюри проверяет и делает объявления, но не управляет олимпиадой.
    jury = client.get(f"/api/olympiads/{oid}/submissions", judge).json()
    assert [s["username"] for s in jury] == ["coach"]
    graded = client.post(f"/api/olympiads/{oid}/submissions/{jury[0]['id']}/grade", judge, json={"points": 9})
    assert graded.json()["jury_points"] == 9
    assert client.post(f"/api/olympiads/{oid}/announcements", judge, json={"text": "Пишите единицы"}).status_code == 201
    assert client.post(f"/api/olympiads/{oid}/finish", judge).status_code == 403
    assert client.get(f"/api/olympiads/{oid}/submissions", coach).status_code == 403

    assert client.delete(f"{members}/{seen['organizer_id']}", author).status_code == 404
    judge_id = client.get("/api/users/me", judge).json()["id"]
    assert client.delete(f"{members}/{judge_id}", author).status_code == 204
    assert client.get(f"/api/olympiads/{oid}/submissions", judge).status_code == 403
