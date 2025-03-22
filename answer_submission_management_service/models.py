import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from database import Base


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer(), primary_key=True, index=True)

    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))

    answer = Column(String(50))


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer(), primary_key=True, index=True)

    user_id = Column(Integer, nullable=False)
    task_id = Column(Integer, nullable=False)

    image_base64 = Column(Text(), default=None)

    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))

    answer = Column(String(50))
    is_correct = Column(Boolean(), default=False)