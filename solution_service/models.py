import datetime
import enum
from sqlalchemy import Column, Integer, String, Enum, Boolean, DateTime, Text
from database import Base

class AttemptStatus(enum.Enum):
    PENDING = "pending"
    CORRECT = "correct"
    GRADED = "graded"

class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, nullable=False)  # Без ForeignKey, проверяется через API
    student_id = Column(Integer, nullable=False)  # Без ForeignKey, проверяется через API
    answer = Column(Text, nullable=False)
    status = Column(Enum(AttemptStatus), nullable=False)
    system_grade = Column(Integer, nullable=True)
    teacher_grade = Column(Integer, nullable=True)
    image_path = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    user_id = Column(Integer, nullable=False)  # Без ForeignKey, для учителя
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=datetime.datetime.now(datetime.timezone.utc))