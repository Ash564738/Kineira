# api/routers/daily_challenge.py
import logging
import random
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.repository import get_db, get_user_by_id, add_xp, update_user_streak
from db.models import Attempt, Sign
from config import ACTIONS

# Tạo logger cho module này
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/daily-challenge", tags=["daily-challenge"])


class DailySignResponse(BaseModel):
    sign: str
    completed: bool
    streak: int
    reward_xp: int
    can_complete: bool = False


class CompleteRequest(BaseModel):
    user_id: int
    sign: str


@router.get("/sign", response_model=DailySignResponse)
async def get_daily_sign(user_id: int, db: Session = Depends(get_db)):
    logger.debug(f"GET /daily-challenge/sign called for user_id={user_id}")

    user = get_user_by_id(db, user_id)
    if not user:
        logger.warning(f"User not found: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    today = date.today()
    seed = today.toordinal()
    rng = random.Random(seed)
    sign = rng.choice(ACTIONS)
    logger.debug(f"Daily seed={seed}, chosen sign='{sign}'")

    # Kiểm tra đã hoàn thành thử thách hôm nay chưa
    last_practice = user.last_practice_date
    completed = (last_practice is not None and last_practice.date() == today)
    logger.debug(f"User last_practice_date={last_practice}, completed={completed}")

    can_complete = False
    if not completed:
        sign_obj = db.query(Sign).filter(Sign.name == sign).first()
        if sign_obj:
            attempt_today = db.query(Attempt).filter(
                Attempt.user_id == user_id,
                Attempt.sign_id == sign_obj.id,
                Attempt.created_at >= today
            ).first()
            logger.debug(
                f"Sign '{sign}' id={sign_obj.id}, attempt_today={'found' if attempt_today else 'not found'}"
            )
            if attempt_today:
                can_complete = True
        else:
            logger.error(f"Sign '{sign}' not found in database!")
    else:
        logger.debug("Challenge already completed, can_complete remains False")

    reward_xp = 50 if not completed else 0
    response = DailySignResponse(
        sign=sign,
        completed=completed,
        streak=user.streak,
        reward_xp=reward_xp,
        can_complete=can_complete,
    )
    logger.debug(f"Response: {response.dict()}")
    return response


@router.post("/complete")
async def complete_daily_challenge(req: CompleteRequest, db: Session = Depends(get_db)):
    logger.debug(f"POST /daily-challenge/complete called with user_id={req.user_id}, sign='{req.sign}'")

    user = get_user_by_id(db, req.user_id)
    if not user:
        logger.warning(f"User not found: {req.user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    today = date.today()
    if user.last_practice_date and user.last_practice_date.date() == today:
        logger.warning(f"User {req.user_id} already completed challenge today")
        raise HTTPException(status_code=400, detail="Already completed")

    # Xác định sign của ngày
    seed = today.toordinal()
    rng = random.Random(seed)
    expected_sign = rng.choice(ACTIONS)
    logger.debug(f"Today seed={seed}, expected_sign='{expected_sign}'")

    if req.sign.upper() != expected_sign.upper():
        logger.warning(
            f"Wrong sign submitted: '{req.sign}' (expected '{expected_sign}')"
        )
        raise HTTPException(status_code=400, detail="Wrong sign for today")

    # Kiểm tra attempt hôm nay
    sign_obj = db.query(Sign).filter(Sign.name == expected_sign).first()
    if not sign_obj:
        logger.error(f"Sign '{expected_sign}' not found in DB")
        raise HTTPException(status_code=400, detail="Sign not found")

    attempt_today = db.query(Attempt).filter(
        Attempt.user_id == req.user_id,
        Attempt.sign_id == sign_obj.id,
        Attempt.created_at >= today
    ).first()

    logger.debug(
        f"Attempt for sign_id={sign_obj.id} today: {'found' if attempt_today else 'missing'}"
    )

    if not attempt_today:
        logger.warning(f"User {req.user_id} has no attempt for sign '{expected_sign}' today")
        raise HTTPException(
            status_code=400,
            detail="You must practice this sign today before completing the challenge"
        )

    # Hoàn thành thử thách
    logger.debug(f"Updated streak for user {req.user_id}, new streak={user.streak}")

    user = add_xp(db, req.user_id, 50)
    logger.debug(f"Added 50 XP to user {req.user_id}, new XP={user.xp}")

    result = {"streak": user.streak, "xp_earned": 50, "new_xp": user.xp}
    logger.info(f"Challenge completed by user {req.user_id}: {result}")
    return result