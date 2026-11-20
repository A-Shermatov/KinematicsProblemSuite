from tests.conftest import ApiClient, tiny_png

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def teacher_id(client: ApiClient, token: str) -> int:
    return client.get("/api/users/me", token).json()["id"]


def test_profile_edit_and_public_view(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    tid = teacher_id(client, teacher)
    subject_id = theme["subject_id"]

    response = client.put(
        "/api/teachers/me",
        teacher,
        json={
            "headline": " Учитель физики, лицей №1 ",
            "bio": "Готовлю к **олимпиадам**",
            "experience_years": 12,
            "subject_ids": [subject_id, 9999],
        },
    )
    assert response.status_code == 200, response.text
    profile = response.json()
    assert profile["headline"] == "Учитель физики, лицей №1"
    assert profile["subject_ids"] == [subject_id]  # несуществующий предмет отброшен
    assert profile["subjects"] == ["Физика"]

    client.task(teacher, theme["id"])
    public = client.get(f"/api/teachers/{tid}").json()
    assert public["tasks_count"] == 1
    assert public["experience_years"] == 12
    assert public["rating"] is None
    assert public["can_review"] is False

    listing = client.get("/api/teachers", params={"subject_id": subject_id}).json()
    assert [t["id"] for t in listing] == [tid]
    assert client.get("/api/teachers", params={"search": "лицей"}).json()[0]["id"] == tid


def test_only_teachers_have_profiles(client: ApiClient) -> None:
    student = client.student()
    assert client.put("/api/teachers/me", student, json={"headline": "x"}).status_code == 403
    sid = teacher_id(client, student)
    assert client.get(f"/api/teachers/{sid}").status_code == 404


def test_certificates_need_admin_verification(client: ApiClient) -> None:
    teacher = client.teacher()
    tid = teacher_id(client, teacher)
    admin = client.admin_token()

    pdf = client.post(
        "/api/teachers/me/certificates",
        teacher,
        data={"title": "Учитель года", "issuer": "Минобразования", "year": "2024"},
        files={"file": ("cert.pdf", PDF, "application/pdf")},
    )
    assert pdf.status_code == 201, pdf.text
    assert pdf.json()["status"] == "pending" and pdf.json()["is_pdf"]
    png = client.post(
        "/api/teachers/me/certificates",
        teacher,
        data={"title": "Курсы повышения квалификации"},
        files={"file": ("c.png", tiny_png(), "image/png")},
    ).json()
    bad = client.post(
        "/api/teachers/me/certificates",
        teacher,
        data={"title": "Вирус"},
        files={"file": ("x.pdf", b"MZ\x90\x00", "application/pdf")},
    )
    assert bad.status_code == 415

    # Пока не проверено — публично не видно, а сам учитель видит со статусом.
    assert client.get(f"/api/teachers/{tid}").json()["certificates"] == []
    assert len(client.get("/api/teachers/me", teacher).json()["certificates"]) == 2

    pending = client.get("/api/admin/certificates", admin, params={"status": "pending"}).json()
    assert {c["id"] for c in pending} == {pdf.json()["id"], png["id"]}
    assert client.get("/api/admin/certificates", teacher).status_code == 403

    verified = client.post(f"/api/admin/certificates/{pdf.json()['id']}/review", admin, json={"status": "verified"})
    assert verified.json()["status"] == "verified"
    no_reason = client.post(f"/api/admin/certificates/{png['id']}/review", admin, json={"status": "rejected"})
    assert no_reason.status_code == 422
    rejected = client.post(
        f"/api/admin/certificates/{png['id']}/review", admin, json={"status": "rejected", "reason": "Нечитаемо"}
    )
    assert rejected.json()["reject_reason"] == "Нечитаемо"

    public = client.get(f"/api/teachers/{tid}").json()
    assert [c["title"] for c in public["certificates"]] == ["Учитель года"]
    assert public["verified_certificates"] == 1

    assert client.delete(f"/api/teachers/me/certificates/{png['id']}", teacher).status_code == 204
    assert client.delete(f"/api/teachers/me/certificates/{png['id']}", teacher).status_code == 404


def test_reviews_flow(client: ApiClient) -> None:
    theme = client.theme()
    teacher = client.teacher()
    tid = teacher_id(client, teacher)
    task = client.task(teacher, theme["id"])
    student = client.student()
    outsider = client.student("outsider")

    # Нельзя оставить отзыв, не решая задач учителя.
    assert client.put(f"/api/teachers/{tid}/reviews/me", student, json={"rating": 5}).status_code == 403
    client.attempt(student, task["id"], "20")
    assert client.get(f"/api/teachers/{tid}", student).json()["can_review"] is True

    review = client.put(f"/api/teachers/{tid}/reviews/me", student, json={"rating": 4, "text": " Понятно объясняет "})
    assert review.status_code == 200, review.text
    assert review.json()["text"] == "Понятно объясняет"
    # Повторная отправка обновляет тот же отзыв.
    updated = client.put(f"/api/teachers/{tid}/reviews/me", student, json={"rating": 5, "text": "Лучший!"}).json()
    assert updated["id"] == review.json()["id"]
    assert client.put(f"/api/teachers/{tid}/reviews/me", outsider, json={"rating": 1}).status_code == 403
    assert client.put(f"/api/teachers/{tid}/reviews/me", teacher, json={"rating": 5}).status_code == 403
    assert client.put(f"/api/teachers/{tid}/reviews/me", student, json={"rating": 6}).status_code == 422

    profile = client.get(f"/api/teachers/{tid}", student).json()
    assert profile["rating"] == 5.0
    assert profile["reviews_count"] == 1
    assert profile["rating_distribution"]["5"] == 1
    assert profile["my_review"]["text"] == "Лучший!"

    reply = client.post(f"/api/teachers/me/reviews/{updated['id']}/reply", teacher, json={"text": "Спасибо!"})
    assert reply.json()["reply"] == "Спасибо!"
    other_teacher = client.teacher("other")
    assert (
        client.post(f"/api/teachers/me/reviews/{updated['id']}/reply", other_teacher, json={"text": "x"}).status_code
        == 404
    )

    # Модерация: скрытый отзыв не виден и не влияет на рейтинг.
    admin = client.admin_token()
    assert client.patch(f"/api/admin/reviews/{updated['id']}", admin, json={"is_hidden": True}).status_code == 200
    assert client.get(f"/api/teachers/{tid}/reviews").json() == []
    assert client.get(f"/api/teachers/{tid}").json()["rating"] is None
    assert len(client.get("/api/admin/reviews", admin, params={"hidden": True}).json()) == 1

    assert client.delete(f"/api/teachers/{tid}/reviews/me", student).status_code == 204
    assert client.get("/api/admin/reviews", admin).json() == []


def test_teachers_sorted_by_rating(client: ApiClient) -> None:
    theme = client.theme()
    good = client.teacher("good")
    bad = client.teacher("bad")
    good_task = client.task(good, theme["id"])
    bad_task = client.task(bad, theme["id"])
    student = client.student()
    client.attempt(student, good_task["id"], "20")
    client.attempt(student, bad_task["id"], "20")
    client.put(f"/api/teachers/{teacher_id(client, good)}/reviews/me", student, json={"rating": 5})
    client.put(f"/api/teachers/{teacher_id(client, bad)}/reviews/me", student, json={"rating": 2})

    ranked = client.get("/api/teachers", params={"sort": "rating"}).json()
    assert [t["username"] for t in ranked] == ["good", "bad"]
