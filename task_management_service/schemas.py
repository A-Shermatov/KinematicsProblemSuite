from pydantic import BaseModel

from models import ProblemType


class TaskCreate(BaseModel):
    title: str
    condition: str = None
    answer: str

    theme_id: int


class TaskCreateResponse(BaseModel):
    id: int
    title: str
    condition: str

    answer_id: int
    user_id: int

    class Config:
        from_attributes = True


class ThemeCreate(BaseModel):
    title: str
    description: str = None


class ThemeResponse(BaseModel):
    id: int
    title: str
    description: str
