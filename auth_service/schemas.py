from pydantic import BaseModel

from models import Role


class UserCreate(BaseModel):
    first_name: str
    second_name: str = ""
    username: str
    role: Role = Role.student
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


class TokenRefresh(BaseModel):
    token: str