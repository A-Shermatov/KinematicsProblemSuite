from pydantic import BaseModel

from models import Role


class ImageData(BaseModel):
    image: str
    file_name: str


class UserCreate(BaseModel):
    first_name: str
    second_name: str = ""
    username: str
    role: Role = Role.student
    password: str
    image_data: ImageData = None


class UserUpdate(BaseModel):
    first_name: str
    second_name: str
    username: str
    image_data: ImageData | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str


class UserResponse(BaseModel):
    id: int
    first_name: str
    second_name: str
    username: str
    role: str
    image: str | None

    class Config:
        from_attributes = True


class TokenRefresh(BaseModel):
    token: str