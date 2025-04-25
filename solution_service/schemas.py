from datetime import datetime

from pydantic import BaseModel
from enum import Enum

class AttemptStatus(str, Enum):
    PENDING = "pending"
    CORRECT = "correct"
    GRADED = "graded"

class ImageData(BaseModel):
    image: str
    file_name: str

class AttemptCreate(BaseModel):
    task_id: int
    answer: str
    image_data: ImageData = None

class AttemptResponse(BaseModel):
    id: int
    task_id: int
    student_id: int
    answer: str
    status: AttemptStatus
    system_grade: int | None
    teacher_grade: int | None
    created_at: datetime
    image_data: str | None

    class Config:
        from_attributes = True


class AttemptsResponse(BaseModel):
    id: int
    task_id: int
    task_name: str
    theme_id: int
    theme_name: str
    student_id: int | None
    student_username: str | None
    task_author_id: int | None
    task_author_username: str | None
    system_answer: str
    answer: str
    status: AttemptStatus
    system_grade: int | None
    teacher_grade: int | None
    created_at: datetime
    image_data: str | None

    class Config:
        from_attributes = True

class GradeAttempt(BaseModel):
    teacher_grade: int

class AnswerCreate(BaseModel):
    answer: str

class AnswerResponse(BaseModel):
    id: int
    text: str
    user_id: int

    class Config:
        from_attributes = True