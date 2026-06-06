# db/repository.py
import logging
from datetime import datetime, timedelta
from typing import Generator, List, Optional

from sqlalchemy.orm import Session, sessionmaker

from db.models import Attempt, Lesson, Progress, Sign, User, Achievement, engine

logger = logging.getLogger(__name__)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_user(db: Session, email: str, hashed_password: str, username: str = None) -> User:
    logger.debug("Creating user with email=%s, username=%s", email, username)
    user = User(email=email, hashed_password=hashed_password, username=username or email.split('@')[0])
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("User created with id=%s", user.id)
    return user


def create_user_google(db: Session, email: str, google_id: str, avatar_url: str = None) -> User:
    logger.debug("Creating Google user with email=%s, google_id=%s", email, google_id)
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
    logger.info("Google user created with id=%s", user.id)
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    logger.debug("Fetching user by id=%s", user_id)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        logger.debug("User found: %s", user.email)
    else:
        logger.debug("User with id=%s not found", user_id)
    return user


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    logger.debug("Fetching user by email=%s", email)
    user = db.query(User).filter(User.email == email).first()
    logger.debug("Result: %s", "found" if user else "not found")
    return user


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    logger.debug("Fetching user by username=%s", username)
    user = db.query(User).filter(User.username == username).first()
    logger.debug("Result: %s", "found" if user else "not found")
    return user


def get_user_by_google_id(db: Session, google_id: str) -> Optional[User]:
    logger.debug("Fetching user by google_id=%s", google_id)
    user = db.query(User).filter(User.google_id == google_id).first()
    logger.debug("Result: %s", "found" if user else "not found")
    return user


def get_user_by_verification_token(db: Session, token: str) -> Optional[User]:
    logger.debug("Fetching user by verification token")
    user = db.query(User).filter(User.verification_token == token).first()
    logger.debug("Result: %s", "found" if user else "not found")
    return user


def get_user_by_reset_token(db: Session, token: str) -> Optional[User]:
    logger.debug("Fetching user by reset token")
    user = db.query(User).filter(User.password_reset_token == token).first()
    if user and user.reset_token_expires > datetime.utcnow():
        logger.debug("Valid reset token for user %s", user.id)
        return user
    logger.debug("Reset token invalid or expired")
    return None


def verify_email(db: Session, user_id: int) -> User:
    logger.debug("Verifying email for user %s", user_id)
    user = get_user_by_id(db, user_id)
    if user:
        user.email_verified = True
        user.verification_token = None
        db.commit()
        db.refresh(user)
        logger.info("Email verified for user %s", user_id)
    else:
        logger.warning("User %s not found for email verification", user_id)
    return user


def set_reset_token(db: Session, user_id: int, token: str) -> User:
    logger.debug("Setting reset token for user %s", user_id)
    user = get_user_by_id(db, user_id)
    if user:
        user.password_reset_token = token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        db.refresh(user)
        logger.info("Reset token set for user %s", user_id)
    else:
        logger.warning("User %s not found for reset token", user_id)
    return user


def update_password(db: Session, user_id: int, hashed_password: str) -> User:
    logger.debug("Updating password for user %s", user_id)
    user = get_user_by_id(db, user_id)
    if user:
        user.hashed_password = hashed_password
        user.password_reset_token = None
        user.reset_token_expires = None
        db.commit()
        db.refresh(user)
        logger.info("Password updated for user %s", user_id)
    else:
        logger.warning("User %s not found for password update", user_id)
    return user


def update_user_profile(db: Session, user_id: int, avatar_url: str = None, username: str = None) -> User:
    logger.debug("Updating profile for user %s (avatar=%s, username=%s)", user_id, avatar_url, username)
    user = get_user_by_id(db, user_id)
    if user:
        if avatar_url:
            user.avatar_url = avatar_url
        if username:
            user.username = username
        db.commit()
        db.refresh(user)
        logger.info("Profile updated for user %s", user_id)
    else:
        logger.warning("User %s not found for profile update", user_id)
    return user


def add_xp(db: Session, user_id: int, xp: int) -> User:
    logger.debug("Adding %d XP to user %s", xp, user_id)
    user = get_user_by_id(db, user_id)
    if user:
        old_xp = user.xp
        old_level = user.level
        user.xp += xp
        if user.xp >= user.level * 100:
            user.level += 1
            logger.info("User %s leveled up to %d", user_id, user.level)
        db.commit()
        db.refresh(user)
        logger.debug("User %s XP: %d -> %d, level: %d -> %d", user_id, old_xp, user.xp, old_level, user.level)
    else:
        logger.warning("User %s not found for XP addition", user_id)
    return user

def update_user_streak(db: Session, user_id: int) -> User:
    logger.debug("Updating streak for user %s", user_id)
    user = get_user_by_id(db, user_id)
    if user:
        user.streak += 1
        user.last_practice_date = datetime.utcnow()
        db.commit()
        db.refresh(user)
        logger.info("User %s streak increased to %d", user_id, user.streak)
    else:
        logger.warning("User %s not found for streak update", user_id)
    return user

def create_sign(db: Session, name: str, description: str = "", difficulty_level: int = 1) -> Sign:
    logger.debug("Creating sign %s (difficulty=%d)", name, difficulty_level)
    sign = Sign(name=name, description=description, difficulty_level=difficulty_level)
    db.add(sign)
    db.commit()
    db.refresh(sign)
    logger.info("Sign created with id=%s", sign.id)
    return sign


def get_sign_by_id(db: Session, sign_id: int) -> Optional[Sign]:
    logger.debug("Fetching sign by id=%s", sign_id)
    sign = db.query(Sign).filter(Sign.id == sign_id).first()
    if sign:
        logger.debug("Sign found: %s", sign.name)
    else:
        logger.debug("Sign id=%s not found", sign_id)
    return sign


def get_lessons(db: Session) -> List[Lesson]:
    logger.debug("Fetching all lessons")
    lessons = db.query(Lesson).all()
    logger.debug("Retrieved %d lessons", len(lessons))
    return lessons


def get_lesson_by_id(db: Session, lesson_id: int) -> Optional[Lesson]:
    logger.debug("Fetching lesson by id=%s", lesson_id)
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if lesson:
        logger.debug("Lesson found: %s", lesson.title)
    else:
        logger.debug("Lesson id=%s not found", lesson_id)
    return lesson


def create_lesson(db: Session, title: str, description: str, sign_id: int) -> Lesson:
    logger.debug("Creating lesson '%s' for sign %d", title, sign_id)
    lesson = Lesson(title=title, description=description, sign_id=sign_id)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    logger.info("Lesson created with id=%s", lesson.id)
    return lesson


def update_progress(db: Session, user_id: int, sign_id: int, score: float) -> Progress:
    logger.debug("Updating progress for user %d, sign %d, score %.2f", user_id, sign_id, score)
    progress = db.query(Progress).filter(Progress.user_id == user_id, Progress.sign_id == sign_id).first()
    if not progress:
        logger.debug("No existing progress, creating new")
        progress = Progress(user_id=user_id, sign_id=sign_id, attempts_count=0, best_score=0.0, completed=0)
    progress.attempts_count += 1
    progress.last_attempt_at = datetime.utcnow()
    if score > progress.best_score:
        progress.best_score = score
        logger.debug("New best score %.2f for sign %d", score, sign_id)
    if score >= 80:
        progress.completed = 1
        logger.debug("Sign %d marked as completed", sign_id)

    db.add(progress)
    db.commit()
    db.refresh(progress)
    logger.info("Progress updated: user=%d, sign=%d, attempts=%d, best=%.2f, completed=%d",
                user_id, sign_id, progress.attempts_count, progress.best_score, progress.completed)
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
    logger.debug("Creating attempt for user %d, lesson %d, sign %d, score %.2f", user_id, lesson_id, sign_id, score)
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
    logger.info("Attempt created with id=%s", attempt.id)

    update_progress(db, user_id, sign_id, score)

    if score >= 80:
        logger.debug("Score >= 80, adding 10 XP to user %d", user_id)
        add_xp(db, user_id, 10)

    # ✅ Cập nhật streak nếu đây là lần đầu trong ngày
    user = get_user_by_id(db, user_id)
    if user:
        today = datetime.utcnow().date()
        last = user.last_practice_date.date() if user.last_practice_date else None
        if last != today:
            update_user_streak(db, user_id)
            logger.debug("Streak updated for user %d because last practice was %s", user_id, last)
        else:
            # Đảm bảo last_practice_date được cập nhật giờ hiện tại (cho lần sau)
            user.last_practice_date = datetime.utcnow()
            db.commit()
            logger.debug("Practice date already today, streak unchanged")
    else:
        logger.warning("User %d not found after attempt creation", user_id)

    return attempt

def get_user_progress(db: Session, user_id: int) -> List[Progress]:
    logger.debug("Fetching progress for user %d", user_id)
    progress = db.query(Progress).filter(Progress.user_id == user_id).all()
    logger.debug("Retrieved %d progress records", len(progress))
    return progress


def get_user_attempts(db: Session, user_id: int) -> List[Attempt]:
    logger.debug("Fetching attempts for user %d", user_id)
    attempts = db.query(Attempt).filter(Attempt.user_id == user_id).order_by(Attempt.created_at.desc()).all()
    logger.debug("Retrieved %d attempts", len(attempts))
    return attempts