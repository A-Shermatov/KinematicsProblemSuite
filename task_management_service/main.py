from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import logging
import uvicorn

import task
import theme
from database import engine, Base
from config import HOST, PORT, TASK_PREFIX_API, THEME_PREFIX_API

app = FastAPI()



Base.metadata.create_all(bind=engine)

origins = [
    "http://localhost:3000",
    "http://localhost:8001",
    "http://localhost:8003",

    "http://127.0.0.1:3000",
    "http://127.0.0.1:8001",
    "http://127.0.0.1:8003",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Список разрешенных источников
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],  # или перечислите нужные заголовки
)

app.include_router(router=task.router, prefix=TASK_PREFIX_API)
app.include_router(router=theme.router, prefix=THEME_PREFIX_API)

logging.basicConfig(level=logging.INFO)


@app.middleware("http")
async def log_requests(request, call_next):
    logging.info(f"Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        logging.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        raise


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
