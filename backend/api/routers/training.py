# api/routers/training.py
import asyncio
import logging
from threading import Thread
from typing import Optional

from fastapi import APIRouter, HTTPException

from ml.train_holistic import HolisticTrainer

from config import LSTM_EPOCHS


router = APIRouter(prefix="/training", tags=["training"])
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
        logger.debug(f"[TRAIN_WORKER] Initializing trainer...")
        train_obj = get_trainer()
        if train_obj is None:
            logger.error("[TRAIN_WORKER] Trainer initialization failed - TensorFlow/Keras not available")
            training_state["status"] = "failed"
            training_state["message"] = "TensorFlow/Keras not available for training"
            return

        logger.info("[TRAIN_WORKER] Trainer initialized successfully")
        training_state["status"] = "training"
        training_state["message"] = "Starting training..."
        training_state["current_epoch"] = 0
        training_state["total_epochs"] = LSTM_EPOCHS
        logger.info(f"[TRAIN_WORKER] Training state: status={training_state['status']}, total_epochs={training_state['total_epochs']}")

        def progress(epoch, logs):
            training_state["current_epoch"] = epoch
            training_state["loss"] = logs.get("loss")
            training_state["accuracy"] = logs.get("categorical_accuracy")
            # Calculate progress percentage
            total_epochs = training_state["total_epochs"]
            if total_epochs > 0:
                training_state["progress"] = int((epoch / total_epochs) * 100)
            logger.debug(f"[TRAIN_WORKER] Epoch {epoch}: loss={training_state['loss']}, accuracy={training_state['accuracy']}, progress={training_state['progress']}%")

        logger.info("[TRAIN_WORKER] Starting actual training...")
        metrics = train_obj.train(progress_callback=progress)
        logger.info(f"[TRAIN_WORKER] Training returned metrics: {metrics}")

        training_state["status"] = "completed"
        training_state["metrics"] = metrics
        training_state["message"] = "Training completed successfully"
        training_state["accuracy"] = metrics.get("accuracy", 0)
        training_state["progress"] = 100

        logger.info(f"[TRAIN_WORKER] Training completed successfully. Accuracy: {training_state['accuracy']}, Metrics: {metrics}")
        logger.info("=" * 80)
        logger.info("TRAINING PROCESS COMPLETED")
        logger.info("=" * 80)
    except Exception as e:
        logger.error(f"[TRAIN_WORKER] Training failed with exception: {type(e).__name__}: {str(e)}", exc_info=True)
        training_state["status"] = "failed"
        training_state["message"] = str(e)
        logger.info("=" * 80)
        logger.info("TRAINING PROCESS FAILED")
        logger.info("=" * 80)


@router.post("/start")
async def start_training():
    global training_state, training_thread
    logger.info("[TRAINING_ENDPOINT] POST /training/start called")

    if training_state["status"] == "training":
        logger.warning("[TRAINING_ENDPOINT] Training already in progress")
        raise HTTPException(status_code=400, detail="Training already in progress")

    logger.info("[TRAINING_ENDPOINT] Starting new training job...")
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
    logger.info(f"[TRAINING_ENDPOINT] Training thread started: {training_thread.ident}")

    return {"status": "queued", "message": "Training started in background"}


@router.get("/status")
async def get_training_status():
    logger.debug(f"[TRAINING_ENDPOINT] GET /training/status called. Current state: {training_state}")
    return training_state


@router.post("/cancel")
async def cancel_training():
    global training_state
    logger.info("[TRAINING_ENDPOINT] POST /training/cancel called")

    if training_state["status"] != "training":
        logger.warning(f"[TRAINING_ENDPOINT] Cannot cancel - no training in progress. Current status: {training_state['status']}")
        raise HTTPException(status_code=400, detail="No training in progress")

    training_state["status"] = "cancelled"
    training_state["message"] = "Training cancelled by user"
    logger.info("[TRAINING_ENDPOINT] Training cancelled by user")

    return {"status": "cancelled"}


@router.post("/validate")
async def validate_training_data():
    logger.info("[TRAINING_ENDPOINT] POST /training/validate called")
    results = {}
    from config import ACTIONS, DATA_PATH
    from ml.data_collection import DataCollector

    logger.debug(f"[TRAINING_ENDPOINT] Loading collector with data_path: {DATA_PATH}")
    collector = DataCollector(data_path=DATA_PATH)

    for action in ACTIONS:
        logger.debug(f"[TRAINING_ENDPOINT] Validating action: {action}")
        success, message = collector.validate_data(action)
        logger.debug(f"[TRAINING_ENDPOINT] Action {action} validation: success={success}, message={message}")
        results[action] = {"valid": success, "message": message}

    logger.info(f"[TRAINING_ENDPOINT] Validation complete. Results: {results}")
    return results


@router.get("/metrics")
async def get_training_metrics():
    logger.info("[TRAINING_ENDPOINT] GET /training/metrics called")
    if training_state["metrics"] is None:
        logger.warning("[TRAINING_ENDPOINT] No completed training metrics available")
        raise HTTPException(status_code=400, detail="No completed training metrics")

    logger.debug(f"[TRAINING_ENDPOINT] Returning metrics: {training_state['metrics']}")
    return training_state["metrics"]