from tests.conftest import ApiClient, tiny_png
from tests.test_api_olympiad_levels import publish
from tests.test_api_olympiads import add_task, create_olympiad, photo, set_phase


def test_task_level_and_source_hidden_until_results(client: ApiClient) -> None:
    teacher = client.teacher()
    oid = create_olympiad(client, teacher)["id"]
    task = add_task(client, teacher, oid, difficulty=800, is_original=True)
    assert (task["difficulty"], task["source_type"], task["is_original"]) == (800, "own", True)
    publish(client, teacher, oid)
    ali = client.student("ali")
    client.post(f"/api/olympiads/{oid}/register", ali)
    set_phase(client, oid, "running")
    seen = client.get(f"/api/olympiads/{oid}", ali).json()["tasks"][0]
    assert (seen["difficulty"], seen["source_type"]) == (None, None)  # по источнику легко найти решение


def test_plagiarism_attempts_and_corrections(client: ApiClient) -> None:
    teacher, admin = client.teacher(), client.admin_token()
    oid = create_olympiad(client, teacher)["id"]
    task = add_task(client, teacher, oid, condition="Камень бросили со скоростью 20 м/с. Найдите высоту.")
    publish(client, teacher, oid)
    ali, vali = client.student("ali"), client.student("vali")
    for token in (ali, vali):
        client.post(f"/api/olympiads/{oid}/register", token)
    set_phase(client, oid, "running")
    submit = f"/api/olympiads/{oid}/tasks/{task['id']}/submit"

    # Списывание: vali присылает то же фото, что и ali, — попытка не засчитывается.
    same = tiny_png((10, 20, 30))
    assert client.post(submit, ali, data={"answer": "1"}, files=photo(same)).status_code == 200
    copied = client.post(submit, vali, data={"answer": "20"}, files=photo(same))
    assert copied.status_code == 409 and "другой участник" in copied.json()["detail"]
    assert client.post(submit, ali, data={"answer": "20"}, files=photo(same)).status_code == 200  # своё — можно
    assert client.post(submit, vali, data={"answer": "20"}, files=photo()).status_code == 200

    # Жюри видит только последнюю попытку каждого; все попытки — админ и сам участник.
    jury = client.get(f"/api/olympiads/{oid}/submissions", teacher).json()
    assert sorted((s["username"], s["answer"]) for s in jury) == [("ali", "20"), ("vali", "20")]
    assert client.get(f"/api/olympiads/{oid}/attempts", teacher).status_code == 403
    flagged = client.get(f"/api/olympiads/{oid}/attempts", teacher, params={"rejected": "true"}).json()
    assert [(a["username"], a["matched_username"], a["current"]) for a in flagged] == [("vali", "ali", False)]
    everything = client.get(f"/api/olympiads/{oid}/attempts", admin).json()
    assert len(everything) == 4 and all(a["image_url"] for a in everything)
    mine = client.get(f"/api/olympiads/{oid}/my-history", ali).json()
    assert [(h["answer"], h["current"]) for h in mine] == [("20", True), ("1", False)]
    assert mine[0]["image_url"] and mine[1]["image_url"]
    vali_mine = client.get(f"/api/olympiads/{oid}/my-history", vali).json()
    assert [(h["rejected"], h["current"]) for h in vali_mine] == [(False, True), (True, False)]

    # Исправление условия и ответа во время олимпиады: объявление с тем, что изменилось, и перепроверка.
    fixed = {**task, "condition": task["condition"].replace("20 м/с", "25 м/с"), "answer": "31.9"}
    fixed.pop("id")
    assert client.put(f"/api/olympiads/{oid}/tasks/{task['id']}", teacher, json=fixed).status_code == 200
    news = client.get(f"/api/olympiads/{oid}/announcements", ali).json()
    assert len(news) == 1 and news[0]["text"].startswith("Исправлено в задаче A «Камень»: условие, ответ")
    condition, answer = news[0]["changes"]
    assert {"op": "insert", "text": "25"} in condition["diff"] and answer == {
        "field": "answer",
        "label": "Ответ",
        "hidden": True,
    }
    standings = client.get(f"/api/olympiads/{oid}/standings").json()["rows"]
    assert {r["username"]: r["total"] for r in standings} == {"ali": 0, "vali": 0}  # 20 теперь неверно

    # Сообщение жюри.
    assert client.post(f"/api/olympiads/{oid}/announcements", ali, json={"text": "Привет"}).status_code == 403
    manual = client.post(f"/api/olympiads/{oid}/announcements", teacher, json={"text": "В задаче A g = 10 м/с²"})
    assert manual.status_code == 201
    assert [a["text"] for a in client.get(f"/api/olympiads/{oid}/announcements").json()][0] == "В задаче A g = 10 м/с²"

    set_phase(client, oid, "checking")
    client.post(f"/api/olympiads/{oid}/publish-results", teacher, params={"force": "true"})
    assert client.put(f"/api/olympiads/{oid}/tasks/{task['id']}", teacher, json=fixed).status_code == 409
