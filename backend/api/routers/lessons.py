# api/routers/lessons.py
import logging
import os
from config import RAW_VIDEOS_DIR
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas.common import LessonResponse
from db.repository import get_db, get_lesson_by_id, get_lessons, get_sign_by_id

logger = logging.getLogger(__name__)
router = APIRouter()

DIFFICULTY_MAP = {
    1: "beginner",
    2: "beginner",
    3: "intermediate",
    4: "advanced",
    5: "expert",
}


def _to_response(lesson, sign_name: str) -> LessonResponse:
    # ... xác định difficulty (giữ nguyên code của bạn) ...
    if hasattr(lesson, 'difficulty') and lesson.difficulty is not None:
        if isinstance(lesson.difficulty, str):
            difficulty = lesson.difficulty.lower()
        else:
            difficulty = DIFFICULTY_MAP.get(lesson.difficulty, "beginner")
    elif hasattr(lesson, 'sign') and lesson.sign is not None:
        level = getattr(lesson.sign, 'difficulty_level', 1) or 1
        difficulty = DIFFICULTY_MAP.get(level, "beginner")
    else:
        difficulty = "beginner"

    # Tìm video đầu tiên trong thư mục của ký hiệu
    video_url = None
    try:
        sign_video_dir = os.path.join(RAW_VIDEOS_DIR, sign_name.upper())
        if os.path.isdir(sign_video_dir):
            mp4_files = sorted([
                f for f in os.listdir(sign_video_dir)
                if f.lower().endswith(".mp4")
            ])
            if mp4_files:
                # URL tương đối từ static mount
                video_url = f"/static/videos/{sign_name.upper()}/{mp4_files[0]}"
    except Exception:
        pass

    return LessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description or "",
        sign_id=lesson.sign_id,
        difficulty=difficulty,
        reference_video_url=video_url,          # ← dùng URL thực tế
        reference_sign=sign_name.upper(),
    )

@router.get("/lessons", response_model=list[LessonResponse])
async def list_lessons(db: Session = Depends(get_db)) -> list[LessonResponse]:
    try:
        lessons = get_lessons(db)
        result: list[LessonResponse] = []
        for lesson in lessons:
            sign = get_sign_by_id(db, lesson.sign_id)
            sign_name = sign.name if sign else str(lesson.sign_id)
            result.append(_to_response(lesson, sign_name))
        return result
    except Exception as exc:
        logger.exception("list_lessons failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/lessons/{lesson_id}", response_model=LessonResponse)
async def lesson_detail(lesson_id: int, db: Session = Depends(get_db)) -> LessonResponse:
    try:
        lesson = get_lesson_by_id(db, lesson_id)
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")
        sign = get_sign_by_id(db, lesson.sign_id)
        sign_name = sign.name if sign else str(lesson.sign_id)
        return _to_response(lesson, sign_name)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("lesson_detail failed")
        raise HTTPException(status_code=500, detail=str(exc))
