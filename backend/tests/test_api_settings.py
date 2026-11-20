from tests.conftest import ApiClient


def test_public_settings_have_difficulty_scale(client: ApiClient) -> None:
    settings = client.get("/api/settings").json()
    assert settings["difficulty_max"] == 1000
    assert settings["difficulty_levels"][:3] == [100, 200, 300]
    assert settings["difficulty_levels"][-1] == 1000


def test_admin_changes_difficulty_limit(client: ApiClient) -> None:
    admin = client.admin_token()
    theme = client.theme()
    teacher = client.teacher()

    assert client.put("/api/admin/settings", teacher, json={"difficulty_max": 3000}).status_code == 403
    assert client.put("/api/admin/settings", admin, json={"difficulty_max": 1550}).status_code == 422
    assert client.put("/api/admin/settings", admin, json={"difficulty_max": 50}).status_code == 422

    # До изменения задачу сложнее 1000 создать нельзя.
    too_hard = {"theme_id": theme["id"], "title": "Сложная", "answer": "1", "difficulty": 2500}
    assert client.post("/api/tasks", teacher, json=too_hard).status_code == 422

    updated = client.put("/api/admin/settings", admin, json={"difficulty_max": 3000})
    assert updated.status_code == 200
    assert client.get("/api/admin/settings", admin).json()["difficulty_max"] == 3000
    assert client.get("/api/settings").json()["difficulty_levels"][-1] == 3000
    assert client.post("/api/tasks", teacher, json=too_hard).status_code == 201
