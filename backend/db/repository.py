from datetime import datetime
from typing import Generator, List, Optional

from sqlalchemy.orm import Session, sessionmaker

from db.models import Attempt, Lesson, Progress, Sign, User, engine

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_user(db: Session, username: str, email: str) -> User:
    user = User(username=username, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


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
    return attempt


def get_user_progress(db: Session, user_id: int) -> List[Progress]:
    return db.query(Progress).filter(Progress.user_id == user_id).all()


def get_user_attempts(db: Session, user_id: int) -> List[Attempt]:
    return db.query(Attempt).filter(Attempt.user_id == user_id).order_by(Attempt.created_at.desc()).all()
