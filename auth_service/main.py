import os

from fastapi import FastAPI
from database import engine, Base
import auth
import logging

import uvicorn

app = FastAPI()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8001"))
PREFIX_URL = os.getenv("PREFIX_API")

Base.metadata.create_all(bind=engine)

app.include_router(router=auth.router, prefix=PREFIX_URL)

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)