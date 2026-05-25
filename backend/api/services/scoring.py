# api/services/scoring.py
import logging
import numpy as np
from typing import Dict, Optional, List

from config import (
    LEFT_HAND_END,
    LEFT_HAND_INDICES,
    LEFT_HAND_START,
    N_HAND,
    RIGHT_HAND_END,
    RIGHT_HAND_INDICES,
    RIGHT_HAND_START,
)

logger = logging.getLogger(__name__)

EPS = 1e-6

FINGER_SPECS = {
    "thumb": {
        "joints": [(0, 1, 2), (1, 2, 3), (2, 3, 4)],
        "tip": 4,
        "mcp": 1,
    },
    "index": {
        "joints": [(0, 5, 6), (5, 6, 7), (6, 7, 8)],
        "tip": 8,
        "mcp": 5,
    },
    "middle": {
        "joints": [(0, 9, 10), (9, 10, 11), (10, 11, 12)],
        "tip": 12,
        "mcp": 9,
    },
    "ring": {
        "joints": [(0, 13, 14), (13, 14, 15), (14, 15, 16)],
        "tip": 16,
        "mcp": 13,
    },
    "pinky": {
        "joints": [(0, 17, 18), (17, 18, 19), (18, 19, 20)],
        "tip": 20,
        "mcp": 17,
    },
}


def mirror_user_hand(user_seq: np.ndarray, target_hand: str) -> np.ndarray:
    """
    Mirror tay người dùng từ trái sang phải hoặc ngược lại.
    user_seq phải là sequence đã normalize_relative_hand.
    target_hand: 'left' hoặc 'right' - tay mà reference sử dụng.
    """
    mirrored = user_seq.copy()

    if target_hand == "right":
        left_hand = mirrored[:, LEFT_HAND_START:LEFT_HAND_END].reshape(-1, N_HAND, 3)
        mirrored_left = left_hand.copy()
        mirrored_left[..., 0] *= -1.0
        mirrored[:, RIGHT_HAND_START:RIGHT_HAND_END] = mirrored_left.reshape(-1, N_HAND * 3)
        mirrored[:, LEFT_HAND_START:LEFT_HAND_END] = 0
    else:
        right_hand = mirrored[:, RIGHT_HAND_START:RIGHT_HAND_END].reshape(-1, N_HAND, 3)
        mirrored_right = right_hand.copy()
        mirrored_right[..., 0] *= -1.0
        mirrored[:, LEFT_HAND_START:LEFT_HAND_END] = mirrored_right.reshape(-1, N_HAND * 3)
        mirrored[:, RIGHT_HAND_START:RIGHT_HAND_END] = 0

    return mirrored


def _split_hand_blocks(hand_arr: np.ndarray, n_hand: int) -> List[np.ndarray]:
    flat = hand_arr.reshape(hand_arr.shape[0], -1)
    block_size = n_hand * 3
    if flat.shape[1] % block_size != 0:
        raise ValueError(f"Hand array length {flat.shape[1]} is not divisible by {block_size}")
    n_blocks = flat.shape[1] // block_size
    return [flat[:, i * block_size:(i + 1) * block_size] for i in range(n_blocks)]


def _reshape_hand_block(hand_block: np.ndarray, n_hand: int) -> np.ndarray:
    return hand_block.reshape(hand_block.shape[0], n_hand, 3)


def _joint_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    v1 = p1 - p2
    v2 = p3 - p2
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)

    if n1 < EPS or n2 < EPS:
        return float(np.pi)

    cos_val = float(np.dot(v1, v2) / (n1 * n2))
    cos_val = float(np.clip(cos_val, -1.0, 1.0))
    return float(np.arccos(cos_val))


def _hand_palm_scale(hand_3d: np.ndarray) -> float:
    # Scale ổn định cho normalization tương đối
    candidates = [
        np.linalg.norm(hand_3d[5] - hand_3d[0]),
        np.linalg.norm(hand_3d[9] - hand_3d[0]),
        np.linalg.norm(hand_3d[13] - hand_3d[0]),
        np.linalg.norm(hand_3d[17] - hand_3d[0]),
    ]
    scale = float(np.mean(candidates))
    return scale if scale > EPS else 1.0


def _finger_curl(hand_3d: np.ndarray, finger_name: str) -> float:
    joints = FINGER_SPECS[finger_name]["joints"]
    angles = []
    for a, b, c in joints:
        angles.append(_joint_angle(hand_3d[a], hand_3d[b], hand_3d[c]))

    # 0.0 = mở thẳng, 1.0 = gập nhiều
    curl = 1.0 - (np.mean(angles) / np.pi)
    return float(np.clip(curl, 0.0, 1.0))


def _finger_extension_ratio(hand_3d: np.ndarray, finger_name: str) -> float:
    tip = FINGER_SPECS[finger_name]["tip"]
    scale = _hand_palm_scale(hand_3d)
    tip_dist = float(np.linalg.norm(hand_3d[tip] - hand_3d[0]))
    return tip_dist / scale


def _finger_similarity(user_3d: np.ndarray, ref_3d: np.ndarray, finger_name: str) -> Dict[str, float]:
    user_curl = _finger_curl(user_3d, finger_name)
    ref_curl = _finger_curl(ref_3d, finger_name)
    curl_sim = max(0.0, 1.0 - abs(user_curl - ref_curl))

    user_ext = _finger_extension_ratio(user_3d, finger_name)
    ref_ext = _finger_extension_ratio(ref_3d, finger_name)
    ext_sim = 1.0 - abs(user_ext - ref_ext) / max(user_ext, ref_ext, EPS)
    ext_sim = float(np.clip(ext_sim, 0.0, 1.0))

    combined = 0.85 * curl_sim + 0.15 * ext_sim
    combined = float(np.clip(combined, 0.0, 1.0))

    if combined >= 0.9:
        suggestion = "Perfect"
    elif combined >= 0.75:
        suggestion = "Good, slight adjustment"
    elif combined >= 0.55:
        suggestion = "Needs improvement"
    else:
        suggestion = "Significant deviation"

    return {
        "similarity": combined,
        "curl_similarity": float(curl_sim),
        "extension_similarity": float(ext_sim),
        "user_curl": float(user_curl),
        "ref_curl": float(ref_curl),
        "user_extension": float(user_ext),
        "ref_extension": float(ref_ext),
        "suggestion": suggestion,
    }


def _hand_similarity_single_block(user_block: np.ndarray, ref_block: np.ndarray, n_hand: int) -> float:
    T = min(user_block.shape[0], ref_block.shape[0])
    user_3d = _reshape_hand_block(user_block[:T], n_hand)
    ref_3d = _reshape_hand_block(ref_block[:T], n_hand)

    finger_names = ["thumb", "index", "middle", "ring", "pinky"]
    scores = []

    for t in range(T):
        for finger_name in finger_names:
            per = _finger_similarity(user_3d[t], ref_3d[t], finger_name)
            scores.append(per["similarity"])

    return float(np.mean(scores)) if scores else 0.0


def compute_handshape_similarity(user_hand: np.ndarray, ref_hand: np.ndarray, n_hand: int) -> float:
    """
    Similarity dựa trên handshape thực:
    - curl của từng ngón
    - độ duỗi tương đối của từng ngón
    Hỗ trợ 1 tay hoặc 2 tay (block-by-block).
    """
    user_blocks = _split_hand_blocks(user_hand, n_hand)
    ref_blocks = _split_hand_blocks(ref_hand, n_hand)

    if len(user_blocks) == 0 or len(ref_blocks) == 0:
        return 0.0

    n_pairs = min(len(user_blocks), len(ref_blocks))
    block_sims = [
        _hand_similarity_single_block(user_blocks[i], ref_blocks[i], n_hand)
        for i in range(n_pairs)
    ]

    similarity = float(np.mean(block_sims)) if block_sims else 0.0

    # Phạt nếu số bàn tay không khớp
    if len(user_blocks) != len(ref_blocks):
        similarity *= min(len(user_blocks), len(ref_blocks)) / max(len(user_blocks), len(ref_blocks))

    return float(np.clip(similarity, 0.0, 1.0))


def compute_finger_details(user_hand: np.ndarray, ref_hand: np.ndarray, n_hand: int) -> dict:
    """
    Trả về detail theo từng ngón.
    Nếu có 2 hand blocks, gộp trung bình theo từng ngón tương ứng.
    """
    user_blocks = _split_hand_blocks(user_hand, n_hand)
    ref_blocks = _split_hand_blocks(ref_hand, n_hand)
    n_pairs = min(len(user_blocks), len(ref_blocks))

    finger_names = ["thumb", "index", "middle", "ring", "pinky"]
    aggregate = {
        name: {
            "similarity": [],
            "curl_similarity": [],
            "extension_similarity": [],
            "user_curl": [],
            "ref_curl": [],
            "user_extension": [],
            "ref_extension": [],
        }
        for name in finger_names
    }

    for i in range(n_pairs):
        T = min(user_blocks[i].shape[0], ref_blocks[i].shape[0])
        user_3d = _reshape_hand_block(user_blocks[i][:T], n_hand)
        ref_3d = _reshape_hand_block(ref_blocks[i][:T], n_hand)

        for finger_name in finger_names:
            per_frame_vals = []
            curl_vals = []
            ext_vals = []
            user_curls = []
            ref_curls = []
            user_exts = []
            ref_exts = []

            for t in range(T):
                per = _finger_similarity(user_3d[t], ref_3d[t], finger_name)
                per_frame_vals.append(per["similarity"])
                curl_vals.append(per["curl_similarity"])
                ext_vals.append(per["extension_similarity"])
                user_curls.append(per["user_curl"])
                ref_curls.append(per["ref_curl"])
                user_exts.append(per["user_extension"])
                ref_exts.append(per["ref_extension"])

            aggregate[finger_name]["similarity"].append(float(np.mean(per_frame_vals)))
            aggregate[finger_name]["curl_similarity"].append(float(np.mean(curl_vals)))
            aggregate[finger_name]["extension_similarity"].append(float(np.mean(ext_vals)))
            aggregate[finger_name]["user_curl"].append(float(np.mean(user_curls)))
            aggregate[finger_name]["ref_curl"].append(float(np.mean(ref_curls)))
            aggregate[finger_name]["user_extension"].append(float(np.mean(user_exts)))
            aggregate[finger_name]["ref_extension"].append(float(np.mean(ref_exts)))

    details = {}
    for finger_name in finger_names:
        sim = float(np.mean(aggregate[finger_name]["similarity"])) if aggregate[finger_name]["similarity"] else 0.0
        curl_sim = float(np.mean(aggregate[finger_name]["curl_similarity"])) if aggregate[finger_name]["curl_similarity"] else 0.0
        ext_sim = float(np.mean(aggregate[finger_name]["extension_similarity"])) if aggregate[finger_name]["extension_similarity"] else 0.0

        if sim >= 0.9:
            suggestion = "Perfect"
        elif sim >= 0.75:
            suggestion = "Good, slight adjustment"
        elif sim >= 0.55:
            suggestion = "Needs improvement"
        else:
            suggestion = "Significant deviation"

        details[finger_name] = {
            "similarity": round(sim, 4),
            "curl_similarity": round(curl_sim, 4),
            "extension_similarity": round(ext_sim, 4),
            "user_curl": round(float(np.mean(aggregate[finger_name]["user_curl"])), 4) if aggregate[finger_name]["user_curl"] else 0.0,
            "ref_curl": round(float(np.mean(aggregate[finger_name]["ref_curl"])), 4) if aggregate[finger_name]["ref_curl"] else 0.0,
            "user_extension": round(float(np.mean(aggregate[finger_name]["user_extension"])), 4) if aggregate[finger_name]["user_extension"] else 0.0,
            "ref_extension": round(float(np.mean(aggregate[finger_name]["ref_extension"])), 4) if aggregate[finger_name]["ref_extension"] else 0.0,
            "suggestion": suggestion,
        }

    return details


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
    midpoint: float = 0.8,
    steepness: float = 0.1
) -> float:
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
    if active_hand == "left":
        hand_indices = list(LEFT_HAND_INDICES)
    elif active_hand == "right":
        hand_indices = list(RIGHT_HAND_INDICES)
    else:
        hand_indices = list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)

    if hand_sim_override is not None:
        hand_sim = float(hand_sim_override)
    else:
        user_hand = user_seq[:, hand_indices]
        ref_hand = reference_seq[:, hand_indices]
        hand_sim = compute_euclidean_similarity(user_hand, ref_hand)

    user_pose = user_seq[:, 126:126 + 23 * 4]
    ref_pose = reference_seq[:, 126:126 + 23 * 4]
    pose_sim = compute_euclidean_similarity(user_pose, ref_pose)

    user_face = user_seq[:, 126 + 23 * 4:]
    ref_face = reference_seq[:, 126 + 23 * 4:]
    face_sim = compute_euclidean_similarity(user_face, ref_face)

    # Handshape phải là thành phần chính
    base_score = hand_sim * 0.90 + pose_sim * 0.07 + face_sim * 0.03

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