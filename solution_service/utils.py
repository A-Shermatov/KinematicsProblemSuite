import os

from fastapi.security import OAuth2PasswordBearer

from config import AUTH_SERVICE_HOST, AUTH_SERVICE_PORT, AUTH_SERVICE_AUTH_PREFIX_API, UPLOAD_DIR

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_AUTH_PREFIX_API}/login",
)

def ensure_directories_exist():
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)