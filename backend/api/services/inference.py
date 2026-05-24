# api/services/inference.py
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

from config import MODEL_PATH, ACTIONS_META_PATH, SCALER_PATH, ACTIONS
from config import N_HAND, N_POSE, N_FACE, FEATURE_SIZE  # thêm để dùng trong relative norm

logger = logging.getLogger(__name__)

KERAS_MODEL_PATH = Path(MODEL_PATH)
ACTIONS_META_PATH = KERAS_MODEL_PATH.parent / "actions.json"

# Hằng số cho vị trí các phần trong vector (phải khớp với trainer)
LEFT_HAND_START = 0
LEFT_HAND_END = N_HAND * 3
RIGHT_HAND_START = LEFT_HAND_END
RIGHT_HAND_END = RIGHT_HAND_START + N_HAND * 3
# không cần pose/face ở đây vì ta chỉ relative hóa tay

def normalize_relative_hand(sequence: np.ndarray) -> np.ndarray:
    """
    Đưa tọa độ tay về relative to wrist (landmark 0 của mỗi tay).
    sequence: (T, FEATURE_SIZE) - có thể là một video hoặc batch
    """
    seq = sequence.copy()
    T = seq.shape[0]
    for t in range(T):
        frame = seq[t]
        # Tay trái
        left_hand = frame[LEFT_HAND_START:LEFT_HAND_END].reshape(N_HAND, 3)
        wrist_left = left_hand[0].copy()
        left_hand -= wrist_left
        frame[LEFT_HAND_START:LEFT_HAND_END] = left_hand.flatten()
        # Tay phải
        right_hand = frame[RIGHT_HAND_START:RIGHT_HAND_END].reshape(N_HAND, 3)
        wrist_right = right_hand[0].copy()
        right_hand -= wrist_right
        frame[RIGHT_HAND_START:RIGHT_HAND_END] = right_hand.flatten()
    return seq


class PredictionSmoother:
    # giữ nguyên
    def __init__(self, window_size: int = 3, threshold: float = 0.5):
        self.window_size = window_size
        self.threshold = threshold
        self.history: List[Tuple[int, float]] = []
        self.current_sentence: List[str] = []

    def reset(self):
        self.history = []
        self.current_sentence = []

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
        self.smoother = PredictionSmoother(window_size=3, threshold=0.5)
        self.scaler_params: Dict[str, Any] = None
        self.keras_model_path: Path = Path(MODEL_PATH)

    def startup(self) -> None:
        logger.info("[INFERENCE_SERVICE] InferenceService starting up...")
        self.load_keras_model()
        logger.info("[INFERENCE_SERVICE] InferenceService startup complete.")

    def load_keras_model(self) -> None:
        # giữ nguyên code cũ
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

            scaler_file = Path(SCALER_PATH)
            if scaler_file.exists():
                with open(scaler_file, 'r') as f:
                    self.scaler_params = json.load(f)
                logger.info("[INFERENCE_SERVICE] Loaded scaler params")

            logger.info(f"[INFERENCE_SERVICE] Loaded model with actions: {self.keras_labels}")
        except Exception as e:
            logger.error(f"[INFERENCE_SERVICE] Failed to load model: {e}", exc_info=True)
            self.keras_model = None

    def normalize_sequence(self, seq: np.ndarray) -> np.ndarray:
        """Max-Abs scaling, giữ nguyên giá trị 0."""
        if self.scaler_params is None:
            logger.warning("[INFERENCE_SERVICE] No scaler params, using local max-abs")
            seq_flat = seq.reshape(-1, seq.shape[-1])
            abs_max = np.maximum(np.abs(seq_flat.min(axis=0)), np.abs(seq_flat.max(axis=0)))
            abs_max = np.where(abs_max == 0, 1.0, abs_max)
            return (seq_flat / abs_max).reshape(seq.shape)

        abs_max = np.array(self.scaler_params.get("abs_max", []))
        if len(abs_max) != seq.shape[-1]:
            # fallback nếu scaler không khớp
            seq_flat = seq.reshape(-1, seq.shape[-1])
            abs_max = np.maximum(np.abs(seq_flat.min(axis=0)), np.abs(seq_flat.max(axis=0)))
            abs_max = np.where(abs_max == 0, 1.0, abs_max)
            return (seq_flat / abs_max).reshape(seq.shape)

        seq_flat = seq.reshape(-1, seq.shape[-1])
        return (seq_flat / abs_max).reshape(seq.shape)

    def predict_keras(self, keypoints_sequence: List[List[float]]) -> Dict[str, Any]:
        if not self.keras_model:
            self.load_keras_model()
        if not self.keras_model:
            return {"sign": "model_not_loaded", "confidence": 0.0, "stable": False}

        seq = np.array(keypoints_sequence, dtype=np.float32)
        if seq.shape[0] != 30:
            if seq.shape[0] < 30:
                pad = np.zeros((30 - seq.shape[0], seq.shape[1]), dtype=np.float32)
                seq = np.vstack([seq, pad])
            else:
                seq = seq[:30]

        # BƯỚC QUAN TRỌNG: Chuẩn hóa tay về relative (giống huấn luyện)
        seq = normalize_relative_hand(seq)

        # Sau đó max-abs scaling
        seq = self.normalize_sequence(seq)

        seq = np.expand_dims(seq, axis=0)
        preds = self.keras_model.predict(seq, verbose=0)[0]
        logger.info(f"Raw prediction: {self.keras_labels[np.argmax(preds)]} ({np.max(preds):.4f})")

        stable_action = self.smoother.update(preds)
        if stable_action:
            confidence = float(preds[ACTIONS.index(stable_action)])
            logger.info(f"Stable: {stable_action} ({confidence:.2f})")
            return {"sign": stable_action, "confidence": confidence, "stable": True}
        else:
            idx = int(np.argmax(preds))
            label = self.keras_labels[idx] if idx < len(self.keras_labels) else "unknown"
            conf = float(preds[idx])
            logger.info(f"Fallback (not yet stable): {label} ({conf:.2f})")
            return {"sign": label, "confidence": conf, "stable": False}


inference_service = InferenceService()