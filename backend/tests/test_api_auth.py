from tests.conftest import PASSWORD, ApiClient


def test_health(client: ApiClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_always_creates_student(client: ApiClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"username": "petya", "password": PASSWORD, "first_name": "Петя", "role": "teacher"},
    )
    assert response.status_code == 201
    assert response.json()["role"] == "student"


def test_register_validation_and_duplicates(client: ApiClient) -> None:
    client.register("petya")
    assert (
        client.post(
            "/api/auth/register", json={"username": "PETYA", "password": PASSWORD, "first_name": "П"}
        ).status_code
        == 409
    )
    assert (
        client.post("/api/auth/register", json={"username": "x", "password": PASSWORD, "first_name": "П"}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/register", json={"username": "short_pw", "password": "123", "first_name": "П"}
        ).status_code
        == 422
    )


def test_login_and_me(client: ApiClient) -> None:
    client.register("petya", first_name="Петя")
    tokens = client.login("petya")
    assert tokens["user"]["username"] == "petya"
    me = client.get("/api/users/me", tokens["access_token"])
    assert me.status_code == 200
    assert me.json()["first_name"] == "Петя"


def test_login_wrong_password(client: ApiClient) -> None:
    client.register("petya")
    response = client.post("/api/auth/login", json={"username": "petya", "password": "wrong-password"})
    assert response.status_code == 401
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "wrong-password"})
    assert response.status_code == 401


def test_requests_without_token_are_rejected(client: ApiClient) -> None:
    assert client.get("/api/users/me").status_code == 401
    assert client.get("/api/users/me", "garbage").status_code == 401


def test_refresh_rotates_tokens(client: ApiClient) -> None:
    client.register("petya")
    first = client.login("petya")
    second = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    # Старый refresh-токен уже погашен — повторно использовать нельзя.
    assert client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]}).status_code == 401
    assert client.get("/api/users/me", second.json()["access_token"]).status_code == 200


def test_access_token_is_not_a_refresh_token(client: ApiClient) -> None:
    client.register("petya")
    tokens = client.login("petya")
    response = client.post("/api/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert response.status_code == 401


def test_logout_revokes_refresh_token(client: ApiClient) -> None:
    client.register("petya")
    tokens = client.login("petya")
    assert client.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_blocked_user_loses_access(client: ApiClient) -> None:
    user = client.register("petya")
    tokens = client.login("petya")
    admin = client.admin_token()
    assert client.patch(f"/api/admin/users/{user['id']}/active", admin, json={"is_active": False}).status_code == 200

    assert client.get("/api/users/me", tokens["access_token"]).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "petya", "password": PASSWORD}).status_code == 403

    assert client.patch(f"/api/admin/users/{user['id']}/active", admin, json={"is_active": True}).status_code == 200
    client.login("petya")


def test_only_admin_manages_users(client: ApiClient) -> None:
    student = client.student()
    assert client.get("/api/admin/users", student).status_code == 403
    users = client.get("/api/admin/users", client.admin_token(), params={"role": "student"})
    assert users.status_code == 200
    assert [u["username"] for u in users.json()] == ["student"]


def test_admin_cannot_block_himself(client: ApiClient) -> None:
    admin = client.admin_token()
    me = client.get("/api/users/me", admin).json()
    assert client.patch(f"/api/admin/users/{me['id']}/active", admin, json={"is_active": False}).status_code == 400


def test_update_profile_and_password(client: ApiClient) -> None:
    client.register("other")
    token = client.student("petya")
    response = client.patch(
        "/api/users/me", token, json={"username": "other", "first_name": "Петя", "last_name": "Иванов"}
    )
    assert response.status_code == 409
    response = client.patch(
        "/api/users/me", token, json={"username": "petya2", "first_name": "Петя", "last_name": "Иванов"}
    )
    assert response.status_code == 200
    assert response.json()["last_name"] == "Иванов"

    response = client.post(
        "/api/users/me/password", token, json={"current_password": "wrong", "new_password": "new-password-1"}
    )
    assert response.status_code == 400
    response = client.post(
        "/api/users/me/password", token, json={"current_password": PASSWORD, "new_password": "new-password-1"}
    )
    assert response.status_code == 204
    client.login("petya2", "new-password-1")


def test_admin_api_requires_admin(client: ApiClient) -> None:
    teacher = client.teacher()
    for method, url, body in [
        ("GET", "/api/admin/stats", None),
        ("GET", "/api/admin/users", None),
        ("GET", "/api/admin/attempts", None),
        ("POST", "/api/admin/subjects", {"title": "Химия"}),
        ("PATCH", "/api/admin/users/1/role", {"role": "teacher"}),
    ]:
        assert client.request(method, url, teacher, json=body).status_code == 403, url
        assert client.request(method, url, None, json=body).status_code == 401, url
    assert client.get("/api/admin/stats", client.admin_token()).status_code == 200


def test_public_structure_endpoints_are_read_only(client: ApiClient) -> None:
    admin = client.admin_token()
    # Изменение каталога переехало в /api/admin — старые адреса больше не принимают запись.
    assert client.post("/api/subjects", admin, json={"title": "Химия"}).status_code == 405
    assert client.post("/api/themes", admin, json={"subject_id": 1, "title": "X"}).status_code == 405
