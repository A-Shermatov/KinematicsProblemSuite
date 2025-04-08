from pydantic import BaseModel

from models import ProblemType


class TaskCreate(BaseModel):
    title: str
    condition: str = None
    type: ProblemType = ProblemType.problem
    answer: str

    theme_id: int


class TaskCreateResponse(BaseModel):
    id: int

    class Config:
        from_attributes = True


class ThemeCreate(BaseModel):
    title: str
    description: str = None


class ThemeResponse(BaseModel):
    id: int
    title: str
    description: str
