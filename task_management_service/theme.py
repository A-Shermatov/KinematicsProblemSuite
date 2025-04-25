from datetime import datetime, timezone
from typing import List, cast
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx

import models
import database
import utils
import schemas
from config import AUTH_SERVICE_HOST, AUTH_SERVICE_PORT, AUTH_SERVICE_POSSIBILITY_PREFIX_URL

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_user_data(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_URL}/user",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code,
                                detail=response.json().get("detail", "Failed to fetch user data"))
        return response.json()


@router.post("/create", response_model=schemas.ThemeResponse)
async def create_theme(theme: schemas.ThemeCreate, db: Session = Depends(get_db),
                       token: str = Depends(utils.oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db_theme = models.Theme(title=theme.title, description=theme.description)
    db.add(db_theme)
    db.commit()
    db.refresh(db_theme)
    return {"id": db_theme.id, "title": db_theme.title, "description": db_theme.description or ""}


@router.get("/", response_model=List[schemas.ThemeResponse])
def get_themes(db: Session = Depends(get_db)):
    db_themes = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.is_active)).all()
    return [{"id": t.id, "title": t.title, "description": t.description or ""} for t in db_themes]


@router.get("/{theme_id}", response_model=schemas.ThemeResponse)
def get_theme_by_id(theme_id: int, db: Session = Depends(get_db)):
    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.id == theme_id and models.Theme.is_active)).first()
    if not db_theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")
    return {"id": db_theme.id, "title": db_theme.title, "description": db_theme.description or ""}


@router.put("/{theme_id}", response_model=schemas.ThemeResponse)
async def update_theme(
        theme_id: int,
        theme: schemas.ThemeCreate,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    user_data = await get_user_data(token)
    if user_data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.id == theme_id and models.Theme.is_active)).first()
    if not db_theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")

    db_theme.title = theme.title
    db_theme.description = theme.description
    db_theme.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_theme)
    return {"id": db_theme.id, "title": db_theme.title, "description": db_theme.description or ""}


@router.delete("/{theme_id}")
async def delete_theme(
        theme_id: int,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    user_data = await get_user_data(token)
    if user_data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.id == theme_id and models.Theme.is_active)).first()
    if not db_theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")

    db_theme.is_active = False
    db_theme.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Theme deleted"}