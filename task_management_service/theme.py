import os
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models, database
import schemas
import httpx

router = APIRouter()

AUTH_SERVICE_HOST = os.getenv("AUTH_SERVICE_HOST")
AUTH_SERVICE_PORT = os.getenv("AUTH_SERVICE_PORT")
AUTH_SERVICE_POSSIBILITY_PREFIX_URL = os.getenv("AUTH_SERVICE_POSSIBILITY_PREFIX_API")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/create", response_model=schemas.ThemeResponse)
async def create_theme(theme: schemas.TaskCreate, db: Session = Depends(get_db)):
    required_fields = [column.name for column in models.Theme.__table__.columns if
                       not column.nullable and not column.name.endswith("id")]

    missing_fields = [field for field in required_fields if
                      field not in theme.model_dump() or theme.model_dump()[field] is None]
    if missing_fields:
        raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE,
                            detail=", ".join([field.replace('_', ' ').capitalize() for field in missing_fields]))

    url = f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_URL}/user"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params={"token": theme.token, "role": "admin"})
        if response.status_code != status.HTTP_200_OK:
            if response.status_code != status.HTTP_403_FORBIDDEN:
                raise HTTPException(status_code=response.status_code, detail="Failed to retrieve teacher data.")
            else:
                raise HTTPException(status_code=response.status_code, detail=response.json()["detail"])

        # admin_data = response.json()  # Process the data as required

    if "description" in theme.model_dump() or theme.model_dump()["description"] is not None:
        db_theme = models.Theme(
            title=theme.title,
            description=theme.description
        )
    else:
        db_theme = models.Theme(
            title=theme.title
        )

    db.add(db_theme)

    db.commit()
    db.refresh(db_theme)

    return db_theme


@router.get("/exist", response_model=schemas.ThemeResponse)
def check(theme_id: int, db: Session = Depends(get_db)):
    db_theme = (db.query(models.Theme)
                .filter(cast("ColumnElement[bool]", models.Theme.id == theme_id))
                .filter(cast("ColumnElement[bool]", models.Theme.is_active))
                .first())

    if db_theme is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme with this id not found"
        )
    return db_theme