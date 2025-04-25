import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import database
import utils
import schemas
from config import AUTH_SERVICE_HOST, AUTH_SERVICE_PORT, AUTH_SERVICE_POSSIBILITY_PREFIX_API

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/create", response_model=schemas.AnswerResponse)
async def create_answer(
        answer: schemas.AnswerCreate,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_API}/user",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code,
                                detail=response.json().get("detail", "Failed to fetch user data"))
        user_data = response.json()

    if user_data["role"] == "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers or admins can create answers")

    db_answer = models.Answer(text=answer.answer, user_id=user_data["id"])
    db.add(db_answer)
    db.commit()
    db.refresh(db_answer)
    return db_answer