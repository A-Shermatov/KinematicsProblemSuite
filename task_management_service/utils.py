from fastapi.security import OAuth2PasswordBearer

from config import AUTH_SERVICE_HOST, AUTH_SERVICE_PORT, AUTH_SERVICE_AUTH_PREFIX_API

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"http://{AUTH_SERVICE_HOST}:{AUTH_SERVICE_PORT}/{AUTH_SERVICE_AUTH_PREFIX_API}/login",
)