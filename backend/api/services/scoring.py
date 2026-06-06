# api/services/scoring.py
import logging
from typing import Dict, Optional, List, Tuple

import numpy as np

from config import (
    LEFT_HAND_END,
    LEFT_HAND_INDICES,
    LEFT_HAND_START,
    N_HAND,
    RIGHT_HAND_END,
    RIGHT_HAND_INDICES,
    RIGHT_HAND_START,
    POSE_START,
    POSE_END,
    FACE_START,
    FACE_END,
)

DYNAMIC_SIGNS = {"HELLO", "LOVE", "ME", "YOU"}

logger = logging.getLogger(__name__)
EPS = 1e-6

FINGER_SPECS = {
    "thumb": {"joints": [(1, 2, 3), (2, 3, 4)], "tip": 4, "mcp": 1},
    "index": {"joints": [(5, 6, 7), (6, 7, 8)], "tip": 8, "mcp": 5},
    "middle": {"joints": [(9, 10, 11), (10, 11, 12)], "tip": 12, "mcp": 9},
    "ring": {"joints": [(13, 14, 15), (14, 15, 16)], "tip": 16, "mcp": 13},
    "pinky": {"joints": [(17, 18, 19), (18, 19, 20)], "tip": 20, "mcp": 17},
}


def mirror_user_hand(user_seq: np.ndarray, target_hand: str) -> np.ndarray:
    """
    Mirror user sequence to match target hand.
    Nếu target_hand = right thì copy left -> right và xoá left.
    Nếu target_hand = left thì copy right -> left và xoá right.
    """
    logger.debug("mirror_user_hand: input shape=%s, target_hand=%s", user_seq.shape, target_hand)
    mirrored = user_seq.copy()

    if target_hand == "right":
        left_hand = mirrored[:, LEFT_HAND_START:LEFT_HAND_END].reshape(-1, N_HAND, 3)
        mirrored_left = left_hand.copy()
        mirrored_left[..., 0] *= -1.0
        mirrored[:, RIGHT_HAND_START:RIGHT_HAND_END] = mirrored_left.reshape(-1, N_HAND * 3)
        mirrored[:, LEFT_HAND_START:LEFT_HAND_END] = 0.0
    else:
        right_hand = mirrored[:, RIGHT_HAND_START:RIGHT_HAND_END].reshape(-1, N_HAND, 3)
        mirrored_right = right_hand.copy()
        mirrored_right[..., 0] *= -1.0
        mirrored[:, LEFT_HAND_START:LEFT_HAND_END] = mirrored_right.reshape(-1, N_HAND * 3)
        mirrored[:, RIGHT_HAND_START:RIGHT_HAND_END] = 0.0

    logger.debug("mirror_user_hand: output shape=%s", mirrored.shape)
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

    ext_diff = abs(user_ext - ref_ext)
    max_ext = max(user_ext, ref_ext, EPS)
    base_ext_sim = 1.0 - ext_diff / max_ext

    if (user_ext < 0.7 and ref_ext > 1.2) or (ref_ext < 0.7 and user_ext > 1.2):
        penalty = 0.5
    else:
        penalty = 1.0

    ext_sim = float(np.clip(base_ext_sim * penalty, 0.0, 1.0))
    combined = 0.1 * curl_sim + 0.9 * ext_sim
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


def _dtw_path(seq1: np.ndarray, seq2: np.ndarray) -> List[Tuple[int, int]]:
    """
    DTW path trên các frame đã flatten.
    Trả về list các cặp (i, j).
    """
    n, m = len(seq1), len(seq2)
    if n == 0 or m == 0:
        return []

    a = seq1.reshape(n, -1).astype(np.float32)
    b = seq2.reshape(m, -1).astype(np.float32)

    cost = np.full((n + 1, m + 1), np.inf, dtype=np.float32)
    cost[0, 0] = 0.0

    for i in range(1, n + 1):
        ai = a[i - 1]
        for j in range(1, m + 1):
            d = np.linalg.norm(ai - b[j - 1])
            cost[i, j] = d + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])

    i, j = n, m
    path: List[Tuple[int, int]] = []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        step = np.argmin([cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1]])
        if step == 0:
            i -= 1
        elif step == 1:
            j -= 1
        else:
            i -= 1
            j -= 1

    while i > 0:
        path.append((i - 1, 0))
        i -= 1
    while j > 0:
        path.append((0, j - 1))
        j -= 1

    path.reverse()
    return path


def _aligned_frame_pairs(user_3d: np.ndarray, ref_3d: np.ndarray, use_dtw: bool) -> List[Tuple[int, int]]:
    T1, T2 = len(user_3d), len(ref_3d)
    if T1 == 0 or T2 == 0:
        return []

    if use_dtw:
        return _dtw_path(user_3d, ref_3d)

    T = min(T1, T2)
    return [(t, t) for t in range(T)]


def _hand_similarity_single_block(
    user_block: np.ndarray,
    ref_block: np.ndarray,
    n_hand: int,
    use_dtw: bool = False,
) -> float:
    user_3d = _reshape_hand_block(user_block, n_hand)
    ref_3d = _reshape_hand_block(ref_block, n_hand)

    pairs = _aligned_frame_pairs(user_3d, ref_3d, use_dtw=use_dtw)
    if not pairs:
        return 0.0

    finger_names = ["thumb", "index", "middle", "ring", "pinky"]
    scores = []

    for ui, ri in pairs:
        for finger_name in finger_names:
            per = _finger_similarity(user_3d[ui], ref_3d[ri], finger_name)
            scores.append(per["similarity"])

    sim = float(np.mean(scores)) if scores else 0.0
    return sim


def compute_handshape_similarity(
    user_hand: np.ndarray,
    ref_hand: np.ndarray,
    n_hand: int,
    use_dtw: bool = False,
) -> float:
    user_blocks = _split_hand_blocks(user_hand, n_hand)
    ref_blocks = _split_hand_blocks(ref_hand, n_hand)

    if len(user_blocks) == 0 or len(ref_blocks) == 0:
        return 0.0

    n_pairs = min(len(user_blocks), len(ref_blocks))
    block_sims = [
        _hand_similarity_single_block(user_blocks[i], ref_blocks[i], n_hand, use_dtw=use_dtw)
        for i in range(n_pairs)
    ]

    similarity = float(np.mean(block_sims)) if block_sims else 0.0

    if len(user_blocks) != len(ref_blocks):
        penalty_factor = min(len(user_blocks), len(ref_blocks)) / max(len(user_blocks), len(ref_blocks))
        similarity *= penalty_factor

    return float(np.clip(similarity, 0.0, 1.0))


def compute_finger_details(
    user_hand: np.ndarray,
    ref_hand: np.ndarray,
    n_hand: int,
    use_dtw: bool = False,
) -> dict:
    """
    Detail theo từng ngón.
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
        user_3d = _reshape_hand_block(user_blocks[i], n_hand)
        ref_3d = _reshape_hand_block(ref_blocks[i], n_hand)

        pairs = _aligned_frame_pairs(user_3d, ref_3d, use_dtw=use_dtw)
        if not pairs:
            continue

        for finger_name in finger_names:
            per_frame_vals = []
            curl_vals = []
            ext_vals = []
            user_curls = []
            ref_curls = []
            user_exts = []
            ref_exts = []

            for ui, ri in pairs:
                per = _finger_similarity(user_3d[ui], ref_3d[ri], finger_name)
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
        if norm1 > EPS and norm2 > EPS:
            total_sim += float(np.dot(f1_flat, f2_flat) / (norm1 * norm2))
            count += 1

    return total_sim / count if count > 0 else 0.0


def compute_euclidean_similarity(
    seq1: np.ndarray,
    seq2: np.ndarray,
    midpoint: float = 0.8,
    steepness: float = 0.1,
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


def compute_embedding_similarity(user_emb: np.ndarray, ref_emb: np.ndarray) -> float:
    norm_user = np.linalg.norm(user_emb)
    norm_ref = np.linalg.norm(ref_emb)
    if norm_user < EPS or norm_ref < EPS:
        logger.warning("Embedding norm too small: user=%.6f, ref=%.6f", norm_user, norm_ref)
        return 0.0

    cos_sim = np.dot(user_emb, ref_emb) / (norm_user * norm_ref)
    return float(np.clip((cos_sim + 1.0) / 2.0, 0.0, 1.0))


def _extract_pose(seq: np.ndarray) -> np.ndarray:
    if POSE_END is not None:
        return seq[:, POSE_START:POSE_END]
    return seq[:, 126:126 + 23 * 4]


def _extract_face(seq: np.ndarray) -> np.ndarray:
    if FACE_END is not None:
        return seq[:, FACE_START:FACE_END]
    return seq[:, 126 + 23 * 4:]


def compute_hand_aware_score(
    user_seq: np.ndarray,
    reference_seq: np.ndarray,
    predicted_sign: Optional[str] = None,
    expected_sign: Optional[str] = None,
    active_hand: str = "both",
    hand_sim_override: Optional[float] = None,
    embedding_sim: Optional[float] = None,
    confidence: float = 0.0,
    is_dynamic: bool = False,
) -> Dict[str, float]:
    """
    Chấm điểm tổng hợp.

    Với sign động:
    - ưu tiên embedding
    - hand similarity được giữ vai trò kiểm tra quỹ đạo
    - penalty sai sign thấp hơn static để tránh tụt quá mạnh
    """
    user_pose = _extract_pose(user_seq)
    ref_pose = _extract_pose(reference_seq)

    min_pose_len = min(len(user_pose), len(ref_pose))
    user_pose = user_pose[:min_pose_len]
    ref_pose = ref_pose[:min_pose_len]

    pose_sim = compute_cosine_similarity(user_pose, ref_pose)

    user_face = _extract_face(user_seq)
    ref_face = _extract_face(reference_seq)
    min_face_len = min(len(user_face), len(ref_face))
    user_face = user_face[:min_face_len]
    ref_face = ref_face[:min_face_len]
    face_sim = compute_euclidean_similarity(user_face, ref_face, midpoint=1.5, steepness=0.15)

    if hand_sim_override is not None:
        hand_sim = float(hand_sim_override)
    else:
        if active_hand == "left":
            hand_indices = list(LEFT_HAND_INDICES)
        elif active_hand == "right":
            hand_indices = list(RIGHT_HAND_INDICES)
        else:
            hand_indices = list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)

        user_hand = user_seq[:, hand_indices]
        ref_hand = reference_seq[:, hand_indices]
        hand_sim = compute_handshape_similarity(user_hand, ref_hand, N_HAND, use_dtw=is_dynamic)

    if embedding_sim is not None:
        if is_dynamic:
            # Dynamic sign: embedding giữ vai trò chính, hand là điều kiện phụ
            main_sim = 0.65 * embedding_sim + 0.35 * hand_sim
        else:
            if hand_sim > 0.7:
                main_sim = 0.45 * embedding_sim + 0.55 * hand_sim
            else:
                main_sim = 0.25 * embedding_sim + 0.75 * hand_sim
    else:
        main_sim = hand_sim

    is_correct = (predicted_sign == expected_sign) and (expected_sign is not None)
    if is_correct and confidence > 0:
        bonus_cap = 0.05 if is_dynamic else 0.10
        bonus = min(confidence * bonus_cap, 1.0 - main_sim) if main_sim < 1.0 else 0.0
        main_sim = min(1.0, main_sim + bonus)

    penalty = 1.0
    if predicted_sign and expected_sign and predicted_sign != expected_sign:
        penalty = 0.55 if is_dynamic else 0.30

    final_score = max(0.0, min(100.0, main_sim * penalty * 100.0))

    return {
        "score": round(final_score, 2),
        "hand_score": round(hand_sim * 100.0, 2),
        "pose_score": round(pose_sim * 100.0, 2),
        "face_score": round(face_sim * 100.0, 2),
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