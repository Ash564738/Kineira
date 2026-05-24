# api/services/scoring.py
import logging
import numpy as np
from typing import Dict, Optional

from ml.hand_utils import LEFT_HAND_INDICES, RIGHT_HAND_INDICES

logger = logging.getLogger(__name__)


def compute_cosine_similarity(seq1: np.ndarray, seq2: np.ndarray) -> float:
    if seq1.shape != seq2.shape:
        min_len = min(len(seq1), len(seq2))
        seq1 = seq1[:min_len]
        seq2 = seq2[:min_len]

    total_sim = 0.0
    count = 0
    for f1, f2 in zip(seq1, seq2):
        f1_flat = f1.flatten()
        f2_flat = f2.flatten()
        norm1 = np.linalg.norm(f1_flat)
        norm2 = np.linalg.norm(f2_flat)
        if norm1 > 1e-6 and norm2 > 1e-6:
            total_sim += float(np.dot(f1_flat, f2_flat) / (norm1 * norm2))
            count += 1
    return total_sim / count if count > 0 else 0.0


def compute_euclidean_similarity(
    seq1: np.ndarray,
    seq2: np.ndarray,
    midpoint: float = 0.5,
    steepness: float = 0.1
) -> float:
    """
    Tính độ tương đồng dựa trên khoảng cách Euclid, dùng hàm sigmoid
    để tạo tương phản cao giữa đúng và sai.
    similarity = 1 / (1 + exp((avg_dist - midpoint) / steepness))
    """
    if seq1.shape != seq2.shape:
        min_len = min(len(seq1), len(seq2))
        seq1 = seq1[:min_len]
        seq2 = seq2[:min_len]

    total_dist = 0.0
    count = 0
    for f1, f2 in zip(seq1, seq2):
        dist = np.linalg.norm(f1.flatten() - f2.flatten())
        total_dist += dist
        count += 1

    avg_dist = total_dist / count if count > 0 else 0.0
    similarity = 1.0 / (1.0 + np.exp((avg_dist - midpoint) / steepness))
    return float(similarity)


def compute_hand_aware_score(
    user_seq: np.ndarray,
    reference_seq: np.ndarray,
    predicted_sign: Optional[str] = None,
    expected_sign: Optional[str] = None,
    active_hand: str = "both",
    hand_sim_override: Optional[float] = None
) -> Dict[str, float]:
    # Xác định chỉ số tay cần so sánh
    if active_hand == "left":
        hand_indices = list(LEFT_HAND_INDICES)
    elif active_hand == "right":
        hand_indices = list(RIGHT_HAND_INDICES)
    else:
        hand_indices = list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)

    # Tay
    if hand_sim_override is not None:
        hand_sim = hand_sim_override
    else:
        user_hand = user_seq[:, hand_indices]
        ref_hand = reference_seq[:, hand_indices]
        hand_sim = compute_euclidean_similarity(user_hand, ref_hand)

    # Pose
    user_pose = user_seq[:, 126:126+23*4]
    ref_pose = reference_seq[:, 126:126+23*4]
    pose_sim = compute_euclidean_similarity(user_pose, ref_pose)

    # Face
    user_face = user_seq[:, 126+23*4:]
    ref_face = reference_seq[:, 126+23*4:]
    face_sim = compute_euclidean_similarity(user_face, ref_face)

    base_score = hand_sim * 0.80 + pose_sim * 0.15 + face_sim * 0.05

    penalty = 1.0
    if predicted_sign and expected_sign and predicted_sign != expected_sign:
        penalty = 0.3
        logger.warning(f"[SCORING] Wrong sign ({predicted_sign} vs {expected_sign}), penalty x{penalty}")

    final_score = max(0.0, min(100.0, base_score * penalty * 100))
    return {
        "score": round(final_score, 2),
        "hand_score": round(hand_sim * 100, 2),
        "pose_score": round(pose_sim * 100, 2),
        "face_score": round(face_sim * 100, 2),
        "penalty_applied": penalty < 1.0,
        "predicted_sign": predicted_sign,
        "expected_sign": expected_sign,
    }


def generate_feedback(score: float) -> str:
    if score >= 90:
        return "Excellent! Perfect form."
    elif score >= 80:
        return "Great job! Minor adjustments needed."
    elif score >= 70:
        return "Good work! Focus on hand positions and movements."
    elif score >= 60:
        return "Getting there! Try to match the reference more closely."
    elif score >= 50:
        return "Keep practicing! Pay attention to finger positions."
    else:
        return "Keep trying! Ensure good lighting and correct hand shape."