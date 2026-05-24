# api/routers/auth.py
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.repository import get_db, create_user, get_user_by_username
from api.services.auth import authenticate_user, create_access_token, get_password_hash, get_current_user
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: int
    username: str
    class Config:
        orm_mode = True   # or from_attributes = True for Pydantic v2

@router.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"Register attempt for user: {user.username}")
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        logger.warning(f"Registration failed - username {user.username} already exists")
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed = get_password_hash(user.password)
    new_user = create_user(db, username=user.username, hashed_password=hashed)
    access_token = create_access_token(data={"sub": new_user.username})
    logger.info(f"User {user.username} registered successfully, token created")
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(user: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"Login attempt for user: {user.username}")
    db_user = authenticate_user(db, user.username, user.password)
    if not db_user:
        logger.warning(f"Login failed for user {user.username} - invalid credentials")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token = create_access_token(data={"sub": db_user.username})
    logger.info(f"User {user.username} logged in successfully, token created")
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    logger.info(f"Fetching profile for user: {current_user.username}")
    return current_user