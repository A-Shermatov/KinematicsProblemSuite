from datetime import UTC, datetime, timedelta

import pytest

pytest.importorskip("bcrypt")

from app.security import TokenError, create_token, decode_token, hash_password, verify_password  # noqa: E402

SECRET = "unit-test-secret-key-that-is-long-enough"


def make(token_type: str = "access", lifetime: timedelta = timedelta(minutes=5), **kwargs: object) -> str:
    token, _ = create_token(
        user_id=42, token_type=token_type, secret=SECRET, algorithm="HS256", lifetime=lifetime, **kwargs
    )
    return token


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("correct horse")
    assert hashed != "correct horse"
    assert verify_password("correct horse", hashed)
    assert not verify_password("wrong", hashed)
    assert not verify_password("anything", "not-a-bcrypt-hash")


def test_access_token_roundtrip() -> None:
    payload = decode_token(make(), secret=SECRET, algorithm="HS256", expected_type="access")
    assert payload.user_id == 42
    assert payload.jti is None


def test_refresh_token_has_jti() -> None:
    payload = decode_token(make("refresh"), secret=SECRET, algorithm="HS256", expected_type="refresh")
    assert payload.jti


def test_access_token_cannot_be_used_as_refresh() -> None:
    with pytest.raises(TokenError):
        decode_token(make("access"), secret=SECRET, algorithm="HS256", expected_type="refresh")


def test_expired_token_rejected() -> None:
    token = make(now=datetime.now(UTC) - timedelta(hours=1))
    with pytest.raises(TokenError, match="истёк"):
        decode_token(token, secret=SECRET, algorithm="HS256", expected_type="access")


def test_wrong_secret_rejected() -> None:
    with pytest.raises(TokenError):
        decode_token(make(), secret="another-secret-key-that-is-long-enough", algorithm="HS256", expected_type="access")
