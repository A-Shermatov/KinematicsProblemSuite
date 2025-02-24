from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models, schemas, database
from schemas import TokenRefresh

from utils import *

router = APIRouter()

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
TOKEN_TYPE = os.getenv("TOKEN_TYPE", "bearer")


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_token(token: str, secret_key: str = SECRET_KEY, algorithm: str = ALGORITHM, db: Session = Depends(get_db)):
    db_token = models.Token(
        token=token,
        secret_key=secret_key,
        algorithm=algorithm,
        token_type=TOKEN_TYPE
    )
    db.add(db_token)
    db.commit()


@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    required_fields = []
    for column in models.User.__table__.columns:

        if not column.nullable and column.name != "id":
            required_fields.append(column.name)
    for field in required_fields:
        if field not in user.model_dump() or user.model_dump()[field] is None:
            raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE,
                                detail=f"{field.replace('_', ' ').capitalize()} is required")
    hashed_password = hash_password(user.password)
    db_user = models.User(
        first_name=user.first_name,
        second_name=user.second_name,
        role=user.role,
        username=user.username,
        password=hashed_password)
    check_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == user.username)).first()

    if check_user:
        raise HTTPException(
            status_code=status.HTTP_406_NOT_ACCEPTABLE,
            detail="User with this username is already exists"
        )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == user.username)).first()
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": db_user.username}, expires_delta=access_token_expires)
    add_token(token=access_token, db=db)
    return {"access_token": access_token, "token_type": TOKEN_TYPE}


@router.post("/token/refresh")
def refresh_token(token: TokenRefresh, db: Session = Depends(get_db)):
    db_token = db.query(models.Token).filter(cast("ColumnElement[bool]", models.Token.token == token.token)).first()
    data = decode_token(token.token)

    if "error" in data and data["error"] == "ExpiredSignatureError":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )

    if ("error" in data and data["error"] == "InvalidTokenError" or
            db_token is None or
            data is None or
            'sub' not in data or
            "exp" not in data):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    username = data['sub']

    db_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == username)).first()
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(data={"sub": db_user.username}, expires_delta=access_token_expires)
    add_token(token=new_access_token, db=db)
    return {"access_token": new_access_token, "token_type": "bearer"}