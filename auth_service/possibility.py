import base64
import mimetypes
import os
from datetime import datetime, timezone
from typing import cast, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models, database, utils, schemas
from config import MAX_IMAGE_SIZE, UPLOAD_DIR

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/user")
def user(db: Session = Depends(get_db), token: str = Depends(utils.oauth2_scheme)):

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
    return {"id": db_user.id, "username": db_user.username, "role": db_user.role, "image": image_data, "first_name": db_user.first_name, "second_name": db_user.second_name}


@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), token: str = Depends(utils.oauth2_scheme)):
    data = utils.decode_token(token)
    db_admin = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == data["sub"] and models.User.is_active)).first()
    if not db_admin or db_admin.role != models.Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view users")

    users = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.id != db_admin.id)).all()
    return users


@router.get("/user/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.id == user_id and models.User.is_active)).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view users")
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
    return {"id": db_user.id, "username": db_user.username, "role": db_user.role, "image": image_data, "first_name": db_user.first_name, "second_name": db_user.second_name}


@router.patch("/users/{user_id}/block", response_model=schemas.UserResponse)
def block_user(
        user_id: int,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    # Проверка, что текущий пользователь — администратор
    data = utils.decode_token(token)
    db_admin = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == data["sub"] and models.User.is_active), ).first()
    if not db_admin or db_admin.role != models.Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can block users")

    # Поиск целевого пользователя
    db_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.id == user_id)).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Нельзя заблокировать самого себя
    if db_user.id == db_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself")

    db_user.is_active = False
    db_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "username": db_user.username, "role": db_user.role, "image": None, "first_name": db_user.first_name, "second_name": db_user.second_name}


@router.patch("/users/{user_id}/unblock", response_model=schemas.UserResponse)
def unblock_user(
        user_id: int,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    data = utils.decode_token(token)
    db_admin = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == data["sub"] and models.User.is_active)).first()
    if not db_admin or db_admin.role != models.Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can unblock users")

    db_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.id == user_id)).first()
    print(user_id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db_user.is_active = True
    db_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "username": db_user.username, "role": db_user.role, "image": None, "first_name": db_user.first_name, "second_name": db_user.second_name}


@router.patch("/user/update")
async def update_user(
        user_update: schemas.UserUpdate,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    data = utils.decode_token(token)
    db_user = db.query(models.User).filter(
        cast("ColumnElement[bool]", models.User.username == data["sub"] and models.User.is_active)).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    # Проверка, не занят ли новый username
    if user_update.username != db_user.username:
        existing_user = db.query(models.User).filter(
            cast("ColumnElement[bool]", models.User.username == user_update.username)).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE, detail="Имя пользователя уже занято")

    # Обновление данных пользователя
    db_user.first_name = user_update.first_name
    db_user.second_name = user_update.second_name
    db_user.username = user_update.username
    db_user.updated_at = datetime.now(timezone.utc)

    # Обработка загрузки изображения
    if user_update.image_data:
        try:
            utils.ensure_directories_exist()
            image_bytes = base64.b64decode(user_update.image_data.image)
            if len(image_bytes) > MAX_IMAGE_SIZE:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Размер изображения превышает 5 МБ")
            file_extension = user_update.image_data.file_name.split('.')[-1]
            safe_filename = f"image_{db_user.id}.{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, safe_filename)

            with open(file_path, "wb") as f:
                f.write(image_bytes)

            db_user.image_path = file_path
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка обработки изображения: {str(e)}")

    db.commit()
    db.refresh(db_user)
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
    return {"id": db_user.id, "username": db_user.username, "role": db_user.role, "image": image_data, "first_name": db_user.first_name, "second_name": db_user.second_name}