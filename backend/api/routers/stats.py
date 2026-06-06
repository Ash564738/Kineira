# api/routers/stats.py
import logging
from datetime import datetime, timedelta

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.models import Attempt
from db.repository import get_db, get_user_by_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stats", tags=["stats"])


class DailyStats(BaseModel):
    date: str
    attempts: int
    average_score: float


class WeeklyStats(BaseModel):
    week: int
    total_attempts: int
    average_score: float
    days_active: int
    xp_earned: int


class MonthlyStats(BaseModel):
    month: int
    year: int
    total_attempts: int
    average_score: float
    days_active: int
    xp_earned: int


class ProgressResponse(BaseModel):
    user_id: int
    daily_stats: list[DailyStats]
    weekly_stats: list[WeeklyStats]
    monthly_stats: list[MonthlyStats]
    overall_average: float
    total_attempts: int


@router.get("/daily/{user_id}")
async def get_daily_stats(user_id: int, days: int = 7, db: Session = Depends(get_db)):
    logger.debug(f"GET /daily/{user_id} with days={days}")

    user = get_user_by_id(db, user_id)
    if not user:
        logger.warning(f"User not found for daily stats: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date,
        Attempt.created_at <= end_date
    ).all()
    logger.debug(f"Fetched {len(attempts)} attempts for user {user_id} from {start_date.date()} to {end_date.date()}")

    daily_data = {}
    for attempt in attempts:
        date_key = attempt.created_at.strftime("%Y-%m-%d")
        if date_key not in daily_data:
            daily_data[date_key] = []
        daily_data[date_key].append(attempt.score)

    result = []
    for i in range(days):
        date = (end_date - timedelta(days=i)).strftime("%Y-%m-%d")
        if date in daily_data:
            entry = {
                "date": date,
                "attempts": len(daily_data[date]),
                "average_score": np.mean(daily_data[date])
            }
        else:
            entry = {
                "date": date,
                "attempts": 0,
                "average_score": 0.0
            }
        result.append(entry)

    result = sorted(result, key=lambda x: x["date"])
    logger.debug(f"Daily stats result: {len(result)} days, {sum(d['attempts'] for d in result)} total attempts")
    return result


@router.get("/weekly/{user_id}")
async def get_weekly_stats(user_id: int, weeks: int = 12, db: Session = Depends(get_db)):
    logger.debug(f"GET /weekly/{user_id} with weeks={weeks}")

    user = get_user_by_id(db, user_id)
    if not user:
        logger.warning(f"User not found for weekly stats: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(weeks=weeks)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date
    ).all()
    logger.debug(f"Fetched {len(attempts)} attempts for user {user_id} for weekly stats (last {weeks} weeks)")

    weekly_data = {}
    for attempt in attempts:
        week_num = attempt.created_at.isocalendar()[1]
        if week_num not in weekly_data:
            weekly_data[week_num] = []
        weekly_data[week_num].append(attempt.score)

    result = []
    for i in range(weeks):
        date = end_date - timedelta(weeks=i)
        week_num = date.isocalendar()[1]
        if week_num in weekly_data:
            days_active = len(set(
                a.created_at.date() for a in attempts
                if a.created_at.isocalendar()[1] == week_num
            ))
            entry = {
                "week": week_num,
                "total_attempts": len(weekly_data[week_num]),
                "average_score": np.mean(weekly_data[week_num]),
                "days_active": days_active,
                "xp_earned": int(np.sum(weekly_data[week_num]) / 20)
            }
        else:
            entry = {
                "week": week_num,
                "total_attempts": 0,
                "average_score": 0.0,
                "days_active": 0,
                "xp_earned": 0
            }
        result.append(entry)

    result = sorted(result, key=lambda x: x["week"])
    logger.debug(f"Weekly stats result: {len(result)} weeks, total attempts across all weeks: {sum(w['total_attempts'] for w in result)}")
    return result


@router.get("/monthly/{user_id}")
async def get_monthly_stats(user_id: int, months: int = 12, db: Session = Depends(get_db)):
    logger.debug(f"GET /monthly/{user_id} with months={months}")

    user = get_user_by_id(db, user_id)
    if not user:
        logger.warning(f"User not found for monthly stats: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30 * months)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date
    ).all()
    logger.debug(f"Fetched {len(attempts)} attempts for user {user_id} for monthly stats (last {months} months)")

    monthly_data = {}
    for attempt in attempts:
        month_key = (attempt.created_at.year, attempt.created_at.month)
        if month_key not in monthly_data:
            monthly_data[month_key] = []
        monthly_data[month_key].append(attempt.score)

    result = []
    for i in range(months):
        date = end_date - timedelta(days=30 * i)
        month_key = (date.year, date.month)
        if month_key in monthly_data:
            days_active = len(set(
                a.created_at.date() for a in attempts
                if (a.created_at.year, a.created_at.month) == month_key
            ))
            entry = {
                "month": month_key[1],
                "year": month_key[0],
                "total_attempts": len(monthly_data[month_key]),
                "average_score": np.mean(monthly_data[month_key]),
                "days_active": days_active,
                "xp_earned": int(np.sum(monthly_data[month_key]) / 20)
            }
        else:
            entry = {
                "month": month_key[1],
                "year": month_key[0],
                "total_attempts": 0,
                "average_score": 0.0,
                "days_active": 0,
                "xp_earned": 0
            }
        result.append(entry)

    result = sorted(result, key=lambda x: (x["year"], x["month"]))
    logger.debug(f"Monthly stats result: {len(result)} months, total attempts: {sum(m['total_attempts'] for m in result)}")
    return result

@router.get("/yearly/{user_id}")
async def get_yearly_stats(user_id: int, years: int = 5, db: Session = Depends(get_db)):
    logger.debug(f"GET /yearly/{user_id} with years={years}")

    user = get_user_by_id(db, user_id)
    if not user:
        logger.warning(f"User not found for yearly stats: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=365 * years)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date
    ).all()
    logger.debug(f"Fetched {len(attempts)} attempts for user {user_id} for yearly stats (last {years} years)")

    yearly_data = {}
    for attempt in attempts:
        year_key = attempt.created_at.year
        if year_key not in yearly_data:
            yearly_data[year_key] = []
        yearly_data[year_key].append(attempt.score)

    result = []
    for i in range(years):
        date = end_date - timedelta(days=365 * i)
        year_key = date.year
        if year_key in yearly_data:
            days_active = len(set(
                a.created_at.date() for a in attempts
                if a.created_at.year == year_key
            ))
            entry = {
                "year": year_key,
                "total_attempts": len(yearly_data[year_key]),
                "average_score": np.mean(yearly_data[year_key]),
                "days_active": days_active,
                "xp_earned": int(np.sum(yearly_data[year_key]) / 20)
            }
        else:
            entry = {
                "year": year_key,
                "total_attempts": 0,
                "average_score": 0.0,
                "days_active": 0,
                "xp_earned": 0
            }
        result.append(entry)

    result = sorted(result, key=lambda x: x["year"])
    logger.debug(f"Yearly stats result: {len(result)} years, total attempts: {sum(y['total_attempts'] for y in result)}")
    return result