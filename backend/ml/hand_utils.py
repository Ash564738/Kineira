# ml/hand_utils.py
"""
Hand-specific utilities for landmark detection, normalization, and processing.
"""

import logging
import numpy as np
from typing import Tuple, Dict, Optional

from config import N_HAND  # đảm bảo config.py có N_HAND = 21

logger = logging.getLogger(__name__)

# ========== Tự tính thay vì import từ train_holistic ==========
LEFT_HAND_START = 0
LEFT_HAND_END = N_HAND * 3                # 63
RIGHT_HAND_START = LEFT_HAND_END          # 63
RIGHT_HAND_END = RIGHT_HAND_START + N_HAND * 3  # 126

# Hand indices trong vector 1D (dùng cho slicing)
LEFT_HAND_INDICES = np.arange(LEFT_HAND_START, LEFT_HAND_END)    # 0..62
RIGHT_HAND_INDICES = np.arange(RIGHT_HAND_START, RIGHT_HAND_END) # 63..125
BODY_INDICES = np.arange(RIGHT_HAND_END, 329)   # 126..328 (Pose + Face)

# ========== Các hàm giữ nguyên ==========
def detect_active_hands(sequence: np.ndarray) -> Tuple[bool, bool]:
    left_data = sequence[:, LEFT_HAND_START:LEFT_HAND_END]
    right_data = sequence[:, RIGHT_HAND_START:RIGHT_HAND_END]
    left_nonzero = np.count_nonzero(left_data)
    right_nonzero = np.count_nonzero(right_data)
    threshold = 100
    has_left = left_nonzero > threshold and np.var(left_data) > 1e-4
    has_right = right_nonzero > threshold and np.var(right_data) > 1e-4
    return has_left, has_right

def detect_hand_activity_per_frame(sequence: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    left_data = sequence[:, LEFT_HAND_INDICES]
    right_data = sequence[:, RIGHT_HAND_INDICES]
    left_active = np.any(np.abs(left_data) > 1e-6, axis=1)
    right_active = np.any(np.abs(right_data) > 1e-6, axis=1)
    return left_active, right_active

def mirror_hand_landmarks(hand_data: np.ndarray, is_left_to_right: bool = True) -> np.ndarray:
    mirrored = hand_data.copy()
    original_shape = mirrored.shape
    if len(original_shape) == 2:
        mirrored = mirrored.reshape(-1, 21, 3)
    elif len(original_shape) == 3:
        mirrored = mirrored.reshape(original_shape[0], -1, 21, 3)
    mirrored[..., 0] *= -1
    return mirrored.reshape(original_shape)

def extract_hand_features(sequence: np.ndarray, hand_type: str = "left") -> np.ndarray:
    if hand_type == "left":
        return sequence[:, LEFT_HAND_INDICES]
    elif hand_type == "right":
        return sequence[:, RIGHT_HAND_INDICES]
    elif hand_type == "active":
        has_left, has_right = detect_active_hands(sequence)
        if has_left and has_right:
            return sequence[:, list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)]
        elif has_left:
            return sequence[:, LEFT_HAND_INDICES]
        elif has_right:
            return sequence[:, RIGHT_HAND_INDICES]
        else:
            return np.zeros((sequence.shape[0], 63))
    else:
        raise ValueError(f"Unknown hand_type: {hand_type}")

def extract_body_features(sequence: np.ndarray) -> np.ndarray:
    return sequence[:, BODY_INDICES]

def normalize_hand_representation(
    user_seq: np.ndarray,
    reference_seq: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, str]:
    user_left, user_right = detect_active_hands(user_seq)
    ref_left, ref_right = detect_active_hands(reference_seq)

    logger.debug(f"[HAND_NORM] User hands: left={user_left}, right={user_right}")
    logger.debug(f"[HAND_NORM] Reference hands: left={ref_left}, right={ref_right}")

    # Case 1: Perfect match
    if (user_left and ref_left) or (user_right and ref_right):
        if user_left and ref_left:
            logger.debug("[HAND_NORM] Both use left hand")
            return user_seq, reference_seq, "same"
        else:
            logger.debug("[HAND_NORM] Both use right hand")
            return user_seq, reference_seq, "same"

    # Case 2: Hands don't match - need normalization
    if (user_left and ref_right):
        logger.debug("[HAND_NORM] User left, reference right → mirroring user")
        user_normalized = user_seq.copy()
        left_hand = user_normalized[:, LEFT_HAND_INDICES]
        mirrored_left = mirror_hand_landmarks(left_hand, is_left_to_right=True)
        user_normalized[:, RIGHT_HAND_INDICES] = mirrored_left
        user_normalized[:, LEFT_HAND_INDICES] = 0
        return user_normalized, reference_seq, "mirror_user"

    elif (user_right and ref_left):
        logger.debug("[HAND_NORM] User right, reference left → mirroring user")
        user_normalized = user_seq.copy()
        right_hand = user_normalized[:, RIGHT_HAND_INDICES]
        mirrored_right = mirror_hand_landmarks(right_hand, is_left_to_right=False)
        user_normalized[:, LEFT_HAND_INDICES] = mirrored_right
        user_normalized[:, RIGHT_HAND_INDICES] = 0
        return user_normalized, reference_seq, "mirror_user"

    elif (user_left and user_right) and (ref_left == ref_right):
        logger.debug("[HAND_NORM] User two-hand, reference one-hand → no normalization")
        return user_seq, reference_seq, "mismatch"

    logger.warning("[HAND_NORM] Unexpected hand configuration")
    return user_seq, reference_seq, "unknown"


def get_hand_weight_masks(sequence_shape: int = 329) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    hand_mask = np.zeros(sequence_shape, dtype=bool)
    hand_mask[LEFT_HAND_INDICES] = True
    hand_mask[RIGHT_HAND_INDICES] = True
    body_mask = ~hand_mask
    hand_weights = np.where(hand_mask, 0.75, 0.25)
    hand_weights = hand_weights / hand_weights.sum() * sequence_shape
    return hand_mask, body_mask, hand_weights


def analyze_hand_configuration(sequence: np.ndarray) -> Dict[str, any]:
    has_left, has_right = detect_active_hands(sequence)
    left_active, right_active = detect_hand_activity_per_frame(sequence)
    left_frames = np.sum(left_active)
    right_frames = np.sum(right_active)

    if has_left and has_right:
        hand_type = "both"
        if left_frames > right_frames:
            dominant = "left"
        elif right_frames > left_frames:
            dominant = "right"
        else:
            dominant = "balanced"
    elif has_left:
        hand_type = "left"
        dominant = "left"
    elif has_right:
        hand_type = "right"
        dominant = "right"
    else:
        hand_type = "none"
        dominant = "none"

    return {
        "has_left": has_left,
        "has_right": has_right,
        "hand_type": hand_type,
        "left_active_frames": int(left_frames),
        "right_active_frames": int(right_frames),
        "dominant_hand": dominant,
    }