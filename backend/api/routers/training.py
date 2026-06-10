# api/routers/training.py
import asyncio
import logging
from threading import Thread, Event
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from api.services.auth import require_admin
from ml.train_holistic import HolisticTrainer
from config import LSTM_EPOCHS, ACTIONS, DATA_PATH

router = APIRouter(
    prefix="/training",
    tags=["training"],
    dependencies=[Depends(require_admin)],
)
logger = logging.getLogger(__name__)

training_state = {
    "status": "idle",
    "progress": 0,
    "current_epoch": 0,
    "total_epochs": 0,
    "loss": None,
    "accuracy": None,
    "message": None,
    "metrics": None,
}

trainer: Optional[HolisticTrainer] = None
training_thread: Optional[Thread] = None
cancel_event = Event()   # <-- Cờ huỷ training


def get_trainer() -> Optional[HolisticTrainer]:
    global trainer
    if trainer is None:
        try:
            trainer = HolisticTrainer()
        except ImportError as e:
            logger.error(f"Failed to initialize trainer: {e}")
            return None
    return trainer


def _train_worker():
    global training_state
    logger.info("=" * 80)
    logger.info("TRAINING PROCESS STARTED")
    logger.info("=" * 80)
    try:
        train_obj = get_trainer()
        if train_obj is None:
            logger.error("Trainer initialization failed - TensorFlow/Keras not available")
            training_state["status"] = "failed"
            training_state["message"] = "TensorFlow/Keras not available for training"
            return

        logger.info("Trainer initialized successfully")
        training_state["status"] = "training"
        training_state["message"] = "Starting training..."
        training_state["current_epoch"] = 0
        training_state["total_epochs"] = LSTM_EPOCHS

        def progress(epoch, logs):
            # Nếu đã có yêu cầu huỷ, ta vẫn cập nhật tiến độ để frontend biết
            training_state["current_epoch"] = epoch
            training_state["loss"] = logs.get("loss")
            training_state["accuracy"] = logs.get("categorical_accuracy")
            total = training_state["total_epochs"]
            if total > 0:
                training_state["progress"] = int((epoch / total) * 100)

        # Gọi train (blocking)
        metrics = train_obj.train(progress_callback=progress)

        # Sau khi train kết thúc, kiểm tra cờ huỷ
        if cancel_event.is_set():
            logger.info("Training was cancelled; keeping status as cancelled")
            # Giữ nguyên trạng thái cancelled, không ghi đè
            return

        # Nếu không bị huỷ thì hoàn thành bình thường
        training_state["status"] = "completed"
        training_state["metrics"] = metrics
        training_state["message"] = "Training completed successfully"
        training_state["accuracy"] = metrics.get("accuracy", 0)
        training_state["progress"] = 100

        logger.info(f"Training completed. Accuracy: {training_state['accuracy']}")
        logger.info("=" * 80)
        logger.info("TRAINING PROCESS COMPLETED")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Training failed: {type(e).__name__}: {str(e)}", exc_info=True)
        # Nếu đã cancelled thì không ghi đè
        if not cancel_event.is_set():
            training_state["status"] = "failed"
            training_state["message"] = str(e)
        logger.info("=" * 80)
        logger.info("TRAINING PROCESS FAILED")
        logger.info("=" * 80)


@router.post("/start")
async def start_training():
    global training_state, training_thread
    logger.info("POST /training/start")

    if training_state["status"] == "training":
        raise HTTPException(status_code=400, detail="Training already in progress")

    # Reset cờ huỷ và trạng thái
    cancel_event.clear()
    training_state = {
        "status": "queued",
        "progress": 0,
        "current_epoch": 0,
        "total_epochs": LSTM_EPOCHS,
        "loss": None,
        "accuracy": None,
        "message": "Training queued...",
        "metrics": None,
    }

    training_thread = Thread(target=_train_worker, daemon=True)
    training_thread.start()
    logger.info(f"Training thread started: {training_thread.ident}")

    return {"status": "queued", "message": "Training started in background"}


@router.get("/status")
async def get_training_status():
    return training_state


@router.post("/cancel")
async def cancel_training():
    global training_state
    logger.info("POST /training/cancel")

    if training_state["status"] != "training":
        raise HTTPException(status_code=400, detail="No training in progress")

    # Bật cờ huỷ
    cancel_event.set()
    training_state["status"] = "cancelled"
    training_state["message"] = "Training cancelled by user"
    logger.info("Training cancelled by user")

    return {"status": "cancelled"}


@router.post("/validate")
async def validate_training_data():
    # Sử dụng collector được chia sẻ từ data_collection router
    from api.routers.data_collection import collector
    results = {}
    for action in ACTIONS:
        success, message = collector.validate_data(action)
        results[action] = {"valid": success, "message": message}
    return results


@router.get("/metrics")
async def get_training_metrics():
    if training_state["metrics"] is None:
        raise HTTPException(status_code=400, detail="No completed training metrics")
    return training_state["metrics"]