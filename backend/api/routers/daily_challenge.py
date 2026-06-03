from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
from datetime import date, datetime
from db.repository import get_db, get_user_by_id, add_xp, update_user_streak
from db.models import Attempt, Sign
from config import ACTIONS

router = APIRouter(prefix="/daily-challenge", tags=["daily-challenge"])

class DailySignResponse(BaseModel):
    sign: str
    completed: bool
    streak: int
    reward_xp: int
    can_complete: bool = False   # thêm trường này

class CompleteRequest(BaseModel):
    user_id: int
    sign: str

@router.get("/sign", response_model=DailySignResponse)
async def get_daily_sign(user_id: int, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    today = date.today()
    seed = today.toordinal()
    rng = random.Random(seed)
    sign = rng.choice(ACTIONS)
    completed = (user.last_practice_date is not None and user.last_practice_date.date() == today)

    # Kiểm tra xem user đã thực hành sign hôm nay chưa (có attempt nào không)
    can_complete = False
    if not completed:
        # Tìm sign_id tương ứng
        sign_obj = db.query(Sign).filter(Sign.name == sign).first()
        if sign_obj:
            attempt_today = db.query(Attempt).filter(
                Attempt.user_id == user_id,
                Attempt.sign_id == sign_obj.id,
                Attempt.created_at >= today
            ).first()
            if attempt_today:
                can_complete = True

    return DailySignResponse(
        sign=sign,
        completed=completed,
        streak=user.streak,
        reward_xp=50 if not completed else 0,
        can_complete=can_complete
    )

@router.post("/complete")
async def complete_daily_challenge(req: CompleteRequest, db: Session = Depends(get_db)):
    user = get_user_by_id(db, req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    today = date.today()
    if user.last_practice_date and user.last_practice_date.date() == today:
        raise HTTPException(status_code=400, detail="Already completed")

    # Xác định sign của ngày
    seed = today.toordinal()
    rng = random.Random(seed)
    expected_sign = rng.choice(ACTIONS)
    if req.sign.upper() != expected_sign.upper():
        raise HTTPException(status_code=400, detail="Wrong sign for today")

    # Kiểm tra xem người dùng đã thực hành sign này hôm nay chưa
    sign_obj = db.query(Sign).filter(Sign.name == expected_sign).first()
    if not sign_obj:
        raise HTTPException(status_code=400, detail="Sign not found")
    attempt_today = db.query(Attempt).filter(
        Attempt.user_id == req.user_id,
        Attempt.sign_id == sign_obj.id,
        Attempt.created_at >= today
    ).first()
    if not attempt_today:
        raise HTTPException(status_code=400, detail="You must practice this sign today before completing the challenge")

    user = update_user_streak(db, req.user_id)
    user = add_xp(db, req.user_id, 50)
    return {"streak": user.streak, "xp_earned": 50, "new_xp": user.xp}