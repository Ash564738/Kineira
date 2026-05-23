import json
import logging
import os
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Callable

logger = logging.getLogger(__name__)

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score
    from tensorflow.keras.utils import to_categorical
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense
    from tensorflow.keras.optimizers import Adam
    from tensorflow.keras.callbacks import Callback
    KERAS_AVAILABLE = True
except ImportError:
    KERAS_AVAILABLE = False
    Sequential = Any
    load_model = None
    to_categorical = None
    train_test_split = None
    accuracy_score = None
    Callback = object

from config import (
    ACTIONS,
    DATA_PATH,
    FEATURE_SIZE,
    LSTM_EPOCHS,
    LSTM_BATCH_SIZE,
    MODEL_PATH,
    SEQUENCE_LENGTH,
)

class HolisticTrainer:
    def __init__(self, data_path: str = DATA_PATH, model_path: str = MODEL_PATH):
        logger.info(f"[TRAINER_INIT] Initializing HolisticTrainer - data_path: {data_path}, model_path: {model_path}")
        if not KERAS_AVAILABLE:
            logger.error("[TRAINER_INIT] KERAS not available - cannot initialize trainer")
            raise ImportError("TensorFlow/Keras is required for training")

        self.data_path = data_path
        self.model_path = model_path
        self.model = None
        self.label_map = {label: num for num, label in enumerate(ACTIONS)}
        logger.info(f"[TRAINER_INIT] Label map created: {self.label_map}")

    def has_valid_data(self) -> bool:
        logger.info("[TRAINER_DATA] Validating training data...")
        for action in ACTIONS:
            action_dir = os.path.join(self.data_path, action)
            logger.debug(f"[TRAINER_DATA] Checking action '{action}' at {action_dir}")
            if not os.path.exists(action_dir):
                logger.warning(f"[TRAINER_DATA] Action directory not found: {action_dir}")
                return False

            video_dirs = [d for d in os.listdir(action_dir) if d.isdigit()]
            logger.debug(f"[TRAINER_DATA] Found {len(video_dirs)} video directories for action '{action}'")
            if not video_dirs:
                logger.warning(f"[TRAINER_DATA] No video directories found for action '{action}'")
                return False

            sample_seq = video_dirs[0]
            logger.debug(f"[TRAINER_DATA] Checking sample video '{sample_seq}' for action '{action}'")
            for frame_num in range(SEQUENCE_LENGTH):
                frame_path = os.path.join(action_dir, sample_seq, f"{frame_num}.npy")
                if not os.path.exists(frame_path):
                    logger.warning(f"[TRAINER_DATA] Frame missing: {frame_path}")
                    return False

                data = np.load(frame_path)
                if data.shape[0] != FEATURE_SIZE:
                    logger.warning(f"[TRAINER_DATA] Frame shape mismatch at {frame_path}: expected {FEATURE_SIZE}, got {data.shape[0]}")
                    return False

        logger.info("[TRAINER_DATA] All data validation checks passed!")
        return True

    def load_data(self) -> Tuple[np.ndarray, np.ndarray]:
        logger.info("[TRAINER_LOAD] Loading training data...")
        sequences, labels = [], []

        for action in ACTIONS:
            action_path = os.path.join(self.data_path, action)
            if not os.path.exists(action_path):
                logger.warning(f"[TRAINER_LOAD] Action path doesn't exist: {action_path}")
                continue

            video_dirs = [int(d) for d in os.listdir(action_path) if d.isdigit()]
            loaded_count = 0

            for seq in sorted(video_dirs):
                window = []
                missing = False

                for frame_num in range(SEQUENCE_LENGTH):
                    frame_path = os.path.join(action_path, str(seq), f"{frame_num}.npy")

                    if not os.path.exists(frame_path):
                        missing = True
                        break

                    res = np.load(frame_path)

                    if res.shape[0] != FEATURE_SIZE:
                        missing = True
                        break

                    if not np.isfinite(res).all():
                        missing = True
                        break

                    window.append(res)

                if not missing and len(window) == SEQUENCE_LENGTH:
                    sequences.append(window)
                    labels.append(self.label_map[action])
                    loaded_count += 1

            logger.info(f"[TRAINER_LOAD] Loaded {loaded_count} valid sequences for action '{action}'")

        if len(sequences) == 0:
            raise ValueError("No valid sequences found")

        X = np.asarray(sequences, dtype=np.float32)
        y = to_categorical(labels, num_classes=len(ACTIONS)).astype(np.float32)

        logger.info(f"[TRAINER_LOAD] Data loaded - X shape: {X.shape}, y shape: {y.shape}")
        return X, y

    def build_model(self, num_actions: int) -> Any:
        logger.info(f"[TRAINER_BUILD] Building LSTM model for {num_actions} actions...")

        model = Sequential([
            LSTM(64, return_sequences=True, activation='relu', input_shape=(SEQUENCE_LENGTH, FEATURE_SIZE)),
            LSTM(128, return_sequences=True, activation='relu'),
            LSTM(64, return_sequences=False, activation='relu'),
            Dense(64, activation='relu'),
            Dense(32, activation='relu'),
            Dense(num_actions, activation='softmax')
        ])

        model.compile(
            optimizer=Adam(),
            loss='categorical_crossentropy',
            metrics=['categorical_accuracy']
        )
        return model

    def train(self, progress_callback: Optional[Callable[[int, dict], None]] = None) -> Dict:
        logger.info("=" * 80)
        logger.info("[TRAINER_TRAIN] TRAINING PROCESS STARTED")
        logger.info("=" * 80)

        if not self.has_valid_data():
            raise ValueError("Insufficient valid data for training")

        X, y = self.load_data()
        logger.info(f"[TRAINER_TRAIN] Data loaded - X: {X.shape}, y: {y.shape}")

        # Tách tập train/test giống notebook (test_size=0.05)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.05, random_state=42, stratify=np.argmax(y, axis=1)
        )
        logger.info(f"[TRAINER_TRAIN] Train samples: {X_train.shape[0]}, Test samples: {X_test.shape[0]}")

        # Không chuẩn hóa, không augment, giữ nguyên dữ liệu như notebook

        self.model = self.build_model(len(ACTIONS))

        # Chỉ dùng callback progress (không early stopping)
        callbacks = []
        if progress_callback:
            class ProgressCallback(Callback):
                def on_epoch_end(self, epoch, logs=None):
                    progress_callback(epoch + 1, logs or {})
            callbacks.append(ProgressCallback())

        history = self.model.fit(
            X_train, y_train,
            epochs=LSTM_EPOCHS,
            batch_size=LSTM_BATCH_SIZE,
            verbose=1,
            callbacks=callbacks,
        )

        # Lưu model và danh sách actions
        self.model.save(self.model_path)
        actions_meta_path = os.path.join(os.path.dirname(self.model_path), "actions.json")
        with open(actions_meta_path, 'w') as f:
            json.dump(ACTIONS, f)

        # Đánh giá trên tập test
        yhat = self.model.predict(X_test, verbose=0)
        ytrue = np.argmax(y_test, axis=1)
        ypred = np.argmax(yhat, axis=1)
        accuracy = accuracy_score(ytrue, ypred)

        return {
            "status": "completed",
            "model_path": self.model_path,
            "accuracy": float(accuracy),
            "train_samples": int(X_train.shape[0]),
            "test_samples": int(X_test.shape[0]),
            "epochs": len(history.epoch),
            "loss": float(history.history["loss"][-1]),
        }
    def load_model(self):
        logger.info(f"[TRAINER_LOAD_MODEL] Loading model from {self.model_path}...")
        if not KERAS_AVAILABLE:
            logger.error("[TRAINER_LOAD_MODEL] Keras not available")
            raise ImportError("TensorFlow/Keras is required")
        if os.path.exists(self.model_path):
            self.model = load_model(self.model_path)
            logger.info(f"[TRAINER_LOAD_MODEL] Model loaded successfully")
            return True
        logger.warning(f"[TRAINER_LOAD_MODEL] Model file not found: {self.model_path}")
        return False

    def predict(self, sequence: np.ndarray) -> Tuple[str, float]:
        if self.model is None:
            raise ValueError("Model not loaded")
        if len(sequence) != SEQUENCE_LENGTH:
            return None, 0.0
        res = self.model.predict(np.expand_dims(sequence, axis=0), verbose=0)[0]
        action_idx = np.argmax(res)
        confidence = float(res[action_idx])
        action = ACTIONS[action_idx]
        return action, confidence