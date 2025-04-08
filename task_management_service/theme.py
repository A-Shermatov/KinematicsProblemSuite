from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models, database, utils
import schemas
import httpx

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/create", response_model=schemas.ThemeResponse)
async def create_theme(theme: schemas.ThemeCreate, db: Session = Depends(get_db), token: dict = Depends(utils.oauth2_scheme)):
    url = f"http://{utils.AUTH_SERVICE_HOST}:{utils.AUTH_SERVICE_PORT}/{utils.AUTH_SERVICE_POSSIBILITY_PREFIX_URL}/user"
    print(token)
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        # print(response.json())
        if response.status_code != status.HTTP_200_OK:
            if response.status_code == status.HTTP_403_FORBIDDEN:
                raise HTTPException(status_code=response.status_code, detail=response.json()["detail"])
            if response.status_code == status.HTTP_401_UNAUTHORIZED:
                raise HTTPException(status_code=response.status_code, detail="Unauthorized")
            raise HTTPException(status_code=response.status_code, detail=response.json()["detail"])
        user_data = response.json()  # Process the data as required
    # print(user_data)
    if user_data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="access denied")

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

    return {"id": db_theme.id, "title": db_theme.title, "description": db_theme.description or ""}


@router.get("/")
def themes(db: Session = Depends(get_db)):
    db_themes = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.is_active))
    return db_themes.all()


@router.get("/{theme_id}")
def theme_by_id(theme_id: int = None, db: Session = Depends(get_db)):
    print(theme_id)
    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.is_active and models.Theme.id == theme_id)).first()
    if db_theme is not None:
        return {"id": db_theme.id, "title": db_theme.title, "description": db_theme.description}
    return {}

# TODO /theme/update

# TODO /theme/delete