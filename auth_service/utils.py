from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jwt import encode, decode, ExpiredSignatureError, InvalidTokenError
import os


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")


def hash_password(password):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})

    return encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        payload = dict(decode(token, SECRET_KEY, algorithms=[ALGORITHM]))
        return payload
    except ExpiredSignatureError:
        return {
            "error": "ExpiredSignatureError"
        }
    except InvalidTokenError:
        return {
            "error": "InvalidTokenError"
        }