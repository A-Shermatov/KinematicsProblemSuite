import os

from fastapi import FastAPI

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

app.include_router(router=auth.router, prefix=PREFIX_AUTH_API)
app.include_router(router=possibility.router, prefix=PREFIX_POSSIBILITY_API)

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)