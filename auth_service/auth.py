from fastapi import APIRouter, Request
from sqlalchemy.sql.sqltypes import Boolean

import schemas
from schemas import TokenRefresh

from utils import *

router = APIRouter()

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

DEFAULT_USER_IMAGE_PATH = "C:\\Users\\azamat\\PycharmProjects\\KinematicsProblemSuite\\auth_service\\public\\user\\images\\_default_user_.png"

@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed_password = hash_password(user.password)

    check_user = db.query(models.User).filter(
        cast("ColumnElement[bool]", models.User.username == user.username)
    ).first()

    if check_user:
        raise HTTPException(
            status_code=status.HTTP_406_NOT_ACCEPTABLE,
            detail="User with this username already exists"
        )

    file_path = None
    if user.image_data:
        try:
            ensure_directories_exist()
            image_bytes = base64.b64decode(user.image_data.image)
            file_extension = user.image_data.file_name.split('.')[-1]
            safe_filename = f"image_{user.username}.{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, safe_filename)

            with open(file_path, "wb") as f:
                f.write(image_bytes)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

    # Создаем нового пользователя
    db_user = models.User(
        first_name=user.first_name,
        second_name=user.second_name,
        role=user.role,
        username=user.username,
        password=hashed_password,
        image_path=file_path if file_path is not None else DEFAULT_USER_IMAGE_PATH,  # Используем значение по умолчанию, если file_path не задан
    )

    # Сохраняем в базу данных
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login")
async def login(request: Request, user: schemas.UserLogin = Depends(validate_auth_user), db: Session = Depends(get_db)):
    # print(request.headers)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    add_token(token=access_token, db=db)
    return {"access_token": access_token, "token_type": TOKEN_TYPE}


@router.post("/token/refresh")
def refresh_token(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    data = decode_token(token)
    username = data['sub']

    db_user = db.query(models.User).filter(cast("ColumnElement[bool]", models.User.username == username)).filter(cast("ColumnElement[bool]", models.User.is_active)).first()
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(data={"sub": db_user.username}, expires_delta=access_token_expires)
    add_token(token=new_access_token, db=db)
    return {"access_token": new_access_token, "token_type": "bearer"}