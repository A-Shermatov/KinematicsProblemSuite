import os

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


@router.post("/create", response_model=schemas.AnswerCreateResponse)
async def create_answer(answer: schemas.AnswerCreate, db: Session = Depends(get_db)):
    db_answer = models.Answer(
            answer=answer.answer
        )

    db.add(db_answer)

    db.commit()
    db.refresh(db_answer)

    return db_answer