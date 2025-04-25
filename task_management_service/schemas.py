from pydantic import BaseModel

class TaskCreate(BaseModel):
    title: str
    condition: str | None = None
    answer: str
    theme_id: int

class TaskCreateResponse(BaseModel):
    id: int
    title: str
    condition: str | None
    answer_id: int
    theme_id: int
    user_id: int

    class Config:
        from_attributes = True

class ThemeCreate(BaseModel):
    title: str
    description: str | None = None

class ThemeResponse(BaseModel):
    id: int
    title: str
    description: str | None

    class Config:
        from_attributes = True