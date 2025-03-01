from pydantic import BaseModel

from models import ProblemType


class TaskCreate(BaseModel):
    title: str
    condition: str = None
    type: ProblemType = ProblemType.problem
    answer: str

    theme_id: int
    token: str


class TaskCreateResponse(BaseModel):
    id: int

    class Config:
        from_attributes = True


class ThemeCreate(BaseModel):
    title: str
    description: str = None
    token: str


class ThemeResponse(BaseModel):
    id: int

    class Config:
        from_attributes = True
