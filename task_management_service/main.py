import os

from fastapi import FastAPI

import theme
from database import engine, Base
from fastapi.middleware.cors import CORSMiddleware
import task
import logging

import uvicorn

app = FastAPI()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8001"))
TASK_PREFIX_API = os.getenv("TASK_PREFIX_API")
THEME_PREFIX_API = os.getenv("THEME_PREFIX_API")

Base.metadata.create_all(bind=engine)

origins = [
    "http://localhost:3000",
   "http://127.0.0.1:8001",
    "http://127.0.0.1:8003",
]

app.add_middleware(
       CORSMiddleware,
       allow_origins=origins,  # Список разрешенных источников
       allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],  # Явно указываем методы
        allow_headers=["Content-Type", "Authorization"],  # или перечислите нужные заголовки
   )

app.include_router(router=task.router, prefix=TASK_PREFIX_API)
app.include_router(router=theme.router, prefix=THEME_PREFIX_API)

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)