from tests.conftest import ApiClient
from tests.test_api_olympiad_levels import publish
from tests.test_api_olympiads import add_task, create_olympiad, set_phase


def test_editorial_opens_day_after_end(client: ApiClient) -> None:
    teacher = client.teacher()
    oid = create_olympiad(client, teacher)["id"]
    task = add_task(client, teacher, oid)
    url = f"/api/olympiads/{oid}/editorial"
    solution = "$h = v^2 / 2g = 20$ м"
    payload = {"text": "Общие замечания: многие забыли про $g$.", "solutions": {str(task["id"]): solution}}
    assert client.put(url, teacher, json=payload).status_code == 200  # можно писать заранее, ещё в черновике
    assert client.put(url, teacher, json={"solutions": {"999999": "x"}}).status_code == 422
    draft = client.get(url, teacher).json()
    assert draft["tasks"][0]["solution"] == solution and draft["tasks"][0]["label"] == "A"

    publish(client, teacher, oid)
    ali = client.student("ali")
    client.post(f"/api/olympiads/{oid}/register", ali)
    assert client.put(url, ali, json=payload).status_code == 403
    set_phase(client, oid, "running")
    assert client.get(url, ali).status_code == 409
    set_phase(client, oid, "checking")  # закончилась минуту назад — разбор ещё закрыт
    assert client.get(url, ali).status_code == 409
    detail = client.get(f"/api/olympiads/{oid}", ali).json()
    assert detail["has_editorial"] is True and detail["editorial_at"]

    client.sql(
        "UPDATE olympiads SET starts_at = now() - interval '28 hours', ends_at = now() - interval '25 hours' "
        "WHERE id = $1",
        oid,
    )
    opened = client.get(url, ali).json()
    assert opened["text"].startswith("Общие замечания")
    assert (opened["tasks"][0]["solution"], opened["tasks"][0]["answer"]) == (solution, None)
    assert client.get(url).status_code == 200  # и без входа
