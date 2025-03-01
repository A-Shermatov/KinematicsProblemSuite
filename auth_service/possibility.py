from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models, database

from utils import *

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_user(token: str, role: str, db):
    pass


@router.post("/student")
def student(token: str, db: Session = Depends(get_db)):
    pass


@router.get("/teacher")
def teacher(token: str, db: Session = Depends(get_db)):
    db_token = db.query(models.Token).filter(cast("ColumnElement[bool]", models.Token.token == token)).first()
    data = decode_token(token)

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
    return {"access": True}


@router.post("/admin")
def admin(token: str, db: Session = Depends(get_db)):
    pass