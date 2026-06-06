# api/routers/progress.py
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas.common import AttemptRequest, AttemptResponse, ProgressResponse
from api.services.auth import get_current_user
from db.models import User
from db.repository import create_attempt, get_db, get_user_attempts, get_user_progress

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/users/me/progress")
async def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trả về tiến độ của người dùng hiện tại (dựa trên token)."""
    logger.debug(f"Fetching progress for current user id={current_user.id}")
    progress = get_user_progress(db, current_user.id)
    # get_user_progress có thể trả về một list hoặc object, log số lượng để kiểm tra
    if isinstance(progress, list):
        logger.debug(f"Progress data for user {current_user.id}: {len(progress)} entries")
    else:
        logger.debug(f"Progress data for user {current_user.id}: {progress}")
    return progress

@router.get("/users/{user_id}/progress", response_model=list[ProgressResponse])
async def user_progress(user_id: int, db: Session = Depends(get_db)) -> list[ProgressResponse]:
    logger.debug(f"GET /users/{user_id}/progress")
    try:
        rows = get_user_progress(db, user_id)
        logger.debug(f"Fetched {len(rows)} progress rows for user {user_id}")
        result = [
            ProgressResponse(
                sign_id=row.sign_id,
                best_score=float(row.best_score),
                attempts_count=int(row.attempts_count),
                completed=bool(row.completed),
            )
            for row in rows
        ]
        logger.debug(f"Returning {len(result)} progress entries")
        return result
    except Exception as exc:
        logger.exception("user_progress failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/users/{user_id}/progress", response_model=AttemptResponse)
async def create_user_attempt(user_id: int, req: AttemptRequest, db: Session = Depends(get_db)) -> AttemptResponse:
    logger.debug(f"POST /users/{user_id}/progress - lesson_id={req.lesson_id}, sign_id={req.sign_id}, score={req.score}")
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
        logger.info(f"Created attempt id={attempt.id} for user {user_id}")
        response = AttemptResponse(
            id=attempt.id,
            lesson_id=attempt.lesson_id,
            sign_id=attempt.sign_id,
            score=float(attempt.score),
            feedback=attempt.feedback or "",
            created_at=(attempt.created_at or datetime.utcnow()).isoformat(),
        )
        logger.debug(f"Returning attempt response: id={response.id}, created_at={response.created_at}")
        return response
    except Exception as exc:
        logger.exception("create_user_attempt failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/users/{user_id}/attempts", response_model=list[AttemptResponse])
async def user_attempts(user_id: int, db: Session = Depends(get_db)) -> list[AttemptResponse]:
    logger.debug(f"GET /users/{user_id}/attempts")
    try:
        rows = get_user_attempts(db, user_id)
        logger.debug(f"Fetched {len(rows)} attempts for user {user_id}")
        result = [
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
        logger.debug(f"Returning {len(result)} attempt responses")
        return result
    except Exception as exc:
        logger.exception("user_attempts failed")
        raise HTTPException(status_code=500, detail=str(exc))