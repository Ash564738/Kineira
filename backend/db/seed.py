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
            ("K", "The letter K - make a fist with index and middle fingers extended upward", 3),
            ("L", "The letter L - extend thumb and index finger to form L shape", 3),
            ("M", "The letter M - touch thumb to all fingertips", 3),
            ("N", "The letter N - touch thumb to index and middle fingertips", 3),
            ("O", "The letter O - form a circle with thumb and index finger", 3),
            ("P", "The letter P - extend index and middle fingers downward", 3),
            ("Q", "The letter Q - make a fist with thumb between index and middle", 4),
            ("R", "The letter R - cross index over middle finger", 4),
            ("S", "The letter S - make a fist with thumb over fingers", 4),
            ("T", "The letter T - make a fist with thumb between index and middle", 4),
            ("U", "The letter U - extend index and middle fingers together", 4),
            ("V", "The letter V - extend index and middle fingers apart", 4),
            ("W", "The letter W - extend index, middle, and ring fingers", 4),
            ("X", "The letter X - make a fist with index finger hooked", 4),
            ("Y", "The letter Y - extend thumb and pinky", 4),
            ("Z", "The letter Z - move index finger in Z shape", 5),
        ]
        for name, description, difficulty in signs_data:
            sign = create_sign(db, name, description, difficulty)
            print(f"Created sign: {sign.name}")

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
            ("G Sign Basics", "Learn the G sign with extended thumb and index", 7),
            ("H Sign Introduction", "Master crossing fingers for H", 8),
            ("I Sign Practice", "Practice the pinky extension for I", 9),
            ("J Sign Movement", "Learn the J motion", 10),
            ("K Sign Formation", "Extend index and middle for K", 11),
            ("L Sign Shape", "Form L with thumb and index", 12),
            ("M Sign Touch", "Thumb touching all fingertips for M", 13),
            ("N Sign Touch", "Thumb touching two fingertips for N", 14),
            ("O Sign Circle", "Form O with thumb and index", 15),
            ("P Sign Extension", "Extend two fingers downward for P", 16),
            ("Q Sign Fist", "Thumb between fingers for Q", 17),
            ("R Sign Cross", "Cross fingers for R", 18),
            ("S Sign Fist", "Closed fist for S", 19),
            ("T Sign Fist", "Thumb between fingers for T", 20),
            ("U Sign Together", "Two fingers together for U", 21),
            ("V Sign Apart", "Two fingers apart for V", 22),
            ("W Sign Three", "Three fingers extended for W", 23),
            ("X Sign Hook", "Hooked index for X", 24),
            ("Y Sign Thumb Pinky", "Thumb and pinky for Y", 25),
            ("Z Sign Motion", "Z motion for Z", 26),
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
