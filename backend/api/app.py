# api/app.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

from api.routers import recognition, data_collection, training, lessons, progress, auth, leaderboard, quiz, ai_coach, stats, daily_challenge
from config import RAW_VIDEOS_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kineira API", version="0.1.0")

app.mount("/static/videos", StaticFiles(directory=RAW_VIDEOS_DIR), name="static_videos")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
allow_all_origins = "*" in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else allowed_origins,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recognition.router)
app.include_router(data_collection.router)
app.include_router(training.router)
app.include_router(lessons.router)
app.include_router(progress.router)
app.include_router(auth.router)
app.include_router(leaderboard.router)
app.include_router(quiz.router)
app.include_router(ai_coach.router)
app.include_router(stats.router)
app.include_router(daily_challenge.router)

@app.on_event("startup")
async def startup():
    logger.info("API startup")
    from api.services.inference import inference_service
    inference_service.startup()