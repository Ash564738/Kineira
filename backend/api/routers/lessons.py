import logging

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
    return LessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description or "",
        sign_id=lesson.sign_id,
        difficulty=DIFFICULTY_MAP.get(getattr(lesson.sign, "difficulty_level", 1), "beginner")
        if getattr(lesson, "sign", None)
        else "beginner",
        reference_video_url=None,
        reference_sign=sign_name.lower(),
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
