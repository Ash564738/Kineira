# api/routers/quiz.py
import logging
import random
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.repository import add_xp, get_db
from db.models import Sign
from config import RAW_VIDEOS_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["quiz"])

# Lưu tạm đáp án cho từng câu hỏi (demo)
quiz_sessions: dict[int, str] = {}


class QuizQuestionResponse(BaseModel):
    id: int
    video_url: Optional[str] = None
    options: List[str]


class QuizAnswerRequest(BaseModel):
    question_id: int
    user_answer: str
    user_id: int


class QuizResultResponse(BaseModel):
    correct: bool
    correct_answer: str
    xp_earned: int


def _get_video_url(sign_name: str) -> Optional[str]:
    """Trả về URL của video mẫu cho ký hiệu (nếu có)."""
    sign_dir = os.path.join(RAW_VIDEOS_DIR, sign_name)
    if not os.path.isdir(sign_dir):
        logger.debug(f"No video directory for sign '{sign_name}' at {sign_dir}")
        return None
    for fname in os.listdir(sign_dir):
        if fname.endswith(('.mp4', '.webm', '.mov', '.avi')):
            url = f"/static/videos/{sign_name}/{fname}"
            logger.debug(f"Found video for '{sign_name}': {url}")
            return url
    logger.debug(f"No video file found in {sign_dir}")
    return None


@router.get("/questions", response_model=List[QuizQuestionResponse])
async def get_quiz_questions(count: int = 5, db: Session = Depends(get_db)):
    logger.info(f"GET /quiz/questions with count={count}")
    signs = db.query(Sign).all()
    logger.debug(f"Fetched {len(signs)} signs from database")
    if not signs:
        logger.warning("No signs available for quiz")
        raise HTTPException(status_code=404, detail="No signs available")

    selected = random.sample(signs, min(count, len(signs)))
    logger.debug(f"Selected {len(selected)} signs for quiz: {[s.name for s in selected]}")
    
    questions = []
    quiz_sessions.clear()
    logger.debug("Cleared previous quiz_sessions")

    for idx, sign in enumerate(selected):
        video_url = _get_video_url(sign.name)

        # Tạo 4 đáp án ngẫu nhiên (bao gồm cả đáp án đúng)
        other = [s for s in signs if s.id != sign.id]
        pool = random.sample(other, min(3, len(other)))
        option_names = [s.name for s in pool] + [sign.name]
        random.shuffle(option_names)

        qid = idx + 1
        quiz_sessions[qid] = sign.name
        logger.debug(f"Question {qid}: correct='{sign.name}', options={option_names}")

        questions.append(QuizQuestionResponse(
            id=qid,
            video_url=video_url,
            options=option_names
        ))

    logger.info(f"Generated {len(questions)} quiz questions")
    return questions


@router.post("/submit", response_model=QuizResultResponse)
async def submit_answer(req: QuizAnswerRequest, db: Session = Depends(get_db)):
    logger.debug(f"POST /quiz/submit: question_id={req.question_id}, user_answer='{req.user_answer}', user_id={req.user_id}")
    correct = quiz_sessions.get(req.question_id)
    if correct is None:
        logger.warning(f"Question {req.question_id} not found in session (maybe expired)")
        raise HTTPException(status_code=400, detail="Question not found or session expired")

    is_correct = req.user_answer == correct
    logger.debug(f"Expected='{correct}', got='{req.user_answer}' -> correct={is_correct}")

    if is_correct:
        add_xp(db, req.user_id, 10)
        logger.info(f"User {req.user_id} answered correctly, awarded 10 XP")
    else:
        logger.info(f"User {req.user_id} answered incorrectly")

    return QuizResultResponse(
        correct=is_correct,
        correct_answer=correct,
        xp_earned=10 if is_correct else 0
    )