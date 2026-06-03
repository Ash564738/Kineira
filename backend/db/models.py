# db/models.py
from datetime import datetime
import os

from dotenv import load_dotenv
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Boolean, create_engine
from sqlalchemy.orm import declarative_base, relationship

load_dotenv()

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, nullable=False)
    username = Column(String(50), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    streak = Column(Integer, default=0)
    last_practice_date = Column(DateTime, nullable=True)

    attempts = relationship("Attempt", back_populates="user")
    progress = relationship("Progress", back_populates="user")
    achievements = relationship("Achievement", back_populates="user")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_type = Column(String(50), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="achievements")


class Sign(Base):
    __tablename__ = "signs"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    description = Column(Text)
    difficulty_level = Column(Integer, default=1)

    lessons = relationship("Lesson", back_populates="sign")
    attempts = relationship("Attempt", back_populates="sign")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(Text)
    sign_id = Column(Integer, ForeignKey("signs.id"))

    sign = relationship("Sign", back_populates="lessons")
    attempts = relationship("Attempt", back_populates="lesson")


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    sign_id = Column(Integer, ForeignKey("signs.id"))
    score = Column(Float, nullable=False)
    feedback = Column(Text)
    landmarks_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="attempts")
    lesson = relationship("Lesson", back_populates="attempts")
    sign = relationship("Sign", back_populates="attempts")


class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    sign_id = Column(Integer, ForeignKey("signs.id"))
    best_score = Column(Float, default=0.0)
    attempts_count = Column(Integer, default=0)
    last_attempt_at = Column(DateTime)
    completed = Column(Integer, default=0)

    user = relationship("User", back_populates="progress")


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://username:password@localhost:5432/kineira")
engine = create_engine(DATABASE_URL)


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    create_tables()
