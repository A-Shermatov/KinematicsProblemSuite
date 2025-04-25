import base64
import mimetypes
import os
from datetime import datetime, timezone
from typing import List, cast
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket
from sqlalchemy.orm import Session
import httpx
import asyncio
import logging

import models
import database
import schemas
from config import (
    AUTH_SERVICE_HOST,
    AUTH_SERVICE_PORT,
    AUTH_SERVICE_POSSIBILITY_PREFIX_API,
    TASK_SERVICE_HOST,
    TASK_SERVICE_PORT,
    TASK_SERVICE_TASK_PREFIX_API, MAX_IMAGE_SIZE, UPLOAD_DIR, TASK_SERVICE_THEME_PREFIX_API,
)
from utils import oauth2_scheme, ensure_directories_exist

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
            f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_API}/user",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code,
                                detail=response.json().get("detail", "Failed to fetch user data"))
        return response.json()


async def get_user_data_by_id(user_id: int, token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_API}/user/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code,
                                detail=response.json().get("detail", "Failed to fetch user data"))
        return response.json()


async def get_task_data(task_id: int) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{TASK_SERVICE_HOST}:{TASK_SERVICE_PORT}/{TASK_SERVICE_TASK_PREFIX_API}/task/{task_id}"
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return response.json()


async def get_theme_data(theme_id: int) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{TASK_SERVICE_HOST}:{TASK_SERVICE_PORT}/{TASK_SERVICE_THEME_PREFIX_API}/{theme_id}"
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return response.json()


@router.post("/attempts", response_model=schemas.AttemptResponse)
async def create_attempt(
        attempt: schemas.AttemptCreate,
        db: Session = Depends(get_db),
        token: str = Depends(oauth2_scheme)
):
    user_data = await get_user_data(token)
    if user_data["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can submit attempts")

    # Проверяем существование задачи
    task_data = await get_task_data(attempt.task_id)
    # Проверяем ответ
    answer = db.query(models.Answer).filter(
        cast("ColumnElement[bool]", models.Answer.id == task_data["answer_id"])).first()
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")

    # Автоматическая проверка и оценка
    is_correct = attempt.answer.strip().lower() == answer.text.strip().lower()
    system_grade = 100 if is_correct else 0
    if system_grade == 0:
        db_attempt = models.Attempt(
            task_id=attempt.task_id,
            student_id=user_data["id"],
            answer=attempt.answer,
            teacher_grade=0,
            status=schemas.AttemptStatus.GRADED,
            system_grade=system_grade
        )
    else:
        # Создаем объект попытки без изображения
        db_attempt = models.Attempt(
            task_id=attempt.task_id,
            student_id=user_data["id"],
            answer=attempt.answer,
            status=schemas.AttemptStatus.PENDING,
            system_grade=system_grade
        )

    # Сохраняем попытку в базе данных, чтобы получить ID
    db.add(db_attempt)
    db.commit()
    db.refresh(db_attempt)

    # Обработка изображения, если оно есть
    if attempt.image_data:
        try:
            ensure_directories_exist()
            image_bytes = base64.b64decode(attempt.image_data.image)
            if len(image_bytes) > MAX_IMAGE_SIZE:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image size exceeds 10MB")
            file_extension = attempt.image_data.file_name.split('.')[-1]
            safe_filename = f"attempt_{db_attempt.id}.{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, safe_filename)

            with open(file_path, "wb") as f:
                f.write(image_bytes)

            # Обновляем путь к изображению в объекте попытки
            db_attempt.image_path = file_path
            db.commit()
            db.refresh(db_attempt)
        except Exception as e:
            # Удаляем попытку в случае ошибки обработки изображения
            db.delete(db_attempt)
            db.commit()
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

    attempt = {
        'id': db_attempt.id,
        'task_id': db_attempt.task_id,
        'student_id': db_attempt.student_id,
        'answer': db_attempt.answer,
        'status': db_attempt.status,
        'system_grade': db_attempt.system_grade,
        'teacher_grade': db_attempt.teacher_grade,
        'created_at': db_attempt.created_at,
        'image_path': db_attempt.image_path,
    }
    image_path = attempt["image_path"]
    image_data = None
    if image_path and os.path.exists(image_path):
        try:
            with open(image_path, "rb") as image_file:
                base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                mime_type, _ = mimetypes.guess_type(image_path)
                mime_type = mime_type or "image/jpeg"  # Значение по умолчанию
                image_data = f"data:{mime_type};base64,{base64_string}"
        except Exception as e:
            print(f"Error reading image: {str(e)}")
    attempt["image_data"] = image_data

    return attempt


@router.get("/attempts/student", response_model=List[schemas.AttemptsResponse])
async def get_student_attempts(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can view their attempts")

    # Получаем попытки из локальной базы
    attempts = db.query(models.Attempt).filter(
        models.Attempt.student_id == user_data["id"],
        models.Attempt.is_active
    ).all()

    attempts_list = []
    for attempt in attempts:
        try:
            task_data = await get_task_data(attempt.task_id)
        except httpx.HTTPStatusError as e:
            print(f"Error fetching task {attempt.task_id}: {str(e)}")
            continue  # Пропускаем попытку, если задача недоступна
        except httpx.RequestError as e:
            print(f"Network error fetching task {attempt.task_id}: {str(e)}")
            continue

        # Запрашиваем данные темы
        try:
            theme_data = await get_theme_data(task_data['theme_id'])
        except httpx.HTTPStatusError as e:
            print(f"Error fetching theme {task_data['theme_id']}: {str(e)}")
            theme_data = {"name": "Unknown"}  # Значение по умолчанию
        except httpx.RequestError as e:
            print(f"Network error fetching theme {task_data['theme_id']}: {str(e)}")
            theme_data = {"name": "Unknown"}

        # Запрашиваем данные автора
        try:
            author_data = await get_user_data_by_id(task_data['user_id'], token)
        except httpx.HTTPStatusError as e:
            print(f"Error fetching user {task_data['user_id']}: {str(e)}")
            author_data = {"username": "Unknown"}  # Значение по умолчанию
        except httpx.RequestError as e:
            print(f"Network error fetching user {task_data['author_id']}: {str(e)}")
            author_data = {"username": "Unknown"}

        # Обрабатываем изображение
        image_data = None
        if attempt.image_path and os.path.exists(attempt.image_path):
            try:
                with open(attempt.image_path, "rb") as image_file:
                    base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                    mime_type, _ = mimetypes.guess_type(attempt.image_path)
                    mime_type = mime_type or "image/jpeg"
                    image_data = f"data:{mime_type};base64,{base64_string}"
            except Exception as e:
                print(f"Error reading image: {str(e)}")
        db_system_answer = db.query(models.Answer).filter(
            models.Answer.id == task_data["answer_id"],
                        models.Answer.is_active
        ).first()
        # Формируем запись попытки
        attempt_data = {
            "id": attempt.id,
            "task_id": task_data.get("id"),
            "task_name": task_data.get("title", "-"),
            "theme_id": theme_data.get("id"),
            "theme_name": theme_data.get("title", "-"),
            "student_id": user_data.get("id", None),
            "student_username": user_data.get("username", None),
            "task_author_id": author_data.get("id", None),
            "task_author_username": author_data.get("username", "-"),
            "system_answer": db_system_answer.text or None,
            "answer": attempt.answer,
            "status": attempt.status,
            "system_grade": attempt.system_grade,
            "teacher_grade": attempt.teacher_grade,
            "created_at": attempt.created_at,
            "image_data": image_data,
        }
        attempts_list.append(attempt_data)

    return attempts_list


@router.get("/attempts/teacher", response_model=List[schemas.AttemptsResponse])
async def get_teacher_attempts(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can view attempts")

    # Получаем все задачи учителя
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{TASK_SERVICE_HOST}:{TASK_SERVICE_PORT}/{TASK_SERVICE_TASK_PREFIX_API}/teacher",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch teacher tasks")
        teacher_tasks = response.json()

    task_ids = [task["id"] for task in teacher_tasks]
    if not task_ids:
        return []

    attempts = db.query(models.Attempt).filter(
        models.Attempt.task_id.in_(task_ids),
        cast("ColumnElement[bool]", models.Attempt.is_active)).all()
    attempts_list = []
    async with httpx.AsyncClient() as client:
        for attempt in attempts:
            try:
                task_data = await get_task_data(attempt.task_id)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching task {attempt.task_id}: {str(e)}")
                continue  # Пропускаем попытку, если задача недоступна
            except httpx.RequestError as e:
                print(f"Network error fetching task {attempt.task_id}: {str(e)}")
                continue

            # Запрашиваем данные темы
            try:
                theme_data = await get_theme_data(task_data['theme_id'])
            except httpx.HTTPStatusError as e:
                print(f"Error fetching theme {task_data['theme_id']}: {str(e)}")
                theme_data = {"name": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching theme {task_data['theme_id']}: {str(e)}")
                theme_data = {"name": "Unknown"}

            # Запрашиваем данные ученика
            try:
                student_data = await get_user_data_by_id(attempt.student_id, token)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching user {attempt.student_id}: {str(e)}")
                student_data = {"username": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching user {attempt.student_id}: {str(e)}")
                student_data = {"username": "Unknown"}

            # Обрабатываем изображение
            image_data = None
            if attempt.image_path and os.path.exists(attempt.image_path):
                try:
                    with open(attempt.image_path, "rb") as image_file:
                        base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                        mime_type, _ = mimetypes.guess_type(attempt.image_path)
                        mime_type = mime_type or "image/jpeg"
                        image_data = f"data:{mime_type};base64,{base64_string}"
                except Exception as e:
                    print(f"Error reading image: {str(e)}")
            db_system_answer = db.query(models.Answer).filter(
                models.Answer.id == task_data["answer_id"],
                models.Answer.is_active
            ).first()
            # Формируем запись попытки
            attempt_data = {
                "id": attempt.id,
                "task_id": task_data.get("id"),
                "task_name": task_data.get("title", "-"),
                "theme_id": theme_data.get("id"),
                "theme_name": theme_data.get("title", "-"),
                "student_id": student_data.get("id", None),
                "student_username": student_data.get("username", "-"),
                "task_author_id": user_data.get("id", None),
                "task_author_username": user_data.get("username", '-'),
                "system_answer": db_system_answer.text or None,
                "answer": attempt.answer,
                "status": attempt.status,
                "system_grade": attempt.system_grade,
                "teacher_grade": attempt.teacher_grade,
                "created_at": attempt.created_at,
                "image_data": image_data,
            }
            attempts_list.append(attempt_data)

    return attempts_list


@router.get("/attempts/teacher/grade", response_model=List[schemas.AttemptsResponse])
async def get_teacher_attempts(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can view attempts")

    # Получаем все задачи учителя
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{TASK_SERVICE_HOST}:{TASK_SERVICE_PORT}/{TASK_SERVICE_TASK_PREFIX_API}/teacher",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch teacher tasks")
        teacher_tasks = response.json()

    task_ids = [task["id"] for task in teacher_tasks]
    if not task_ids:
        return []

    attempts = db.query(models.Attempt).filter(
        models.Attempt.task_id.in_(task_ids),
        cast("ColumnElement[bool]",
             models.Attempt.status == models.AttemptStatus.PENDING and models.Attempt.is_active)).all()
    attempts_list = []
    async with httpx.AsyncClient() as client:
        for attempt in attempts:
            try:
                task_data = await get_task_data(attempt.task_id)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching task {attempt.task_id}: {str(e)}")
                continue  # Пропускаем попытку, если задача недоступна
            except httpx.RequestError as e:
                print(f"Network error fetching task {attempt.task_id}: {str(e)}")
                continue

            # Запрашиваем данные темы
            try:
                theme_data = await get_theme_data(task_data['theme_id'])
            except httpx.HTTPStatusError as e:
                print(f"Error fetching theme {task_data['theme_id']}: {str(e)}")
                theme_data = {"name": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching theme {task_data['theme_id']}: {str(e)}")
                theme_data = {"name": "Unknown"}

            # Запрашиваем данные ученика
            try:
                student_data = await get_user_data_by_id(attempt.student_id, token)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching user {attempt.student_id}: {str(e)}")
                student_data = {"username": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching user {attempt.student_id}: {str(e)}")
                student_data = {"username": "Unknown"}

            # Обрабатываем изображение
            image_data = None
            if attempt.image_path and os.path.exists(attempt.image_path):
                try:
                    with open(attempt.image_path, "rb") as image_file:
                        base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                        mime_type, _ = mimetypes.guess_type(attempt.image_path)
                        mime_type = mime_type or "image/jpeg"
                        image_data = f"data:{mime_type};base64,{base64_string}"
                except Exception as e:
                    print(f"Error reading image: {str(e)}")
            db_system_answer = db.query(models.Answer).filter(
                models.Answer.id == task_data["answer_id"],
                models.Answer.is_active
            ).first()
            # Формируем запись попытки
            attempt_data = {
                "id": attempt.id,
                "task_id": task_data.get("id"),
                "task_name": task_data.get("title", "-"),
                "theme_id": theme_data.get("id"),
                "theme_name": theme_data.get("title", "-"),
                "student_id": student_data.get("id", None),
                "student_username": student_data.get("username", "-"),
                "task_author_id": user_data.get("id", None),
                "task_author_username": user_data.get("username", '-'),
                "system_answer": db_system_answer.text or None,
                "answer": attempt.answer,
                "status": attempt.status,
                "system_grade": attempt.system_grade,
                "teacher_grade": attempt.teacher_grade,
                "created_at": attempt.created_at,
                "image_data": image_data,
            }
            attempts_list.append(attempt_data)

    return attempts_list


@router.get("/attempts/admin", response_model=List[schemas.AttemptsResponse])
async def get_all_attempts(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view all attempts")

    attempts = db.query(models.Attempt).filter(cast("ColumnElement[bool]", models.Attempt.is_active)).all()
    attempts_list = []
    async with httpx.AsyncClient() as client:
        for attempt in attempts:
            try:
                task_data = await get_task_data(attempt.task_id)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching task {attempt.task_id}: {str(e)}")
                continue  # Пропускаем попытку, если задача недоступна
            except httpx.RequestError as e:
                print(f"Network error fetching task {attempt.task_id}: {str(e)}")
                continue

            # Запрашиваем данные темы
            try:
                theme_data = await get_theme_data(task_data['theme_id'])
            except httpx.HTTPStatusError as e:
                print(f"Error fetching theme {task_data['theme_id']}: {str(e)}")
                theme_data = {"name": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching theme {task_data['theme_id']}: {str(e)}")
                theme_data = {"name": "Unknown"}

            # Запрашиваем данные ученика
            try:
                student_data = await get_user_data_by_id(attempt.student_id, token)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching user {attempt.student_id}: {str(e)}")
                student_data = {"username": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching user {attempt.student_id}: {str(e)}")
                student_data = {"username": "Unknown"}

            # Запрашиваем данные автора
            try:
                author_data = await get_user_data_by_id(task_data['user_id'], token)
            except httpx.HTTPStatusError as e:
                print(f"Error fetching user {task_data['user_id']}: {str(e)}")
                author_data = {"username": "Unknown"}  # Значение по умолчанию
            except httpx.RequestError as e:
                print(f"Network error fetching user {task_data['author_id']}: {str(e)}")
                author_data = {"username": "Unknown"}

            # Обрабатываем изображение
            image_data = None
            if attempt.image_path and os.path.exists(attempt.image_path):
                try:
                    with open(attempt.image_path, "rb") as image_file:
                        base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                        mime_type, _ = mimetypes.guess_type(attempt.image_path)
                        mime_type = mime_type or "image/jpeg"
                        image_data = f"data:{mime_type};base64,{base64_string}"
                except Exception as e:
                    print(f"Error reading image: {str(e)}")
            db_system_answer = db.query(models.Answer).filter(
                models.Answer.id == task_data["answer_id"],
                models.Answer.is_active
            ).first()
            # Формируем запись попытки
            attempt_data = {
                "id": attempt.id,
                "task_id": task_data.get("id"),
                "task_name": task_data.get("title", "-"),
                "theme_id": theme_data.get("id"),
                "theme_name": theme_data.get("title", "-"),
                "student_id": student_data.get("id", None),
                "student_username": student_data.get("username", "-"),
                "task_author_id": author_data.get("id", None),
                "task_author_username": author_data.get("username", "-"),
                "system_answer": db_system_answer.text or None,
                "answer": attempt.answer,
                "status": attempt.status,
                "system_grade": attempt.system_grade,
                "teacher_grade": attempt.teacher_grade,
                "created_at": attempt.created_at,
                "image_data": image_data,
            }
            attempts_list.append(attempt_data)

    return attempts_list


@router.post("/attempts/{attempt_id}/grade", response_model=schemas.AttemptResponse)
async def grade_attempt(
        attempt_id: int,
        grade: schemas.GradeAttempt,
        db: Session = Depends(get_db),
        token: str = Depends(oauth2_scheme)
):
    user_data = await get_user_data(token)
    if user_data["role"] != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can grade attempts")

    db_attempt = db.query(models.Attempt).filter(
        cast("ColumnElement[bool]", models.Attempt.id == attempt_id and models.Attempt.is_active)).first()
    if not db_attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

    # Проверяем, принадлежит ли задача учителю
    task_data = await get_task_data(db_attempt.task_id, token)
    if task_data["user_id"] != user_data["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Teachers can only grade attempts for their own tasks")

    if grade.teacher_grade < 0 or grade.teacher_grade > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teacher grade must be between 0 and 100")

    # Если система дала 100 и учитель подтверждает (teacher_grade >= 90), статус CORRECT
    if db_attempt.system_grade == 100 and grade.teacher_grade >= 90:
        db_attempt.status = models.AttemptStatus.CORRECT
    else:
        db_attempt.status = models.AttemptStatus.GRADED

    db_attempt.teacher_grade = grade.teacher_grade
    db_attempt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_attempt)
    attempt = {
        'id': db_attempt.id,
        'task_id': db_attempt.task_id,
        'student_id': db_attempt.student_id,
        'answer': db_attempt.answer,
        'status': db_attempt.status,
        'system_grade': db_attempt.system_grade,
        'teacher_grade': db_attempt.teacher_grade,
        'created_at': db_attempt.created_at,
        'image_path': db_attempt.image_path,
    }
    image_path = attempt["image_path"]
    image_data = None
    if image_path and os.path.exists(image_path):
        try:
            with open(image_path, "rb") as image_file:
                base64_string = base64.b64encode(image_file.read()).decode("utf-8")
                mime_type, _ = mimetypes.guess_type(image_path)
                mime_type = mime_type or "image/jpeg"  # Значение по умолчанию
                image_data = f"data:{mime_type};base64,{base64_string}"
        except Exception as e:
            print(f"Error reading image: {str(e)}")
    attempt["image_data"] = image_data

    return attempt


@router.get("/teacher/stats")
async def get_teacher_stats(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_data = await get_user_data(token)
    if user_data["role"] != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can view stats")

    # Получаем задачи учителя
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{TASK_SERVICE_HOST}:{TASK_SERVICE_PORT}/{TASK_SERVICE_TASK_PREFIX_API}/teacher",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch teacher tasks")
        teacher_tasks = response.json()

    task_ids = [task["id"] for task in teacher_tasks]
    if not task_ids:
        return {"attempts": 0, "solved": 0}

    attempt_count = db.query(models.Attempt).filter(
        models.Attempt.task_id.in_(task_ids),
        cast("ColumnElement[bool]", models.Attempt.is_active)).count()
    solved_count = db.query(models.Attempt).filter(
        models.Attempt.task_id.in_(task_ids),
        cast("ColumnElement[bool]",
             models.Attempt.status == models.AttemptStatus.CORRECT and models.Attempt.is_active)).count()
    return {"attempts": attempt_count, "solved": solved_count}


@router.websocket("/ws/teacher/{teacher_id}")
async def notify_teacher(websocket: WebSocket, teacher_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        # Проверяем, что teacher_id соответствует токену
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_POSSIBILITY_PREFIX_API}/user",
                headers={"Authorization": f"Bearer {websocket.headers.get('authorization', '').replace('Bearer ', '')}"}
            )
            if response.status_code != 200 or response.json()["id"] != teacher_id:
                await websocket.close()
                return

        while True:
            # Получаем задачи учителя
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://{TASK_SERVICE_HOST}:{TASK_SERVICE_PORT}/{TASK_SERVICE_TASK_PREFIX_API}/teacher",
                    headers={
                        "Authorization": f"Bearer {websocket.headers.get('authorization', '').replace('Bearer ', '')}"}
                )
                if response.status_code != status.HTTP_200_OK:
                    continue
                teacher_tasks = response.json()

            task_ids = [task["id"] for task in teacher_tasks]
            if task_ids:
                new_attempts = db.query(models.Attempt).filter(
                    models.Attempt.task_id.in_(task_ids),
                    cast("ColumnElement[bool]",
                         models.Attempt.status == models.AttemptStatus.PENDING and models.Attempt.is_active)).all()
                for attempt in new_attempts:
                    await websocket.send_json({
                        "attempt_id": attempt.id,
                        "task_id": attempt.task_id,
                        "student_id": attempt.student_id,
                        "answer": attempt.answer,
                        "system_grade": attempt.system_grade
                    })
            await asyncio.sleep(10)
    except Exception as e:
        await websocket.close()
        logging.error(f"WebSocket error: {str(e)}")
