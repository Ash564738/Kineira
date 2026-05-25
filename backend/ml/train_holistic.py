# ml/train_holistic.py
import json
import logging
import os
import numpy as np
from typing import Dict, Optional, Callable, Any, Tuple

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score
    from tensorflow.keras.utils import to_categorical
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import Dropout, LSTM, Dense
    from tensorflow.keras.optimizers import Adam
    from tensorflow.keras.callbacks import Callback, EarlyStopping
    from tensorflow.keras.regularizers import L2
    KERAS_AVAILABLE = True
except ImportError:
    KERAS_AVAILABLE = False

from config import (
    ACTIONS,
    DATA_PATH,
    FEATURE_SIZE,
    SEQUENCE_LENGTH,
    LSTM_EPOCHS,
    LSTM_BATCH_SIZE,
    MODEL_PATH,
    N_HAND,
    N_POSE,
    N_FACE,
    LEFT_HAND_START,
    LEFT_HAND_END,
    RIGHT_HAND_START,
    RIGHT_HAND_END,
    POSE_START,
    POSE_END,
    FACE_START,
    FACE_END,
    LEFT_HAND_INDICES,
    RIGHT_HAND_INDICES,
)

logger = logging.getLogger(__name__)


def normalize_relative_hand(sequence: np.ndarray) -> np.ndarray:
    seq = sequence.copy()
    T = seq.shape[0]

    for t in range(T):
        frame = seq[t]

        left_hand = frame[LEFT_HAND_START:LEFT_HAND_END].reshape(N_HAND, 3)
        wrist_left = left_hand[0].copy()
        left_hand -= wrist_left
        frame[LEFT_HAND_START:LEFT_HAND_END] = left_hand.flatten()

        right_hand = frame[RIGHT_HAND_START:RIGHT_HAND_END].reshape(N_HAND, 3)
        wrist_right = right_hand[0].copy()
        right_hand -= wrist_right
        frame[RIGHT_HAND_START:RIGHT_HAND_END] = right_hand.flatten()

    return seq


def gaussian_noise_augment(sequence: np.ndarray, noise_std: float = 0.02) -> np.ndarray:
    noise = np.random.normal(0, noise_std, sequence.shape).astype(np.float32)
    return sequence + noise


def time_warp_augment(sequence: np.ndarray, max_warp: float = 0.1) -> np.ndarray:
    T = sequence.shape[0]
    if T < 3:
        return sequence

    src = np.arange(T, dtype=np.float32)
    center = np.random.randint(1, T - 1)
    delta = np.random.uniform(-max_warp, max_warp) * T
    dst = src.copy()

    for i in range(T):
        if i < center:
            dst[i] = src[i] + delta * (i / center)
        else:
            dst[i] = src[i] + delta * ((T - 1 - i) / (T - 1 - center))

    warped = np.zeros_like(sequence)
    for feat in range(sequence.shape[1]):
        warped[:, feat] = np.interp(src, dst, sequence[:, feat])

    return warped


class HolisticTrainer:
    def __init__(self, data_path: str = DATA_PATH, model_path: str = MODEL_PATH):
        logger.info(f"[TRAINER_INIT] Initializing HolisticTrainer - data_path: {data_path}, model_path: {model_path}")
        if not KERAS_AVAILABLE:
            raise ImportError("TensorFlow/Keras is required")

        self.data_path = data_path
        self.model_path = model_path
        self.model = None
        self.abs_max: Optional[np.ndarray] = None
        self.label_map = {label: num for num, label in enumerate(ACTIONS)}
        logger.info(f"[TRAINER_INIT] Label map created: {self.label_map}")

    def has_valid_data(self) -> bool:
        logger.info("[TRAINER_DATA] Validating training data...")
        for action in ACTIONS:
            action_dir = os.path.join(self.data_path, action)
            if not os.path.exists(action_dir):
                logger.warning(f"[TRAINER_DATA] Action directory not found: {action_dir}")
                return False

            video_dirs = [d for d in os.listdir(action_dir) if d.isdigit()]
            if not video_dirs:
                logger.warning(f"[TRAINER_DATA] No video directories found for action '{action}'")
                return False

            sample_seq = video_dirs[0]
            for frame_num in range(SEQUENCE_LENGTH):
                frame_path = os.path.join(action_dir, sample_seq, f"{frame_num}.npy")
                if not os.path.exists(frame_path):
                    logger.warning(f"[TRAINER_DATA] Frame missing: {frame_path}")
                    return False
                data = np.load(frame_path)
                if data.shape[0] != FEATURE_SIZE:
                    logger.warning(
                        f"[TRAINER_DATA] Frame shape mismatch at {frame_path}: expected {FEATURE_SIZE}, got {data.shape[0]}"
                    )
                    return False

        logger.info("[TRAINER_DATA] All data validation checks passed!")
        return True

    def _scale_with_abs_max(self, X: np.ndarray, abs_max: np.ndarray) -> np.ndarray:
        X_flat = X.reshape(-1, X.shape[-1])
        abs_max = np.asarray(abs_max, dtype=np.float32)
        abs_max = np.where(abs_max == 0, 1.0, abs_max)
        X_flat = X_flat / abs_max
        return X_flat.reshape(X.shape[0], X.shape[1], -1)

    def load_data(self, augment: bool = True, save_scaler: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        """
        Tải dữ liệu, áp dụng:
          - Chuẩn hóa relative tay (wrist-centric)
          - Data augmentation (nhiễu + time warp) nếu augment=True
          - Max-Abs scaling nhất quán
        """
        logger.info("[TRAINER_LOAD] Loading training data...")
        raw_sequences, labels = [], []

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
                    if res.shape[0] != FEATURE_SIZE or not np.isfinite(res).all():
                        missing = True
                        break

                    window.append(res)

                if not missing and len(window) == SEQUENCE_LENGTH:
                    seq_arr = np.array(window, dtype=np.float32)
                    seq_arr = normalize_relative_hand(seq_arr)

                    raw_sequences.append(seq_arr)
                    labels.append(self.label_map[action])
                    loaded_count += 1

                    if augment:
                        noised = gaussian_noise_augment(seq_arr, noise_std=0.02)
                        raw_sequences.append(noised)
                        labels.append(self.label_map[action])

                        warped = time_warp_augment(seq_arr, max_warp=0.1)
                        raw_sequences.append(warped)
                        labels.append(self.label_map[action])

            logger.info(f"[TRAINER_LOAD] Loaded {loaded_count} sequences for action '{action}' (augmented x3)")

        if len(raw_sequences) == 0:
            logger.error("[TRAINER_LOAD] No valid sequences found")
            raise ValueError("No valid sequences found")

        X = np.asarray(raw_sequences, dtype=np.float32)
        logger.info(f"[TRAINER_LOAD] Data stats BEFORE normalize - min={X.min()}, max={X.max()}, shape={X.shape}")

        # Dùng scaler đã fit trước đó nếu có, nếu chưa có thì fit mới
        if self.abs_max is None or save_scaler:
            X_flat = X.reshape(-1, X.shape[-1])
            abs_max = np.maximum(np.abs(X_flat.min(axis=0)), np.abs(X_flat.max(axis=0)))
            abs_max = np.where(abs_max == 0, 1.0, abs_max)
            self.abs_max = abs_max.astype(np.float32)

            if save_scaler:
                scaler_params = {"abs_max": self.abs_max.tolist()}
                scaler_path = os.path.join(os.path.dirname(self.model_path), "scaler.json")
                with open(scaler_path, "w") as f:
                    json.dump(scaler_params, f)
                logger.info(f"[TRAINER_LOAD] Scaler params saved to {scaler_path}")
        else:
            logger.info("[TRAINER_LOAD] Using existing scaler (not overwriting).")

        X = self._scale_with_abs_max(X, self.abs_max)

        y = to_categorical(labels, num_classes=len(ACTIONS)).astype(np.float32)
        return X, y

    def build_model(self, num_actions: int):
        model = Sequential([
            LSTM(
                64,
                return_sequences=False,
                activation="relu",
                input_shape=(SEQUENCE_LENGTH, FEATURE_SIZE),
                kernel_regularizer=L2(0.001),
            ),
            Dropout(0.3),
            Dense(32, activation="relu", kernel_regularizer=L2(0.001)),
            Dropout(0.3),
            Dense(num_actions, activation="softmax"),
        ])
        model.compile(
            optimizer=Adam(learning_rate=0.0003, clipnorm=1.0),
            loss="categorical_crossentropy",
            metrics=["categorical_accuracy"],
        )
        return model

    def train(self, progress_callback: Optional[Callable[[int, dict], None]] = None) -> Dict:
        logger.info("=" * 80)
        logger.info("[TRAINER_TRAIN] TRAINING PROCESS STARTED")
        logger.info("=" * 80)

        if not self.has_valid_data():
            raise ValueError("Insufficient valid data for training")

        X, y = self.load_data(augment=True, save_scaler=True)
        logger.info(f"[TRAINER_TRAIN] Data loaded - X: {X.shape}, y: {y.shape}")

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, stratify=np.argmax(y, axis=1)
        )
        logger.info(f"[TRAINER_TRAIN] Train samples: {X_train.shape[0]}, Test samples: {X_test.shape[0]}")

        self.model = self.build_model(len(ACTIONS))

        callbacks = []
        early_stop = EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True,
            min_delta=0.001,
            verbose=1,
        )
        callbacks.append(early_stop)

        if progress_callback:
            class ProgressCallback(Callback):
                def on_epoch_end(self, epoch, logs=None):
                    progress_callback(epoch + 1, logs or {})
            callbacks.append(ProgressCallback())

        history = self.model.fit(
            X_train,
            y_train,
            epochs=LSTM_EPOCHS,
            batch_size=LSTM_BATCH_SIZE,
            validation_split=0.2,
            verbose=1,
            callbacks=callbacks,
        )

        self.model.save(self.model_path)

        actions_meta_path = os.path.join(os.path.dirname(self.model_path), "actions.json")
        with open(actions_meta_path, "w") as f:
            json.dump(ACTIONS, f)

        # Reference sequences dùng cùng scaler đã fit ở trên
        X_ref, y_ref = self.load_data(augment=False, save_scaler=False)
        self.save_reference_sequences(X_ref, y_ref)

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
            raise ImportError("TensorFlow/Keras is required")
        if os.path.exists(self.model_path):
            self.model = load_model(self.model_path)
            logger.info("[TRAINER_LOAD_MODEL] Model loaded successfully")

            scaler_path = os.path.join(os.path.dirname(self.model_path), "scaler.json")
            if os.path.exists(scaler_path):
                with open(scaler_path, "r") as f:
                    scaler_params = json.load(f)
                    self.abs_max = np.array(scaler_params.get("abs_max", []), dtype=np.float32)
                logger.info("[TRAINER_LOAD_MODEL] Scaler loaded successfully")

            return True

        logger.warning(f"[TRAINER_LOAD_MODEL] Model file not found: {self.model_path}")
        return False

    def _find_medoid_sequence(self, sequences: np.ndarray) -> np.ndarray:
        n = len(sequences)
        if n == 0:
            raise ValueError("Empty sequences")

        flat = sequences.reshape(n, -1)
        dist = np.zeros((n, n), dtype=np.float32)

        for i in range(n):
            for j in range(i + 1, n):
                d = np.linalg.norm(flat[i] - flat[j])
                dist[i, j] = d
                dist[j, i] = d

        total_dist = dist.sum(axis=1)
        best_idx = np.argmin(total_dist)
        return sequences[best_idx]

    def save_reference_sequences(self, X: np.ndarray, y: np.ndarray):
        try:
            from ml.hand_utils import detect_active_hands
        except ImportError:
            logger.warning("[REF] ml.hand_utils not found, skipping reference saving.")
            return

        ref_dir = os.path.dirname(self.model_path)

        for action_idx, action in enumerate(ACTIONS):
            mask = np.argmax(y, axis=1) == action_idx
            action_seqs = X[mask]

            if len(action_seqs) == 0:
                logger.warning(f"[REF] No sequences for action {action}, skipping reference.")
                continue

            left_seqs, right_seqs, both_seqs = [], [], []

            for seq in action_seqs:
                has_left, has_right = detect_active_hands(seq)
                if has_left and not has_right:
                    left_seqs.append(seq)
                elif has_right and not has_left:
                    right_seqs.append(seq)
                elif has_left and has_right:
                    both_seqs.append(seq)

            if len(left_seqs) > 0:
                left_medoid = self._find_medoid_sequence(np.array(left_seqs))
                np.save(os.path.join(ref_dir, f"ref_{action}_left.npy"), left_medoid)
                logger.info(f"[REF] Saved ref_{action}_left.npy ({len(left_seqs)} sequences)")

            if len(right_seqs) > 0:
                right_medoid = self._find_medoid_sequence(np.array(right_seqs))
                np.save(os.path.join(ref_dir, f"ref_{action}_right.npy"), right_medoid)
                logger.info(f"[REF] Saved ref_{action}_right.npy ({len(right_seqs)} sequences)")

            if len(both_seqs) > 0:
                both_medoid = self._find_medoid_sequence(np.array(both_seqs))
                np.save(os.path.join(ref_dir, f"ref_{action}_both.npy"), both_medoid)
                logger.info(f"[REF] Saved ref_{action}_both.npy ({len(both_seqs)} sequences)")

            if len(left_seqs) == 0 and len(right_seqs) == 0 and len(both_seqs) == 0:
                logger.warning(f"[REF] No hand-specific sequences found for action {action}")

    def predict(self, sequence: np.ndarray):
        if self.model is None:
            raise ValueError("Model not loaded")
        if len(sequence) != SEQUENCE_LENGTH:
            return None, 0.0
        res = self.model.predict(np.expand_dims(sequence, axis=0), verbose=0)[0]
        action_idx = np.argmax(res)
        confidence = float(res[action_idx])
        return ACTIONS[action_idx], confidence