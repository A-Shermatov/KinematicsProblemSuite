import os
from dotenv import load_dotenv

from passlib.context import CryptContext

load_dotenv()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8001"))
PREFIX_AUTH_API = os.getenv("PREFIX_AUTH_API")
PREFIX_POSSIBILITY_API = os.getenv("PREFIX_POSSIBILITY_API")

DATABASE_URL = os.getenv("DATABASE_URL")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", f"{5 * 1024 * 1024}"))
DEFAULT_USER_IMAGE_PATH = "C:\\Users\\azamat\\PycharmProjects\\KinematicsProblemSuite\\auth_service\\public\\user\\images\\_default_user_.png"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_TYPE = os.getenv("TOKEN_TYPE", "Bearer")

BASE_DIR = "C:\\Users\\azamat\\PycharmProjects\\KinematicsProblemSuite\\auth_service\\public\\user"
UPLOAD_DIR = os.path.join(BASE_DIR, "images")