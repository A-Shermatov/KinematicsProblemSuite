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


@router.post("/create", response_model=schemas.TaskCreateResponse)
async def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    required_fields = [column.name for column in models.Task.__table__.columns if
                       not column.nullable and not column.name.endswith("id")]

    missing_fields = [field for field in required_fields if
                      field not in task.model_dump() or task.model_dump()[field] is None]
    print(missing_fields)
    if missing_fields:
        raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE,
                            detail=", ".join([field.replace('_', ' ').capitalize() for field in missing_fields]))

    url = f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_URL}/user"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params={"token": task.token, "role": "teacher"})
        if response.status_code != status.HTTP_200_OK:
            if response.status_code != status.HTTP_403_FORBIDDEN:
                raise HTTPException(status_code=response.status_code, detail="Failed to retrieve teacher data.")
            else:
                raise HTTPException(status_code=response.status_code, detail=response.json()["detail"])

        teacher_data = response.json()  # Process the data as required

    db_answer_id = 1
    if "condition" in task.model_dump() or task.model_dump()["condition"] is not None:
        db_task = models.Task(
            title=task.title,
            condition=task.condition,
            theme_id=task.theme_id,
            user_id=teacher_data["id"],
            answer_id=db_answer_id,
        )
    else:
        db_task = models.Task(
            title=task.title,
            theme_id=task.theme_id,
            user_id=teacher_data["id"],
            answer_id=db_answer_id,
        )

    db.add(db_task)

    db.commit()
    db.refresh(db_task)
    # db.refresh(db_answer)

    return db_task