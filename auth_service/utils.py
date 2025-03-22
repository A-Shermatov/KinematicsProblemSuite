from typing import cast, Annotated

from fastapi import Depends, HTTPException, Form, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jwt import encode, decode, InvalidTokenError
import os

from sqlalchemy.orm import Session

import models
import database
from schemas import UserResponse, UserLogin

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_TYPE = os.getenv("TOKEN_TYPE", "bearer")

HOST = os.getenv("HOST")
PORT = os.getenv("PORT")

PREFIX_AUTH_API = os.getenv("PREFIX_AUTH_API")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"http://{HOST}:{PORT}{PREFIX_AUTH_API}/login",
)



def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid token error: {e}",
            # detail=f"invalid token error",
        )


def add_token(token: str, secret_key: str = SECRET_KEY, algorithm: str = ALGORITHM, db: Session = Depends(get_db)):
    db_token = models.Token(
        token=token,
        secret_key=secret_key,
        algorithm=algorithm,
        token_type=TOKEN_TYPE
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)


def validate_auth_user(
    username: Annotated[str, Form()],
    password: Annotated[str, Form()],
    db: Session = Depends(get_db),
) -> UserLogin:
    unauthed_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid username or password",
    )
    user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == username)).filter(
        cast("ColumnElement[bool]", models.User.is_active)).first()
    if user is None:
        raise unauthed_exc

    if not verify_password(
        plain_password=password,
        hashed_password=user.password,
    ):
        raise unauthed_exc
    return UserLogin(username=user.username, password=user.password)


def get_current_auth_user(
    token: str,
    db: Session = Depends(get_db),
) -> UserResponse:
    print(token)
    data = decode_token(token)
    username = data.get("sub", None)
    if (user := db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == username)).filter(cast("ColumnElement[bool]", models.User.is_active)).first()) is not None:
        return UserResponse(username=user.username, id=user.id, role=user.role)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="token invalid (user not found)",
    )