# ml/hand_utils.py

import logging
import numpy as np
from typing import Tuple, Dict, Any

from config import (
    N_HAND,
    LEFT_HAND_START,
    LEFT_HAND_END,
    RIGHT_HAND_START,
    RIGHT_HAND_END,
    FEATURE_SIZE,
    LEFT_HAND_INDICES,
    RIGHT_HAND_INDICES,
    BODY_INDICES,
)

logger = logging.getLogger(__name__)

_EPS = 1e-6


def _hand_presence_score(hand_slice: np.ndarray) -> float:
    if hand_slice.size == 0:
        return 0.0

    flat = hand_slice.reshape(hand_slice.shape[0], -1)

    per_frame_nonzero = np.count_nonzero(np.abs(flat) > _EPS, axis=1)
    min_landmarks_per_frame = max(6, int(flat.shape[1] * 0.15))
    active_frame_ratio = float(np.mean(per_frame_nonzero >= min_landmarks_per_frame))

    mean_abs = float(np.mean(np.abs(flat)))
    intensity_score = float(np.clip(mean_abs / 0.03, 0.0, 1.0))

    if flat.shape[0] >= 2:
        motion = float(np.mean(np.abs(np.diff(flat, axis=0))))
        motion_score = float(np.clip(motion / 0.01, 0.0, 1.0))
    else:
        motion_score = 0.0

    score = 0.65 * active_frame_ratio + 0.25 * intensity_score + 0.10 * motion_score
    return float(np.clip(score, 0.0, 1.0))


def detect_active_hands(sequence: np.ndarray) -> Tuple[bool, bool]:
    if sequence.ndim != 2 or sequence.shape[1] < max(RIGHT_HAND_END, LEFT_HAND_END):
        raise ValueError(f"Invalid sequence shape for hand detection: {sequence.shape}")

    left_slice = sequence[:, LEFT_HAND_START:LEFT_HAND_END]
    right_slice = sequence[:, RIGHT_HAND_START:RIGHT_HAND_END]

    left_score = _hand_presence_score(left_slice)
    right_score = _hand_presence_score(right_slice)

    has_left = left_score >= 0.35
    has_right = right_score >= 0.35

    logger.debug(
        "[HAND_DETECT] left=%s (%.3f), right=%s (%.3f)",
        has_left, left_score, has_right, right_score
    )
    return has_left, has_right


def detect_hand_activity_per_frame(sequence: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    left_data = sequence[:, LEFT_HAND_INDICES]
    right_data = sequence[:, RIGHT_HAND_INDICES]
    left_active = np.any(np.abs(left_data) > _EPS, axis=1)
    right_active = np.any(np.abs(right_data) > _EPS, axis=1)
    return left_active, right_active


def mirror_hand_landmarks(hand_data: np.ndarray, is_left_to_right: bool = True) -> np.ndarray:
    """
    Mirror theo trục X. is_left_to_right chỉ mang ý nghĩa ngữ nghĩa,
    thao tác thực tế là đảo trục X của toàn bộ hand landmarks.
    """
    mirrored = hand_data.copy()

    if mirrored.ndim == 2:
        if mirrored.shape[1] % 3 != 0:
            raise ValueError(f"Invalid hand_data shape: {mirrored.shape}")
        original_shape = mirrored.shape
        mirrored = mirrored.reshape(-1, N_HAND, 3)
        mirrored[..., 0] *= -1.0
        return mirrored.reshape(original_shape)

    if mirrored.ndim == 3:
        if mirrored.shape[-1] != 3:
            raise ValueError(f"Invalid hand_data shape: {mirrored.shape}")
        mirrored[..., 0] *= -1.0
        return mirrored

    raise ValueError(f"Unsupported hand_data ndim: {mirrored.ndim}")


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
            return np.zeros((sequence.shape[0], N_HAND * 3), dtype=sequence.dtype)
    else:
        raise ValueError(f"Unknown hand_type: {hand_type}")


def extract_body_features(sequence: np.ndarray) -> np.ndarray:
    return sequence[:, BODY_INDICES]


def normalize_hand_representation(
    user_seq: np.ndarray,
    reference_seq: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, str]:
    """
    Chuẩn hóa handedness giữa user và reference.
    Nếu user/ref lệch trái-phải thì mirror user để khớp reference.
    """
    user_left, user_right = detect_active_hands(user_seq)
    ref_left, ref_right = detect_active_hands(reference_seq)

    logger.debug(f"[HAND_NORM] User hands: left={user_left}, right={user_right}")
    logger.debug(f"[HAND_NORM] Reference hands: left={ref_left}, right={ref_right}")

    if user_left and ref_left:
        return user_seq, reference_seq, "same_left"
    if user_right and ref_right:
        return user_seq, reference_seq, "same_right"

    if user_left and ref_right:
        user_normalized = user_seq.copy()
        left_hand = user_normalized[:, LEFT_HAND_INDICES]
        mirrored_left = mirror_hand_landmarks(left_hand, is_left_to_right=True)
        user_normalized[:, RIGHT_HAND_INDICES] = mirrored_left
        user_normalized[:, LEFT_HAND_INDICES] = 0
        return user_normalized, reference_seq, "mirror_user_left_to_right"

    if user_right and ref_left:
        user_normalized = user_seq.copy()
        right_hand = user_normalized[:, RIGHT_HAND_INDICES]
        mirrored_right = mirror_hand_landmarks(right_hand, is_left_to_right=False)
        user_normalized[:, LEFT_HAND_INDICES] = mirrored_right
        user_normalized[:, RIGHT_HAND_INDICES] = 0
        return user_normalized, reference_seq, "mirror_user_right_to_left"

    if (user_left and user_right) and (ref_left and ref_right):
        return user_seq, reference_seq, "both"
    if (user_left and user_right) and (ref_left or ref_right):
        return user_seq, reference_seq, "mismatch_user_both_ref_one"
    if (ref_left and ref_right) and (user_left or user_right):
        return user_seq, reference_seq, "mismatch_user_one_ref_both"

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


def analyze_hand_configuration(sequence: np.ndarray) -> Dict[str, Any]:
    has_left, has_right = detect_active_hands(sequence)
    left_active, right_active = detect_hand_activity_per_frame(sequence)

    left_frames = int(np.sum(left_active))
    right_frames = int(np.sum(right_active))

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
        "left_active_frames": left_frames,
        "right_active_frames": right_frames,
        "dominant_hand": dominant,
    }