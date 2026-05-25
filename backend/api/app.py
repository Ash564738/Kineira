# api/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

from api.routers import recognition, data_collection, training, lessons, progress, auth
from config import RAW_VIDEOS_DIR   # đảm bảo config.py có RAW_VIDEOS_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kineira API", version="0.1.0")

# Mount thư mục video tĩnh – phục vụ các file .mp4
app.mount("/static/videos", StaticFiles(directory=RAW_VIDEOS_DIR), name="static_videos")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(recognition.router)
app.include_router(data_collection.router)
app.include_router(training.router)
app.include_router(lessons.router)
app.include_router(progress.router)
app.include_router(auth.router)

@app.on_event("startup")
async def startup():
    logger.info("API startup")
    from api.services.inference import inference_service
    inference_service.startup()