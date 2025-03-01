import os

from fastapi import FastAPI

import theme
from database import engine, Base
import task
import logging

import uvicorn

app = FastAPI()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8001"))
TASK_PREFIX_API = os.getenv("TASK_PREFIX_API")
THEME_PREFIX_API = os.getenv("THEME_PREFIX_API")

Base.metadata.create_all(bind=engine)

app.include_router(router=task.router, prefix=TASK_PREFIX_API)
app.include_router(router=theme.router, prefix=THEME_PREFIX_API)

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)