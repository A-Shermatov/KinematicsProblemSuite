import datetime
import enum

from sqlalchemy import Column, Integer, String, Enum, Boolean, DateTime, Text

from database import Base


class Role(enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class ProblemType(enum.Enum):
    problem = "problem"
    test = "test"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer(), primary_key=True, index=True)

    title = Column(String(50), nullable=False)
    condition = Column(Text())
    type = Column(Enum(ProblemType), default=ProblemType.problem)

    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))

    theme_id = Column(Integer(), nullable=False)
    answer_id = Column(Integer(), nullable=False)
    user_id = Column(Integer(), nullable=False) # author, i.e. teacher


class Theme(Base):
    __tablename__ = "themes"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(100), nullable=False)
    description = Column(Text(), default=None)

    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
