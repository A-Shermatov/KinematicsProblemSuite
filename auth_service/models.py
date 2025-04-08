import datetime

from sqlalchemy import Column, Integer, String, Enum, Boolean, DateTime, Text
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
    image_path = Column(Text(), default="C:\\Users\\azamat\\PycharmProjects\\KinematicsProblemSuite\\auth_service\\public\\user\\images\\_default_user_.png")


class AccessRefreshToken(Base):
    __tablename__ = "access_tokens"

    id = Column(Integer, primary_key=True, index=True)
    access_token = Column(String(256), unique=True, index=True, nullable=False)
    refresh_token = Column(String(256), unique=True, index=True, nullable=False)
    token_type = Column(String(50), nullable=False)
    secret_key = Column(String(50), nullable=False)
    algorithm = Column(String(20), nullable=False)
    created_at = Column(DateTime(), default=datetime.datetime.now(datetime.timezone.utc))
