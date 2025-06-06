from typing import cast

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
from jwt import encode, decode, InvalidTokenError
import os

from sqlalchemy.orm import Session

import models
import database
from schemas import UserResponse, UserLogin

from config import HOST, PORT, PREFIX_AUTH_API, SECRET_KEY, BASE_DIR, UPLOAD_DIR, pwd_context, ALGORITHM, TOKEN_TYPE


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"http://{HOST}:{PORT}{PREFIX_AUTH_API}/login",
)


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_directories_exist():
    if not os.path.exists(BASE_DIR):
        os.mkdir(BASE_DIR)
    if not os.path.exists(UPLOAD_DIR):
        os.mkdir(UPLOAD_DIR)


def hash_password(password):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def create_token(data: dict, expires_delta: timedelta = None):
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


def add_tokens(access_token: str, refresh_token, secret_key: str = SECRET_KEY, algorithm: str = ALGORITHM, db: Session = Depends(get_db)):
    db_token = models.AccessRefreshToken(
        access_token=access_token,
        refresh_token=refresh_token,
        secret_key=secret_key,
        algorithm=algorithm,
        token_type=TOKEN_TYPE
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)


def validate_auth_user(
    user_login: UserLogin,
    db: Session = Depends(get_db),
) -> UserLogin:
    user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == user_login.username)).filter(
        cast("ColumnElement[bool]", models.User.is_active)).first()
    if user is None or not verify_password(
        plain_password=user_login.password,
        hashed_password=user.password,
    ):
        raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid username or password",
    )
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