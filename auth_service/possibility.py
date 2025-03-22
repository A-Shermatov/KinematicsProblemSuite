from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

import models, database, utils

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/user")
def user(request: Request, db: Session = Depends(get_db), token: str = Depends(utils.oauth2_scheme)):
    print(111)
    print(request.headers)
    db_token = db.query(models.Token).filter(cast("ColumnElement[bool]", models.Token.token == token)).first()


    if db_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    data = utils.decode_token(db_token.token)

    if "error" in data and data["error"] == "ExpiredSignatureError":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )

    db_user = (
        db.query(models.User)
        .filter(cast("ColumnElement[bool]", models.User.username == data["sub"]))
        .filter(cast("ColumnElement[bool]", models.User.is_active))
        .first()
    )
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return {"id": db_user.id, "role": db_user.role}
