#!/usr/bin/env python3
"""
Seed script to populate the database with sample data for development.
"""

from sqlalchemy.orm import sessionmaker
from models import engine
from database import create_user, create_sign, create_lesson

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_database():
    db = SessionLocal()
    try:
        # Create sample user
        user = create_user(db, "demo_user", "demo@example.com")
        print(f"Created user: {user.username}")

        # Create sample signs
        signs_data = [
            ("A", "The letter A - make a fist with thumb extended upward", 1),
            ("B", "The letter B - extend all fingers and thumb, palm facing out", 1),
            ("C", "The letter C - curve fingers into a C shape", 1),
            ("D", "The letter D - make a fist with index finger extended", 1),
            ("E", "The letter E - make a fist with all fingers curled in", 2),
            ("F", "The letter F - touch thumb to index and middle fingers", 2),
            ("G", "The letter G - make a fist with thumb and index finger extended", 2),
            ("H", "The letter H - extend index and middle fingers, cross with other hand", 2),
            ("I", "The letter I - make a fist with pinky extended", 2),
            ("J", "The letter J - same as I but move hand in a J shape", 3),
        ]

        signs = []
        for name, description, difficulty in signs_data:
            sign = create_sign(db, name, description, difficulty)
            signs.append(sign)
            print(f"Created sign: {sign.name}")

        # Create sample lessons
        lessons_data = [
            ("Introduction to Sign A", "Learn the basic handshape for the letter A", 1),
            ("Perfecting Sign A", "Practice variations and common mistakes for A", 1),
            ("Sign B Basics", "Master the open hand position for B", 2),
            ("Sign B Practice", "Build speed and accuracy with B", 2),
            ("Letter C Formation", "Learn the curved finger position for C", 3),
            ("C Sign Mastery", "Advanced practice for the C sign", 3),
            ("D Sign Introduction", "Learn the extended index finger for D", 4),
            ("D Sign Practice", "Practice the D sign in different contexts", 4),
            ("E Sign Basics", "Master the closed fist position for E", 5),
            ("F Sign Introduction", "Learn the thumb touching fingers for F", 6),
        ]

        for i, (title, description, sign_id) in enumerate(lessons_data):
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