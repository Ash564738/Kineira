# api/routers/stats.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from db.repository import get_db, get_user_by_id
from db.models import Attempt
from pydantic import BaseModel
import numpy as np

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
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date,
        Attempt.created_at <= end_date
    ).all()

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
            result.append({
                "date": date,
                "attempts": len(daily_data[date]),
                "average_score": np.mean(daily_data[date])
            })
        else:
            result.append({
                "date": date,
                "attempts": 0,
                "average_score": 0
            })

    return sorted(result, key=lambda x: x["date"])


@router.get("/weekly/{user_id}")
async def get_weekly_stats(user_id: int, weeks: int = 12, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(weeks=weeks)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date
    ).all()

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
            result.append({
                "week": week_num,
                "total_attempts": len(weekly_data[week_num]),
                "average_score": np.mean(weekly_data[week_num]),
                "days_active": len(set([a.created_at.date() for a in attempts if a.created_at.isocalendar()[1] == week_num])),
                "xp_earned": int(np.sum(weekly_data[week_num]) / 20)
            })

    return sorted(result, key=lambda x: x["week"])


@router.get("/monthly/{user_id}")
async def get_monthly_stats(user_id: int, months: int = 12, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30 * months)

    attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.created_at >= start_date
    ).all()

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
            result.append({
                "month": month_key[1],
                "year": month_key[0],
                "total_attempts": len(monthly_data[month_key]),
                "average_score": np.mean(monthly_data[month_key]),
                "days_active": len(set([a.created_at.date() for a in attempts if (a.created_at.year, a.created_at.month) == month_key])),
                "xp_earned": int(np.sum(monthly_data[month_key]) / 20)
            })

    return sorted(result, key=lambda x: (x["year"], x["month"]))
