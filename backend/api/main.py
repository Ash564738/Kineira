# api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from api.routers import recognition, data_collection, training, lessons, progress, auth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kineira API", version="0.1.0")

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
app.include_router(auth.router)   # quan trọng


@app.on_event("startup")
async def startup():
    logger.info("API startup")
    from api.services.inference import inference_service
    inference_service.startup()