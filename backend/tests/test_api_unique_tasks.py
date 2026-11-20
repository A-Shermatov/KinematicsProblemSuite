from tests.conftest import ApiClient

CONDITION = "Поезд едет со скоростью $v = 72$ км/ч. Найдите скорость поезда в м/с."


def test_exact_duplicate_is_rejected(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    other = client.teacher("other")
    original = client.task(teacher, theme["id"], title="Поезд", condition=CONDITION)

    # Регистр, пробелы, разметка, пробельные команды LaTeX и точка в конце не делают задачу новой.
    variants = [
        CONDITION,
        "ПОЕЗД  едет со скоростью v=72 км/ч.\n\nНайдите **скорость поезда** в м/с",
        "Поезд едет со скоростью $v\\,=\\,72$ км/ч. Найдите скорость поезда в м/с",
    ]
    base = {"theme_id": theme["id"], "answer": "20", "unit": "м/с"}
    for author in (teacher, other):
        for condition in variants:
            response = client.post(
                "/api/tasks", author, json={**base, "title": "Другое название", "condition": condition}
            )
            assert response.status_code == 409, condition
    mine = client.post("/api/tasks", teacher, json={**base, "title": "X", "condition": CONDITION}).json()["detail"]
    assert mine.startswith("Вы уже добавляли эту задачу") and f"№{original['id']}" in mine
    theirs = client.post("/api/tasks", other, json={**base, "title": "X", "condition": CONDITION}).json()["detail"]
    assert theirs.startswith("Такая задача уже есть у автора")

    # Другие числа — другая задача. «0,5» и «0.5» — одно и то же.
    client.task(teacher, theme["id"], condition=CONDITION.replace("72", "54"))
    client.task(teacher, theme["id"], condition="Тело прошло 0,5 км за 10 с. Найдите среднюю скорость.")
    dup = {**base, "title": "X", "condition": "Тело прошло 0.5 км за 10 с. Найдите среднюю скорость"}
    assert client.post("/api/tasks", other, json=dup).status_code == 409

    # Изменить другую задачу так, чтобы она совпала с существующей, тоже нельзя; саму себя сохранить можно.
    second = client.task(teacher, theme["id"], condition="Совсем другая задача про автомобиль и тормозной путь.")
    payload = {**base, "title": second["title"], "condition": CONDITION}
    assert client.put(f"/api/tasks/{second['id']}", teacher, json=payload).status_code == 409
    same = {**base, "title": "Поезд (исправлено)", "condition": CONDITION}
    assert client.put(f"/api/tasks/{original['id']}", teacher, json=same).status_code == 200

    # Удалённую задачу можно добавить заново.
    assert client.delete(f"/api/tasks/{original['id']}", teacher).status_code == 204
    assert client.post("/api/tasks", other, json={**base, "title": "Поезд", "condition": CONDITION}).status_code == 201


def test_short_conditions_use_title(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    base = {"theme_id": theme["id"], "answer": "5", "condition": "Найдите x."}
    assert client.post("/api/tasks", teacher, json={**base, "title": "Уравнение 1"}).status_code == 201
    assert client.post("/api/tasks", teacher, json={**base, "title": "Уравнение 2"}).status_code == 201
    assert client.post("/api/tasks", teacher, json={**base, "title": "уравнение  1"}).status_code == 409


def test_check_duplicates(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    task = client.task(teacher, theme["id"], title="Поезд", condition=CONDITION)
    url = "/api/tasks/check-duplicates"
    assert client.post(url, client.student(), json={"condition": CONDITION}).status_code == 403

    exact = client.post(url, teacher, json={"title": "", "condition": CONDITION.upper()}).json()
    assert exact["exact"]["id"] == task["id"] and exact["exact"]["author_name"]

    similar = client.post(url, teacher, json={"condition": CONDITION.replace("72", "54")}).json()
    assert similar["exact"] is None
    assert [s["id"] for s in similar["similar"]] == [task["id"]] and similar["similar"][0]["similarity"] >= 0.6

    other = client.post(
        url, teacher, json={"condition": "Найдите площадь круга радиусом 3 см и длину окружности."}
    ).json()
    assert other == {"exact": None, "similar": []}
    # Редактируемую задачу саму с собой не сравниваем.
    itself = client.post(url, teacher, json={"condition": CONDITION, "exclude_id": task["id"]}).json()
    assert itself == {"exact": None, "similar": []}
