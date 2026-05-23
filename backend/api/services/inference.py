import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

try:
    from tensorflow.keras.models import load_model as keras_load_model
    KERAS_AVAILABLE = True
except ImportError:
    KERAS_AVAILABLE = False
    keras_load_model = None

from config import MODEL_PATH, ACTIONS

logger = logging.getLogger(__name__)

KERAS_MODEL_PATH = Path(MODEL_PATH)
ACTIONS_META_PATH = KERAS_MODEL_PATH.parent / "actions.json"


class PredictionSmoother:
    def __init__(self, window_size: int = 5, threshold: float = 0.5):
        self.window_size = window_size
        self.threshold = threshold
        self.history: List[Tuple[int, float]] = []
        self.current_sentence: List[str] = []

    def update(self, preds: np.ndarray) -> Optional[str]:
        idx = int(np.argmax(preds))
        conf = float(preds[idx])
        self.history.append((idx, conf))
        if len(self.history) > self.window_size:
            self.history.pop(0)

        if len(self.history) == self.window_size:
            recent_idxs = [h[0] for h in self.history]
            if len(set(recent_idxs)) == 1:
                avg_conf = np.mean([h[1] for h in self.history])
                if avg_conf >= self.threshold:
                    action = ACTIONS[self.history[-1][0]]
                    if len(self.current_sentence) == 0 or action != self.current_sentence[-1]:
                        self.current_sentence.append(action)
                    if len(self.current_sentence) > 5:
                        self.current_sentence = self.current_sentence[-5:]
                    return action
        return None


class InferenceService:
    def __init__(self) -> None:
        self.keras_model: Any = None
        self.keras_labels: List[str] = []
        self.smoother = PredictionSmoother(window_size=5, threshold=0.5)

    def startup(self) -> None:
        logger.info("[INFERENCE_SERVICE] InferenceService starting up...")
        self.load_keras_model()
        logger.info("[INFERENCE_SERVICE] InferenceService startup complete.")

    def load_keras_model(self) -> None:
        logger.info("[INFERENCE_SERVICE] Loading Keras model...")
        if not KERAS_AVAILABLE:
            logger.warning("[INFERENCE_SERVICE] Keras not available, skipping keras model")
            return
        if not KERAS_MODEL_PATH.exists():
            logger.warning(f"[INFERENCE_SERVICE] Keras model not found at {KERAS_MODEL_PATH}")
            return
        try:
            self.keras_model = keras_load_model(KERAS_MODEL_PATH, compile=False)
            if ACTIONS_META_PATH.exists():
                with open(ACTIONS_META_PATH, 'r') as f:
                    saved_actions = json.load(f)
                self.keras_labels = saved_actions
            else:
                self.keras_labels = list(ACTIONS)
            logger.info(f"[INFERENCE_SERVICE] Loaded model with actions: {self.keras_labels}")
        except Exception as e:
            logger.error(f"[INFERENCE_SERVICE] Failed to load model: {e}", exc_info=True)
            self.keras_model = None

    def predict_keras(self, keypoints_sequence: List[List[float]]) -> Dict[str, Any]:
        if not self.keras_model:
            self.load_keras_model()
        if not self.keras_model:
            return {"sign": "model_not_loaded", "confidence": 0.0}

        seq = np.array(keypoints_sequence, dtype=np.float32)
        if seq.shape[0] != 30:
            if seq.shape[0] < 30:
                pad = np.zeros((30 - seq.shape[0], seq.shape[1]), dtype=np.float32)
                seq = np.vstack([seq, pad])
            else:
                seq = seq[:30]

        seq = np.expand_dims(seq, axis=0)
        preds = self.keras_model.predict(seq, verbose=0)[0]

        stable_action = self.smoother.update(preds)
        if stable_action:
            confidence = float(preds[ACTIONS.index(stable_action)])
            logger.info(f"Stable: {stable_action} ({confidence:.2f})")
            return {"sign": stable_action, "confidence": confidence}
        else:
            idx = int(np.argmax(preds))
            label = self.keras_labels[idx] if idx < len(self.keras_labels) else "unknown"
            conf = float(preds[idx])
            logger.info(f"Fallback (not yet stable): {label} ({conf:.2f})")
            return {"sign": label, "confidence": conf}


inference_service = InferenceService()