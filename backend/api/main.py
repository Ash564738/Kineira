# api/main.py
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.lessons import router as lessons_router
from api.routers.progress import router as progress_router
from api.routers.recognition import router as recognition_router
from api.routers.data_collection import router as data_collection_router
from api.routers.training import router as training_router
from api.services.inference import inference_service
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sign API")   # ← Phải đặt trước khi mount

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files phải sau khi app đã được tạo
app.mount("/static/videos", StaticFiles(directory="E:/Kineira/backend/datasets/WLASL/start_kit/raw_videos"), name="videos")

app.include_router(recognition_router)
app.include_router(lessons_router)
app.include_router(progress_router)
app.include_router(data_collection_router)
app.include_router(training_router)


@app.on_event("startup")
async def startup() -> None:
    logger.info("API startup")
    inference_service.startup()