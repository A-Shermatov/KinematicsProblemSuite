from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta, timezone
import uvicorn
import logging

from database import engine, Base, SessionLocal
import auth
import possibility
from models import AccessRefreshToken
from config import PREFIX_AUTH_API, PREFIX_POSSIBILITY_API, REFRESH_TOKEN_EXPIRE_DAYS, HOST, PORT


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup
    logging.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logging.info("Tables created")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(clean_expired_tokens, "interval", hours=24)
    scheduler.start()
    logging.info("Scheduler started")

    yield

    # Shutdown
    logging.info("Shutting down...")


app = FastAPI(lifespan=lifespan)

# CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:8002",
    "http://localhost:8002",
    "http://127.0.0.1:8003",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

# Логирование запросов
logging.basicConfig(level=logging.INFO)


@app.middleware("http")
async def log_requests(request, call_next):
    logging.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logging.info(f"Response status: {response.status_code}")
    return response


# Маршруты
app.include_router(router=auth.router, prefix=PREFIX_AUTH_API)
app.include_router(router=possibility.router, prefix=PREFIX_POSSIBILITY_API)


def clean_expired_tokens():
    db = SessionLocal()
    try:
        db.query(AccessRefreshToken).filter(
            AccessRefreshToken.created_at < datetime.now(timezone.utc) - timedelta(
                days=REFRESH_TOKEN_EXPIRE_DAYS)
        ).delete()
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)