# api/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import timedelta
import os
import requests as http_requests
from google.auth.transport import requests
from google.oauth2 import id_token

from db.repository import (
    get_db,
    create_user,
    get_user_by_email,
    get_user_by_google_id,
    get_user_by_id,
    create_user_google,
    get_user_by_verification_token,
    verify_email,
    set_reset_token,
    get_user_by_reset_token,
    update_password,
    update_user_profile,
)
from api.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token,
    generate_verification_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class GoogleLoginRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str | None
    avatar_url: str | None
    email_verified: bool
    xp: int
    level: int
    streak: int

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse


def get_token_from_header(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid auth scheme")
        return token
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid auth header")


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if get_user_by_email(db, req.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = hash_password(req.password)
    user = create_user(db, req.email, hashed_pwd)
    token = create_access_token(user.id)

    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "email_verified": user.email_verified,
            "xp": user.xp,
            "level": user.level,
            "streak": user.streak,
        },
    }


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, req.email)
    if not user or not verify_password(req.password, user.hashed_password or ""):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "email_verified": user.email_verified,
            "xp": user.xp,
            "level": user.level,
            "streak": user.streak,
        },
    }


@router.post("/google-login", response_model=AuthResponse)
async def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    idinfo = None
    try:
        idinfo = id_token.verify_oauth2_token(req.token, requests.Request(), GOOGLE_CLIENT_ID)
    except ValueError:
        # Fallback for access tokens returned by the frontend OAuth flow
        response = http_requests.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            params={"alt": "json", "access_token": req.token},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid token")
        idinfo = response.json()
        if idinfo.get("audience") and idinfo["audience"] != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Invalid token")

    email = idinfo.get("email")
    google_id = idinfo.get("sub") or idinfo.get("id")
    picture = idinfo.get("picture")

    user = get_user_by_google_id(db, google_id)
    if not user:
        user = get_user_by_email(db, email)
        if user:
            user.google_id = google_id
            db.commit()
        else:
            user = create_user_google(db, email, google_id, picture)

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username or email.split("@")[0],
            "avatar_url": user.avatar_url,
            "email_verified": user.email_verified,
            "xp": user.xp,
            "level": user.level,
            "streak": user.streak,
        },
    }


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, req.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = generate_verification_token()
    set_reset_token(db, user.id, token)
    return {"message": "Password reset link sent to email", "token": token}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_reset_token(db, req.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    hashed_pwd = hash_password(req.new_password)
    update_password(db, user.id, hashed_pwd)
    return {"message": "Password reset successful"}


@router.get("/me", response_model=UserResponse)
async def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
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


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    avatar_url: str = None,
    username: str = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
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

    user = update_user_profile(db, user_id, avatar_url, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
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

    if not verify_password(old_password, user.hashed_password or ""):
        raise HTTPException(status_code=401, detail="Incorrect old password")

    hashed_pwd = hash_password(new_password)
    update_password(db, user.id, hashed_pwd)

    return {"message": "Password changed successfully"}


@router.post("/verify-email")
async def verify_email_endpoint(
    token: str,
    db: Session = Depends(get_db)
):
    user = get_user_by_verification_token(db, token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    verify_email(db, user.id)
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
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

    if user.email_verified:
        return {"message": "Email already verified"}

    verification_token = generate_verification_token()
    user.verification_token = verification_token
    db.commit()

    return {
        "message": "Verification email sent",
        "token": verification_token
    }
