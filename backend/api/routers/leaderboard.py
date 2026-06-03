# api/routers/leaderboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from db.repository import get_db
from db.models import User, Attempt
from sqlalchemy import func, desc

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


class LeaderboardEntryResponse(BaseModel):
    rank: int
    user_id: int
    username: str
    level: int
    xp: int
    avg_score: float
    streak: int


@router.get("/top", response_model=list[LeaderboardEntryResponse])
async def get_top_users(limit: int = 10, db: Session = Depends(get_db)):
    users = db.query(User).order_by(desc(User.level), desc(User.xp)).limit(limit).all()

    result = []
    for rank, user in enumerate(users, 1):
        attempts = db.query(Attempt).filter(Attempt.user_id == user.id).all()
        avg_score = sum([a.score for a in attempts]) / len(attempts) if attempts else 0

        result.append({
            "rank": rank,
            "user_id": user.id,
            "username": user.username or user.email.split('@')[0],
            "level": user.level,
            "xp": user.xp,
            "avg_score": avg_score,
            "streak": user.streak,
        })

    return result


@router.get("/user/{user_id}", response_model=dict)
async def get_user_rank(user_id: int, db: Session = Depends(get_db)):
    users = db.query(User).order_by(desc(User.level), desc(User.xp)).all()

    for rank, user in enumerate(users, 1):
        if user.id == user_id:
            attempts = db.query(Attempt).filter(Attempt.user_id == user.id).all()
            avg_score = sum([a.score for a in attempts]) / len(attempts) if attempts else 0

            return {
                "rank": rank,
                "total_users": len(users),
                "user_id": user.id,
                "username": user.username or user.email.split('@')[0],
                "level": user.level,
                "xp": user.xp,
                "avg_score": avg_score,
                "streak": user.streak,
            }

    return {"error": "User not found"}
