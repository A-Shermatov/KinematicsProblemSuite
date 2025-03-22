import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models, database
import schemas
import httpx

router = APIRouter()

AUTH_SERVICE_HOST = os.getenv("AUTH_SERVICE_HOST")
AUTH_SERVICE_PORT = os.getenv("AUTH_SERVICE_PORT")
AUTH_SERVICE_POSSIBILITY_PREFIX_URL = os.getenv("AUTH_SERVICE_POSSIBILITY_PREFIX_API")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()