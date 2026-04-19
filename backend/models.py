from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    attempts = relationship("Attempt", back_populates="user")
    progress = relationship("Progress", back_populates="user")

class Sign(Base):
    __tablename__ = 'signs'

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    description = Column(Text)
    difficulty_level = Column(Integer, default=1)  # 1-5 scale

    # Relationships
    lessons = relationship("Lesson", back_populates="sign")
    attempts = relationship("Attempt", back_populates="sign")

class Lesson(Base):
    __tablename__ = 'lessons'

    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(Text)
    sign_id = Column(Integer, ForeignKey('signs.id'))

    # Relationships
    sign = relationship("Sign", back_populates="lessons")
    attempts = relationship("Attempt", back_populates="lesson")

class Attempt(Base):
    __tablename__ = 'attempts'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    lesson_id = Column(Integer, ForeignKey('lessons.id'))
    sign_id = Column(Integer, ForeignKey('signs.id'))
    score = Column(Float, nullable=False)
    feedback = Column(Text)
    landmarks_data = Column(Text)  # JSON string of landmarks
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="attempts")
    lesson = relationship("Lesson", back_populates="attempts")
    sign = relationship("Sign", back_populates="attempts")

class Progress(Base):
    __tablename__ = 'progress'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    sign_id = Column(Integer, ForeignKey('signs.id'))
    best_score = Column(Float, default=0.0)
    attempts_count = Column(Integer, default=0)
    last_attempt_at = Column(DateTime)
    completed = Column(Integer, default=0)  # 0 or 1

    # Relationships
    user = relationship("User", back_populates="progress")

# Database setup
DATABASE_URL = "sqlite:///./kineira.db"  # For development, use SQLite
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def create_tables():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    create_tables()