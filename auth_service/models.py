import datetime

from sqlalchemy import Column, Integer, String, Enum, Boolean, DateTime
from sqlalchemy.orm import relationship

from database import Base
import enum


class Role(enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(20), nullable=False)
    second_name = Column(String(20), default="")
    username = Column(String(50), unique=True, index=True, nullable=False)
    role = Column(Enum(Role), default=Role.student)
    password = Column(String(128), nullable=False)
    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))


class Token(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(256), unique=True, index=True, nullable=False)
    token_type = Column(String(50), nullable=False)
    secret_key = Column(String(50), nullable=False)
    algorithm = Column(String(20), nullable=False)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
