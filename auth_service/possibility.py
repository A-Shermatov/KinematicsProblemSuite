import base64
import mimetypes
import os
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

    data = utils.decode_token(token)

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

    image_data = None
    if db_user.image_path and os.path.exists(db_user.image_path):
        try:
            with open(db_user.image_path, "rb") as image_file:
                base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                mime_type, _ = mimetypes.guess_type(db_user.image_path)
                mime_type = mime_type or "image/jpeg"  # Значение по умолчанию
                image_data = f"data:{mime_type};base64,{base64_string}"
        except Exception as e:
            print(f"Error reading image: {str(e)}")
    return {"id": db_user.id, "username": db_user.username, "role": db_user.role, "image": image_data}


