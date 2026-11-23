from tests.conftest import PASSWORD, ApiClient


def test_regions_and_profile_location(client: ApiClient) -> None:
    regions = client.get("/api/geo/regions").json()
    sughd = next(r for r in regions if r["name"] == "Согдийская область")
    assert "Худжанд" in [c["name"] for c in sughd["cities"]]
    assert client.get("/api/geo/regions", params={"country": "UZ"}).json() == []
    assert client.get("/api/geo/regions", params={"country": "XX"}).status_code == 422

    created = client.post(
        "/api/auth/register",
        json={
            "username": "ali",
            "password": PASSWORD,
            "first_name": "Али",
            "region_id": sughd["id"],
            "city": "Худжанд",
        },
    ).json()
    assert (created["country_code"], created["region_name"], created["city"]) == ("TJ", "Согдийская область", "Худжанд")
    bad = client.post(
        "/api/auth/register",
        json={
            "username": "vali",
            "password": PASSWORD,
            "first_name": "В",
            "country_code": "UZ",
            "region_id": sughd["id"],
        },
    )
    assert bad.status_code == 422  # область не из этой страны
    assert (
        client.post(
            "/api/auth/register", json={"username": "x1", "password": PASSWORD, "first_name": "X", "country_code": "ZZ"}
        ).status_code
        == 422
    )

    token = client.login("ali")["access_token"]
    moved = client.patch(
        "/api/users/me",
        token,
        json={"username": "ali", "first_name": "Али", "country_code": "RU", "city": "Казань", "school": "КНИТУ-КАИ"},
    ).json()
    assert (moved["country_code"], moved["region_id"], moved["city"]) == ("RU", None, "Казань")


def test_admin_manages_places(client: ApiClient) -> None:
    admin = client.admin_token()
    assert client.post("/api/admin/geo/regions", client.student(), json={"name": "Х"}).status_code == 403
    region = client.post("/api/admin/geo/regions", admin, json={"country_code": "uz", "name": "Ферганская область"})
    assert region.status_code == 201
    rid = region.json()["id"]
    duplicate = {"country_code": "UZ", "name": "ферганская область"}
    assert client.post("/api/admin/geo/regions", admin, json=duplicate).status_code == 409
    assert client.post("/api/admin/geo/cities", admin, json={"region_id": rid, "name": "Коканд"}).status_code == 201
    uz = client.get("/api/geo/regions", params={"country": "UZ"}).json()
    assert [(r["name"], [c["name"] for c in r["cities"]]) for r in uz] == [("Ферганская область", ["Коканд"])]
    assert client.delete(f"/api/admin/geo/regions/{rid}", admin).status_code == 204
    assert client.get("/api/geo/regions", params={"country": "UZ"}).json() == []


def test_password_rules_follow_admin_setting(client: ApiClient) -> None:
    def register(username: str, password: str) -> int:
        return client.post(
            "/api/auth/register", json={"username": username, "password": password, "first_name": "П"}
        ).status_code

    assert register("petya", "onlyletters") == 422
    assert register("petya", "12345678") == 422
    assert register("petya", "petya-2026x") == 422  # содержит имя пользователя
    admin = client.admin_token()
    current = client.get("/api/admin/settings", admin).json()
    assert current["password_min_length"] == 8 and current["show_country_field"] is False
    client.put("/api/admin/settings", admin, json={**current, "password_min_length": 14, "show_country_field": True})
    public = client.get("/api/settings").json()
    assert public["password_min_length"] == 14 and public["show_country_field"] is True
    assert register("petya", PASSWORD) == 422  # 12 символов при минимуме 14 — мало
    assert register("petya", "longer-password-1") == 201
    token = client.login("petya", "longer-password-1")["access_token"]
    change = {"current_password": "longer-password-1", "new_password": "short1"}
    assert client.post("/api/users/me/password", token, json=change).status_code == 422
    client.put("/api/admin/settings", admin, json=current)
