from pydantic import BaseModel


class AnswerCreate(BaseModel):
    answer: str = ""


class AnswerCreateResponse(BaseModel):
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
