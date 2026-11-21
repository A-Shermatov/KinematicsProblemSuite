from app.modules.auth.passwords import problems


def test_strong_password_passes() -> None:
    assert problems("Kinematika2026", min_length=8, username="ali") == []


def test_each_rule() -> None:
    assert problems("Ab1", min_length=8) == ["Пароль должен быть не короче 8 символов"]
    assert problems("abcdefgh1", min_length=8) == []  # заглавные — рекомендация, не требование
    assert problems("Abcdefgh", min_length=8) == ["В пароле должна быть хотя бы одна цифра"]
    assert "В пароле должна быть хотя бы одна буква" in problems("12345678", min_length=8)
    assert problems("Farrukh2026", min_length=8, username="farrukh") == ["Пароль не должен содержать имя пользователя"]
    assert problems("Aa1" + "x" * 80, min_length=8) == ["Пароль должен быть не длиннее 72 символов"]
    assert problems("Abcdef1", min_length=6) == []
