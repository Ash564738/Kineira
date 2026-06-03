# db/repository.py
from datetime import datetime, timedelta
from typing import Generator, List, Optional

from sqlalchemy.orm import Session, sessionmaker

from db.models import Attempt, Lesson, Progress, Sign, User, Achievement, engine

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_user(db: Session, email: str, hashed_password: str, username: str = None) -> User:
    user = User(email=email, hashed_password=hashed_password, username=username or email.split('@')[0])
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user_google(db: Session, email: str, google_id: str, avatar_url: str = None) -> User:
    username = email.split("@")[0] if email else None
    user = User(
        email=email,
        username=username,
        google_id=google_id,
        avatar_url=avatar_url,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_google_id(db: Session, google_id: str) -> Optional[User]:
    return db.query(User).filter(User.google_id == google_id).first()


def get_user_by_verification_token(db: Session, token: str) -> Optional[User]:
    return db.query(User).filter(User.verification_token == token).first()


def get_user_by_reset_token(db: Session, token: str) -> Optional[User]:
    user = db.query(User).filter(User.password_reset_token == token).first()
    if user and user.reset_token_expires > datetime.utcnow():
        return user
    return None


def verify_email(db: Session, user_id: int) -> User:
    user = get_user_by_id(db, user_id)
    if user:
        user.email_verified = True
        user.verification_token = None
        db.commit()
        db.refresh(user)
    return user


def set_reset_token(db: Session, user_id: int, token: str) -> User:
    user = get_user_by_id(db, user_id)
    if user:
        user.password_reset_token = token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        db.refresh(user)
    return user


def update_password(db: Session, user_id: int, hashed_password: str) -> User:
    user = get_user_by_id(db, user_id)
    if user:
        user.hashed_password = hashed_password
        user.password_reset_token = None
        user.reset_token_expires = None
        db.commit()
        db.refresh(user)
    return user


def update_user_profile(db: Session, user_id: int, avatar_url: str = None, username: str = None) -> User:
    user = get_user_by_id(db, user_id)
    if user:
        if avatar_url:
            user.avatar_url = avatar_url
        if username:
            user.username = username
        db.commit()
        db.refresh(user)
    return user


def add_xp(db: Session, user_id: int, xp: int) -> User:
    user = get_user_by_id(db, user_id)
    if user:
        user.xp += xp
        if user.xp >= user.level * 100:
            user.level += 1
        db.commit()
        db.refresh(user)
    return user

def update_user_streak(db: Session, user_id: int) -> User:
    """Tăng streak lên 1 và cập nhật last_practice_date"""
    user = get_user_by_id(db, user_id)
    if user:
        user.streak += 1
        user.last_practice_date = datetime.utcnow()
        db.commit()
        db.refresh(user)
    return user

def create_sign(db: Session, name: str, description: str = "", difficulty_level: int = 1) -> Sign:
    sign = Sign(name=name, description=description, difficulty_level=difficulty_level)
    db.add(sign)
    db.commit()
    db.refresh(sign)
    return sign


def get_sign_by_id(db: Session, sign_id: int) -> Optional[Sign]:
    return db.query(Sign).filter(Sign.id == sign_id).first()


def get_lessons(db: Session) -> List[Lesson]:
    return db.query(Lesson).all()


def get_lesson_by_id(db: Session, lesson_id: int) -> Optional[Lesson]:
    return db.query(Lesson).filter(Lesson.id == lesson_id).first()


def create_lesson(db: Session, title: str, description: str, sign_id: int) -> Lesson:
    lesson = Lesson(title=title, description=description, sign_id=sign_id)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


def update_progress(db: Session, user_id: int, sign_id: int, score: float) -> Progress:
    progress = db.query(Progress).filter(Progress.user_id == user_id, Progress.sign_id == sign_id).first()
    if not progress:
        progress = Progress(user_id=user_id, sign_id=sign_id, attempts_count=0, best_score=0.0, completed=0)

    progress.attempts_count += 1
    progress.last_attempt_at = datetime.utcnow()
    if score > progress.best_score:
        progress.best_score = score
    if score >= 80:
        progress.completed = 1

    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def create_attempt(
    db: Session,
    user_id: int,
    lesson_id: int,
    sign_id: int,
    score: float,
    feedback: str,
    landmarks_data: str = "",
) -> Attempt:
    attempt = Attempt(
        user_id=user_id,
        lesson_id=lesson_id,
        sign_id=sign_id,
        score=score,
        feedback=feedback,
        landmarks_data=landmarks_data,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    update_progress(db, user_id, sign_id, score)
    if score >= 80:
        add_xp(db, user_id, 10)

    # Cập nhật last_practice_date của user (luôn luôn, bất kể điểm)
    user = get_user_by_id(db, user_id)
    if user:
        user.last_practice_date = datetime.utcnow()
        db.commit()

    return attempt

def get_user_progress(db: Session, user_id: int) -> List[Progress]:
    return db.query(Progress).filter(Progress.user_id == user_id).all()


def get_user_attempts(db: Session, user_id: int) -> List[Attempt]:
    return db.query(Attempt).filter(Attempt.user_id == user_id).order_by(Attempt.created_at.desc()).all()
