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
    # Xác định difficulty
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
        logger.debug(f"Looking for videos in directory: {sign_video_dir}")
        if os.path.isdir(sign_video_dir):
            mp4_files = sorted([
                f for f in os.listdir(sign_video_dir)
                if f.lower().endswith(".mp4")
            ])
            if mp4_files:
                video_url = f"/static/videos/{sign_name.upper()}/{mp4_files[0]}"
                logger.debug(f"Found video: {video_url}")
            else:
                logger.debug(f"No mp4 files found for sign '{sign_name.upper()}'")
        else:
            logger.debug(f"Video directory does not exist for sign '{sign_name.upper()}'")
    except Exception as e:
        logger.warning(f"Error scanning videos for sign '{sign_name}': {e}")

    response = LessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description or "",
        sign_id=lesson.sign_id,
        difficulty=difficulty,
        reference_video_url=video_url,
        reference_sign=sign_name.upper(),
    )
    logger.debug(f"Built LessonResponse: id={lesson.id}, title='{lesson.title}', sign={sign_name.upper()}, video={video_url}")
    return response


@router.get("/lessons", response_model=list[LessonResponse])
async def list_lessons(db: Session = Depends(get_db)) -> list[LessonResponse]:
    logger.info("GET /lessons - fetching all lessons")
    try:
        lessons = get_lessons(db)
        logger.debug(f"Fetched {len(lessons)} lessons from database")
        result: list[LessonResponse] = []
        for lesson in lessons:
            sign = get_sign_by_id(db, lesson.sign_id)
            sign_name = sign.name if sign else str(lesson.sign_id)
            logger.debug(f"Processing lesson id={lesson.id}, sign_id={lesson.sign_id}, sign_name='{sign_name}'")
            result.append(_to_response(lesson, sign_name))
        logger.info(f"Returning {len(result)} lessons")
        return result
    except Exception as exc:
        logger.exception("list_lessons failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/lessons/{lesson_id}", response_model=LessonResponse)
async def lesson_detail(lesson_id: int, db: Session = Depends(get_db)) -> LessonResponse:
    logger.info(f"GET /lessons/{lesson_id} - fetching lesson detail")
    try:
        lesson = get_lesson_by_id(db, lesson_id)
        if not lesson:
            logger.warning(f"Lesson with id {lesson_id} not found")
            raise HTTPException(status_code=404, detail="Lesson not found")
        sign = get_sign_by_id(db, lesson.sign_id)
        sign_name = sign.name if sign else str(lesson.sign_id)
        logger.debug(f"Found lesson id={lesson.id}, title='{lesson.title}', sign='{sign_name}'")
        return _to_response(lesson, sign_name)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("lesson_detail failed")
        raise HTTPException(status_code=500, detail=str(exc))