# api/routers/quiz.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import random
import os
from db.repository import add_xp, get_db
from db.models import Sign
from config import RAW_VIDEOS_DIR

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
        return None
    # Lấy file video đầu tiên (giả sử các file là video)
    for fname in os.listdir(sign_dir):
        if fname.endswith(('.mp4', '.webm', '.mov', '.avi')):
            return f"/static/videos/{sign_name}/{fname}"
    return None


@router.get("/questions", response_model=List[QuizQuestionResponse])
async def get_quiz_questions(count: int = 5, db: Session = Depends(get_db)):
    signs = db.query(Sign).all()
    if not signs:
        raise HTTPException(status_code=404, detail="No signs available")

    selected = random.sample(signs, min(count, len(signs)))
    questions = []
    global quiz_sessions
    quiz_sessions.clear()

    for idx, sign in enumerate(selected):
        video_url = _get_video_url(sign.name)

        # Tạo 4 đáp án ngẫu nhiên (bao gồm cả đáp án đúng)
        other = [s for s in signs if s.id != sign.id]
        pool = random.sample(other, min(3, len(other)))
        option_names = [s.name for s in pool] + [sign.name]
        random.shuffle(option_names)

        qid = idx + 1
        quiz_sessions[qid] = sign.name

        questions.append(QuizQuestionResponse(
            id=qid,
            video_url=video_url,
            options=option_names
        ))

    return questions


@router.post("/submit", response_model=QuizResultResponse)
async def submit_answer(req: QuizAnswerRequest, db: Session = Depends(get_db)):
    correct = quiz_sessions.get(req.question_id)
    if correct is None:
        raise HTTPException(status_code=400, detail="Question not found or session expired")

    is_correct = req.user_answer == correct
    if is_correct:
        add_xp(db, req.user_id, 10)

    return QuizResultResponse(
        correct=is_correct,
        correct_answer=correct,
        xp_earned=10 if is_correct else 0
    )