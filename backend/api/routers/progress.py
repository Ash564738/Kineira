import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas.common import AttemptRequest, AttemptResponse, ProgressResponse
from db.repository import create_attempt, get_db, get_user_attempts, get_user_progress

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/users/{user_id}/progress", response_model=list[ProgressResponse])
async def user_progress(user_id: int, db: Session = Depends(get_db)) -> list[ProgressResponse]:
    try:
        rows = get_user_progress(db, user_id)
        return [
            ProgressResponse(
                sign_id=row.sign_id,
                best_score=float(row.best_score),
                attempts_count=int(row.attempts_count),
                completed=bool(row.completed),
            )
            for row in rows
        ]
    except Exception as exc:
        logger.exception("user_progress failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/users/{user_id}/progress", response_model=AttemptResponse)
async def create_user_attempt(user_id: int, req: AttemptRequest, db: Session = Depends(get_db)) -> AttemptResponse:
    try:
        attempt = create_attempt(
            db=db,
            user_id=user_id,
            lesson_id=req.lesson_id,
            sign_id=req.sign_id,
            score=req.score,
            feedback=req.feedback,
            landmarks_data=req.landmarks_data or "",
        )
        return AttemptResponse(
            id=attempt.id,
            lesson_id=attempt.lesson_id,
            sign_id=attempt.sign_id,
            score=float(attempt.score),
            feedback=attempt.feedback or "",
            created_at=(attempt.created_at or datetime.utcnow()).isoformat(),
        )
    except Exception as exc:
        logger.exception("create_user_attempt failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/users/{user_id}/attempts", response_model=list[AttemptResponse])
async def user_attempts(user_id: int, db: Session = Depends(get_db)) -> list[AttemptResponse]:
    try:
        rows = get_user_attempts(db, user_id)
        return [
            AttemptResponse(
                id=row.id,
                lesson_id=row.lesson_id,
                sign_id=row.sign_id,
                score=float(row.score),
                feedback=row.feedback or "",
                created_at=(row.created_at or datetime.utcnow()).isoformat(),
            )
            for row in rows
        ]
    except Exception as exc:
        logger.exception("user_attempts failed")
        raise HTTPException(status_code=500, detail=str(exc))
