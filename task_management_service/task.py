from datetime import datetime, timezone
from typing import List, cast
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx

import models
import database
import utils
import schemas
from config import AUTH_SERVICE_HOST, AUTH_SERVICE_PORT, AUTH_SERVICE_POSSIBILITY_PREFIX_URL, \
    SOLUTION_SERVICE_HOST, SOLUTION_SERVICE_PORT, \
    SOLUTION_SERVICE_SOLUTION_PREFIX_API

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


@router.post("/create", response_model=schemas.TaskCreateResponse)
async def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db),
                      token: str = Depends(utils.oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] == "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"http://{SOLUTION_SERVICE_HOST}:{SOLUTION_SERVICE_PORT}/{SOLUTION_SERVICE_SOLUTION_PREFIX_API}/create",
            headers={"Authorization": f"Bearer {token}"},
            json={"token": token, "answer": task.answer}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code,
                                detail=response.json().get("detail", "Failed to create answer"))
        answer_data = response.json()

    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.id == task.theme_id and models.Theme.is_active)).first()
    if not db_theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")

    db_task = models.Task(
        title=task.title,
        condition=task.condition,
        theme_id=task.theme_id,
        user_id=user_data["id"],
        answer_id=answer_data["id"],
        type=models.ProblemType.problem
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/", response_model=List[schemas.TaskCreateResponse])
def get_tasks(theme_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Task).filter(cast("ColumnElement[bool]", models.Task.is_active))
    if theme_id:
        query = query.filter(cast("ColumnElement[bool]", models.Task.theme_id == theme_id))
    return query.all()

@router.get("/task/{task_id}", response_model=schemas.TaskCreateResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    query = db.query(models.Task).filter(cast("ColumnElement[bool]", models.Task.is_active)).filter(cast("ColumnElement[bool]", models.Task.id == task_id)).first()
    return query


@router.get("/teacher", response_model=List[schemas.TaskCreateResponse])
async def get_teacher_tasks(db: Session = Depends(get_db), token: str = Depends(utils.oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "teacher" and user_data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can view their tasks")

    tasks = db.query(models.Task).filter(cast("ColumnElement[bool]", models.Task.user_id == user_data["id"] and models.Task.is_active)).all()
    return tasks


@router.put("/{task_id}", response_model=schemas.TaskCreateResponse)
async def update_task(
        task_id: int,
        task: schemas.TaskCreate,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    user_data = await get_user_data(token)
    if user_data["role"] == "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db_task = db.query(models.Task).filter(cast("ColumnElement[bool]", models.Task.id == task_id and models.Task.is_active)).first()
    if not db_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if user_data["role"] == "teacher" and db_task.user_id != user_data["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only update their own tasks")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"http://{SOLUTION_SERVICE_HOST}:{SOLUTION_SERVICE_PORT}/{SOLUTION_SERVICE_SOLUTION_PREFIX_API}/create",
            headers={"Authorization": f"Bearer {token}"},
            json={"token": token, "answer": task.answer}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code,
                                detail=response.json().get("detail", "Failed to create answer"))
        answer_data = response.json()

    db_theme = db.query(models.Theme).filter(cast("ColumnElement[bool]", models.Theme.id == task.theme_id and models.Theme.is_active)).first()
    if not db_theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")

    db_task.title = task.title
    db_task.condition = task.condition
    db_task.theme_id = task.theme_id
    db_task.answer_id = answer_data["id"]
    db_task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/{task_id}")
async def delete_task(
        task_id: int,
        db: Session = Depends(get_db),
        token: str = Depends(utils.oauth2_scheme)
):
    user_data = await get_user_data(token)
    if user_data["role"] == "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db_task = db.query(models.Task).filter(cast("ColumnElement[bool]", models.Task.id == task_id and models.Task.is_active)).first()
    if not db_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if user_data["role"] == "teacher" and db_task.user_id != user_data["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only delete their own tasks")

    db_task.is_active = False
    db_task.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Task deleted"}


@router.get("/teacher/stats")
async def get_teacher_stats(db: Session = Depends(get_db), token: str = Depends(utils.oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can view stats")

    task_count = db.query(models.Task).filter(cast("ColumnElement[bool]", models.Task.user_id == user_data["id"] and models.Task.is_active)).count()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{SOLUTION_SERVICE_HOST}:{SOLUTION_SERVICE_PORT}/{SOLUTION_SERVICE_SOLUTION_PREFIX_API}",
            headers={"Authorization": f"Bearer {token}"}
        )
        attempt_stats = response.json() if response.status_code == 200 else {"attempts": 0, "solved": 0}

    return {
        "task_count": task_count,
        "attempt_count": attempt_stats["attempts"],
        "solved_count": attempt_stats["solved"]
    }
