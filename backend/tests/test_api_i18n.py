from app.i18n import parse_lang
from tests.conftest import ApiClient
from tests.test_api_olympiads import add_task, create_olympiad, set_phase

EN = {"title": "Train", "condition": "A train moves at $v = 72$ km/h. Find the speed in m/s."}


def test_parse_lang() -> None:
    assert parse_lang("en", "tg") == "en"
    assert parse_lang(None, "tg-TJ,ru;q=0.8") == "tg"
    assert parse_lang("de", "fr,en;q=0.5") == "en"
    assert parse_lang(None, None) == "ru"
    assert parse_lang("xx", "") == "ru"


def test_task_translations(client: ApiClient) -> None:
    teacher = client.teacher()
    theme = client.theme()
    task = client.task(teacher, theme["id"], translations={"en": EN, "tg": {"title": " ", "condition": ""}})
    tid = task["id"]
    # Пустой перевод не сохраняется; редактор получает оригинал и переводы отдельно.
    assert task["title"] == "Поезд" and task["translations"] == {"en": EN}
    assert task["available_langs"] == ["ru", "en"]

    en = client.get(f"/api/tasks/{tid}", headers={"X-Lang": "en"}).json()
    assert (en["title"], en["condition"], en["lang"]) == (EN["title"], EN["condition"], "en")
    assert client.get(f"/api/tasks/{tid}", headers={"Accept-Language": "en-US,en;q=0.9"}).json()["lang"] == "en"
    # Таджикского перевода нет — показываем русский.
    tg = client.get(f"/api/tasks/{tid}", headers={"X-Lang": "tg"}).json()
    assert (tg["title"], tg["lang"]) == ("Поезд", "ru")
    assert client.get(f"/api/tasks/{tid}").json()["title"] == "Поезд"

    listed = client.get("/api/tasks", params={"theme_id": theme["id"]}, headers={"X-Lang": "en"}).json()
    assert [t["title"] for t in listed] == ["Train"]
    # Поиск находит и по переводу.
    assert [t["id"] for t in client.get("/api/tasks", params={"search": "train moves"}).json()] == [tid]

    # Перевод можно убрать.
    updated = client.put(f"/api/tasks/{tid}", teacher, json={**_payload(task), "translations": {}}).json()
    assert updated["translations"] == {}
    assert client.get(f"/api/tasks/{tid}", headers={"X-Lang": "en"}).json()["title"] == "Поезд"


def _payload(task: dict) -> dict:
    keys = [
        "theme_id",
        "title",
        "condition",
        "difficulty",
        "check_mode",
        "answer_type",
        "answer",
        "unit",
        "tolerance",
        "source_type",
        "source_title",
        "source_year",
        "source_number",
    ]
    return {k: task[k] for k in keys}


def test_olympiad_task_translations(client: ApiClient) -> None:
    teacher = client.teacher()
    oid = create_olympiad(client, teacher)["id"]
    task = add_task(client, teacher, oid, translations={"tg": {"title": "Санг", "condition": "Масъала"}})
    assert task["translations"] == {"tg": {"title": "Санг", "condition": "Масъала"}}
    client.post(f"/api/olympiads/{oid}/submit-for-review", teacher)
    client.post(f"/api/admin/olympiads/{oid}/review", client.admin_token(), json={"status": "published"})
    student = client.student()
    client.post(f"/api/olympiads/{oid}/register", student)
    set_phase(client, oid, "running")

    tg = client.get(f"/api/olympiads/{oid}", student, headers={"X-Lang": "tg"}).json()["tasks"][0]
    assert (tg["title"], tg["condition"], tg["lang"], tg["translations"]) == ("Санг", "Масъала", "tg", None)
    en = client.get(f"/api/olympiads/{oid}", student, headers={"X-Lang": "en"}).json()["tasks"][0]
    assert (en["title"], en["lang"]) == ("Камень", "ru")
    # Организатор видит оригинал и переводы.
    manage = client.get(f"/api/olympiads/{oid}", teacher, headers={"X-Lang": "tg"}).json()["tasks"][0]
    assert manage["title"] == "Камень" and manage["translations"]["tg"]["title"] == "Санг"
