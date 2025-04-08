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


@router.post("/create", response_model=schemas.TaskCreateResponse)
async def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), token: str = Depends(utils.oauth2_scheme)):
    user_url = (f"http://{utils.AUTH_SERVICE_HOST}:{utils.AUTH_SERVICE_PORT}"
                  f"/{utils.AUTH_SERVICE_POSSIBILITY_PREFIX_URL}/user")
    async with httpx.AsyncClient() as client:
        response = await client.get(user_url, headers={"Authorization": f"Bearer {token}"})
        if response.status_code != status.HTTP_200_OK:
            print(response.json())
            raise HTTPException(status_code=response.status_code, detail=response.json()["detail"])
        user_data = response.json()  # Process the data as required
    if user_data["role"] == "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="access denied")

    answer_url = (f"http://{utils.ANSWER_SUBMISSION_MANAGEMENT_SERVICE_HOST}:{utils.ANSWER_SUBMISSION_MANAGEMENT_SERVICE_PORT}"
                  f"/{utils.ANSWER_SUBMISSION_MANAGEMENT_SERVICE_ANSWER_PREFIX_API}/create")
    async with httpx.AsyncClient() as client:
        response = await client.post(answer_url, json={"token": token, "answer": task.answer})
        if response.status_code != status.HTTP_200_OK:
            if response.status_code != status.HTTP_403_FORBIDDEN:
                raise HTTPException(status_code=response.status_code, detail="Failed to create answer.")
            else:
                raise HTTPException(status_code=response.status_code, detail=response.json()["detail"])

        answer_data = response.json()  # Process the data as required
    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.id == task.theme_id)).filter(cast("ColumnElement[bool]", models.Theme.is_active)).first()
    if db_theme is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")
    if "condition" in task.model_dump() or task.model_dump()["condition"] is not None:
        db_task = models.Task(
            title=task.title,
            condition=task.condition,
            theme_id=task.theme_id,
            user_id=user_data["id"],
            answer_id=answer_data["id"],
        )
    else:
        db_task = models.Task(
            title=task.title,
            theme_id=task.theme_id,
            user_id=user_data["id"],
            answer_id=answer_data["id"],
        )

    db.add(db_task)

    db.commit()
    db.refresh(db_task)

    return db_task


# TODO /task/ - get tasks

# TODO /task/update

# TODO /task/delete