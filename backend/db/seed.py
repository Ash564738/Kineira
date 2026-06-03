#!/usr/bin/env python3
"""
Seed script – tự động tạo signs và lessons dựa trên ACTIONS trong config.py.
Tạo user demo với mật khẩu mặc định.
"""

import sys
import os
import bcrypt

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.orm import sessionmaker
from db.models import Sign, engine
from db.repository import create_lesson, create_sign, create_user, get_user_by_username
from config import ACTIONS

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')



def seed_database():
    db = SessionLocal()
    try:
        # ── User demo ────────────────────────────────────
        username = "demo_user"
        password = "demo123"  # mật khẩu mặc định
        user = get_user_by_username(db, username)
        if not user:
            hashed = get_password_hash(password)
            # create_user cần email, ta dùng email giả
            user = create_user(
                db,
                email="demo_user@example.com",
                hashed_password=hashed,
                username=username
            )
            print(f"Created user: {user.username} (password: {password})")
        else:
            print(f"Using existing user: {user.username}")

        # ── Tạo signs & lessons từ ACTIONS ────────────────
        for action in ACTIONS:
            # Mô tả ngắn gọn
            description = (
                f"The letter {action}" if len(action) == 1
                else f"Gesture for {action}"
            )

            # Tạo sign (nếu chưa tồn tại – tránh trùng lặp)
            existing_sign = db.query(Sign).filter(Sign.name == action).first()
            if existing_sign:
                print(f"Sign {action} already exists, skipping.")
                continue

            sign = create_sign(db, name=action, description=description, difficulty_level=1)
            print(f"Created sign: {sign.name} (id={sign.id})")

            # Tạo bài học tương ứng
            lesson_title = f"Sign {action} Basics"
            lesson_desc = f"Learn the {description.lower()}"
            lesson = create_lesson(db, title=lesson_title, description=lesson_desc, sign_id=sign.id)
            print(f"Created lesson: {lesson.title} (sign_id={lesson.sign_id})")

        db.commit()
        print("Database seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()