import os
from dotenv import load_dotenv

# Загружаем .env
load_dotenv()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8003"))
SOLUTION_PREFIX_API = os.getenv("SOLUTION_PREFIX_API", "/api/solutions")

DATABASE_URL = str(os.getenv("DATABASE_URL"))

AUTH_SERVICE_HOST = os.getenv("AUTH_SERVICE_HOST")
AUTH_SERVICE_PORT = os.getenv("AUTH_SERVICE_PORT")
AUTH_SERVICE_AUTH_PREFIX_API = os.getenv("AUTH_SERVICE_AUTH_PREFIX_API")
AUTH_SERVICE_POSSIBILITY_PREFIX_API = os.getenv("AUTH_SERVICE_POSSIBILITY_PREFIX_API")

TASK_SERVICE_HOST=os.getenv("TASK_SERVICE_HOST")
TASK_SERVICE_PORT=os.getenv("TASK_SERVICE_PORT")
TASK_SERVICE_TASK_PREFIX_API=os.getenv("TASK_SERVICE_TASK_PREFIX_API")
TASK_SERVICE_THEME_PREFIX_API=os.getenv("TASK_SERVICE_THEME_PREFIX_API")

MAX_IMAGE_SIZE = 10 * 1024 * 1024
BASE_DIR = os.getenv("BASE_DIR", "C:\\Users\\azamat\\PycharmProjects\\KinematicsProblemSuite\\solution_service\\public\\attempts")
UPLOAD_DIR = os.path.join(BASE_DIR, os.getenv("UPLOAD_DIR", "images"))