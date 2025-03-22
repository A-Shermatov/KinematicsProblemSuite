import os

from fastapi import FastAPI

import answer
from database import engine, Base
import submission
import logging

import uvicorn

app = FastAPI()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8003"))
ANSWER_PREFIX_API = os.getenv("ANSWER_PREFIX_API")
SUBMISSION_PREFIX_API = os.getenv("SUBMISSION_PREFIX_API")

Base.metadata.create_all(bind=engine)

app.include_router(router=answer.router, prefix=ANSWER_PREFIX_API)
app.include_router(router=submission.router, prefix=SUBMISSION_PREFIX_API)

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)