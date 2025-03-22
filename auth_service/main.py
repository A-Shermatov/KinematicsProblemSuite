import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import possibility
from database import engine, Base
import auth
import logging

import uvicorn

app = FastAPI()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8001"))
PREFIX_AUTH_API = os.getenv("PREFIX_AUTH_API")
PREFIX_POSSIBILITY_API = os.getenv("PREFIX_POSSIBILITY_API")

Base.metadata.create_all(bind=engine)


origins = [
    "http://localhost:3000",
   "http://127.0.0.1:8002",
]

app.add_middleware(
       CORSMiddleware,
       allow_origins=origins,  # Список разрешенных источников
       allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],  # Явно указываем методы
        allow_headers=["Content-Type", "Authorization"],  # или перечислите нужные заголовки
   )


app.include_router(router=auth.router, prefix=PREFIX_AUTH_API)
app.include_router(router=possibility.router, prefix=PREFIX_POSSIBILITY_API)

logging.basicConfig(level=logging.INFO)

@app.middleware("http")
async def log_requests(request, call_next):
    logging.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logging.info(f"Response status: {response.status_code}")
    return response

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)