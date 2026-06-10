# api/services/auth.py
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from db.repository import get_db, get_user_by_id

APP_ENV = os.getenv("APP_ENV", "development").lower()
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-insecure-secret-change-me")
if APP_ENV == "production" and SECRET_KEY == "dev-insecure-secret-change-me":
    raise RuntimeError("JWT_SECRET_KEY must be set in production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def get_admin_emails() -> set[str]:
    return {
        email.strip().lower()
        for email in os.getenv("ADMIN_EMAILS", "").split(",")
        if email.strip()
    }


def is_admin_email(email: str | None) -> bool:
    return bool(email and email.lower() in get_admin_emails())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta is None:
        expires_delta = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid auth scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid auth header")

    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


async def require_admin(current_user=Depends(get_current_user)):
    if not is_admin_email(current_user.email):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)
