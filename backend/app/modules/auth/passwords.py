"""Требования к паролю. Минимальную длину задаёт администратор; те же правила проверяет интерфейс на лету.

Обязательно: длина, хотя бы одна буква и одна цифра, без имени пользователя. Заглавные буквы и спецсимволы
не обязательны — интерфейс показывает их как «сделать пароль сильнее».
"""

from __future__ import annotations

MAX_LENGTH = 72  # предел bcrypt


def problems(password: str, *, min_length: int, username: str = "") -> list[str]:
    """Что не так с паролем; пустой список — пароль подходит."""
    found = []
    if len(password) < min_length:
        found.append(f"Пароль должен быть не короче {min_length} символов")
    if len(password) > MAX_LENGTH:
        found.append(f"Пароль должен быть не длиннее {MAX_LENGTH} символов")
    if not any(ch.isalpha() for ch in password):
        found.append("В пароле должна быть хотя бы одна буква")
    if not any(ch.isdigit() for ch in password):
        found.append("В пароле должна быть хотя бы одна цифра")
    if username and len(username) >= 3 and username.lower() in password.lower():
        found.append("Пароль не должен содержать имя пользователя")
    return found
