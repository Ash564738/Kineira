# api/routers/ai_coach.py
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
from db.repository import get_db, get_user_by_id, add_xp
from db.models import Attempt
from api.services.ai_service import get_ai_coach_feedback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])


class ComponentFeedback(BaseModel):
    name: str
    score: float
    issues: list[str]
    recommendations: list[str]


class CoachFeedback(BaseModel):
    overall_score: float
    hand_feedback: ComponentFeedback
    motion_feedback: ComponentFeedback
    body_feedback: ComponentFeedback
    weak_signs: list[str]
    practice_plan: list[dict]
    xp_earned: int
    encouragement: str


class FeedbackRequest(BaseModel):
    user_id: int
    sign: str
    score: float
    hand_similarity: float
    motion_score: float
    body_score: float
    finger_details: Optional[dict] = None


def _build_fallback_feedback(req: FeedbackRequest) -> dict:
    overall_score = (req.hand_similarity * 0.5 + req.motion_score * 0.3 + req.body_score * 0.2) * 100

    hand_issues = []
    hand_recommendations = []
    if req.hand_similarity < 0.7:
        hand_issues.extend(["Hand position not accurate", "Finger extension incomplete"])
        hand_recommendations.extend(["Adjust hand position to match reference", "Extend fingers more fully"])
    else:
        hand_recommendations.append("Great hand positioning! Keep it up!")

    motion_issues = []
    motion_recommendations = []
    if req.motion_score < 0.7:
        motion_issues.extend(["Motion too slow", "Motion path incorrect"])
        motion_recommendations.extend(["Increase motion speed", "Follow the reference path more closely"])
    else:
        motion_recommendations.append("Good motion! Try to make it smoother for an even better score.")

    body_issues = []
    body_recommendations = []
    if req.body_score < 0.7:
        body_issues.extend(["Hand height incorrect", "Wrist rotation off"])
        body_recommendations.extend(["Adjust hand height", "Increase wrist rotation"])
    else:
        body_recommendations.append("Nice body posture! Focus on maintaining it throughout the sign.")
    return {
        "overall_score": overall_score,
        "hand_feedback": {
            "name": "Hand Position",
            "score": req.hand_similarity * 100,
            "issues": hand_issues,
            "recommendations": hand_recommendations,
        },
        "motion_feedback": {
            "name": "Motion",
            "score": req.motion_score * 100,
            "issues": motion_issues,
            "recommendations": motion_recommendations,
        },
        "body_feedback": {
            "name": "Body Posture",
            "score": req.body_score * 100,
            "issues": body_issues,
            "recommendations": body_recommendations,
        },
        "weak_signs": [],
        "practice_plan": [],
        "xp_earned": int(max(5, overall_score / 20)),
        "encouragement": "Keep practicing – you're doing great!",
    }


@router.post("/feedback", response_model=CoachFeedback)
async def get_feedback(req: FeedbackRequest, db: Session = Depends(get_db)):
    logger.info(f"AI Coach request: user_id={req.user_id}, sign={req.sign}, hand={req.hand_similarity}, motion={req.motion_score}, body={req.body_score}")

    user = get_user_by_id(db, req.user_id)
    if not user:
        logger.warning(f"User {req.user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")

    # Overall score (before AI)
    overall_score = (req.hand_similarity * 0.5 + req.motion_score * 0.3 + req.body_score * 0.2) * 100
    logger.debug(f"Computed overall_score (pre-AI): {overall_score:.1f}")

    # Lịch sử luyện tập
    recent_attempts = (
        db.query(Attempt)
        .filter(Attempt.user_id == req.user_id)
        .order_by(Attempt.created_at.desc())
        .limit(20)
        .all()
    )
    sign_stats = {}
    for a in recent_attempts:
        name = a.sign.name if a.sign else "unknown"
        if name not in sign_stats:
            sign_stats[name] = {"total": 0, "count": 0}
        sign_stats[name]["total"] += a.score
        sign_stats[name]["count"] += 1
    recent = [{"sign": k, "avg": v["total"]/v["count"], "count": v["count"]} for k, v in sign_stats.items()]
    logger.debug(f"Recent sign history: {recent}")

    # Gọi AI service
    logger.info("Calling AI service for feedback...")
    ai_data = get_ai_coach_feedback(
        sign=req.sign,
        hand_similarity=req.hand_similarity,
        motion_score=req.motion_score,
        body_score=req.body_score,
        overall_score=overall_score,
        finger_details=req.finger_details,
        recent_scores=recent,
    )

    if ai_data:
        logger.info("AI feedback received successfully")
        xp_earned = ai_data.get("xp_earned", int(max(5, ai_data["overall_score"] / 20)))
        add_xp(db, req.user_id, xp_earned)
        return ai_data

    logger.warning("AI feedback failed – using fallback feedback")
    fallback = _build_fallback_feedback(req)
    add_xp(db, req.user_id, fallback["xp_earned"])
    return fallback


@router.get("/weak-signs/{user_id}")
async def get_weak_signs(user_id: int, db: Session = Depends(get_db)):
    logger.info(f"Fetching weak signs for user {user_id}")
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    attempts = db.query(Attempt).filter(Attempt.user_id == user_id).all()
    signs_stats = {}
    for attempt in attempts:
        sign_name = attempt.sign.name if attempt.sign else "unknown"
        if sign_name not in signs_stats:
            signs_stats[sign_name] = {"total": 0, "count": 0}
        signs_stats[sign_name]["total"] += attempt.score
        signs_stats[sign_name]["count"] += 1

    weak_signs = []
    for sign, stats in signs_stats.items():
        avg = stats["total"] / stats["count"]
        weak_signs.append({
            "sign": sign,
            "average_score": avg,
            "attempts": stats["count"],
            "needs_practice": avg < 75,
        })

    weak_signs.sort(key=lambda x: x["average_score"])
    logger.info(f"Weak signs found: {[s['sign'] for s in weak_signs[:5]]}")
    return weak_signs[:5]