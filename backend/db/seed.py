#!/usr/bin/env python3
"""
Seed script to populate the database with sample data for development.
"""

from sqlalchemy.orm import sessionmaker

from db.models import engine
from db.repository import create_lesson, create_sign, create_user, get_user_by_username

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_database():
    db = SessionLocal()
    try:
        existing_user = get_user_by_username(db, "demo_user")
        if existing_user:
            user = existing_user
            print(f"Using existing user: {user.username}")
        else:
            user = create_user(db, "demo_user", "demo@example.com")
            print(f"Created user: {user.username}")

        signs_data = [
            ("A", "The letter A - make a fist with thumb extended upward", 1),   # beginner
            ("B", "The letter B - extend all fingers and thumb, palm facing out", 2),   # beginner (hoặc 2)
            ("C", "The letter C - curve fingers into a C shape", 3),   # intermediate
            ("HELLO", "Gesture for hello - touch forehead then chin", 4),   # advanced (ví dụ)
        ]
        for name, description, difficulty in signs_data:
            sign = create_sign(db, name, description, difficulty)
            print(f"Created sign: {sign.name}")

        lessons_data = [
            ("Sign A Basics", "Learn the basic handshape for the letter A", 1),
            ("Sign B Basics", "Master the open hand position for B", 2),
            ("Sign C Basics", "Learn the curved finger position for C", 3),
            ("Hello Gesture", "Practice the hello sign", 4),
        ]
        for title, description, sign_id in lessons_data:
            lesson = create_lesson(db, title, description, sign_id)
            print(f"Created lesson: {lesson.title}")
        print("Database seeded successfully!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
