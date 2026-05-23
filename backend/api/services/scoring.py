import logging
from typing import Dict

import numpy as np
from scipy.spatial.distance import cdist

logger = logging.getLogger(__name__)

def compute_cosine_similarity(seq1: np.ndarray, seq2: np.ndarray) -> float:
    logger.debug(f"[SCORING] Computing cosine similarity - seq1 shape: {seq1.shape}, seq2 shape: {seq2.shape}")
    if seq1.shape != seq2.shape:
        min_len = min(len(seq1), len(seq2))
        seq1 = seq1[:min_len]
        seq2 = seq2[:min_len]
        logger.debug(f"[SCORING] Sequences reshaped to same length: {min_len}")

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
    result = total_sim / count if count > 0 else 0.0
    logger.debug(f"[SCORING] Cosine similarity computed: {result:.4f} from {count} frame pairs")
    return result


def compute_dtw_distance(seq1: np.ndarray, seq2: np.ndarray) -> float:
    logger.debug(f"[SCORING] Computing DTW distance - seq1 length: {len(seq1)}, seq2 length: {len(seq2)}")
    n, m = len(seq1), len(seq2)
    s1 = seq1.reshape(n, -1)
    s2 = seq2.reshape(m, -1)
    dist_matrix = cdist(s1, s2, metric="euclidean")
    logger.debug(f"[SCORING] Distance matrix shape: {dist_matrix.shape}")

    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = dist_matrix[i - 1, j - 1]
            dtw[i, j] = cost + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])
    path_length = n + m
    result = float(dtw[n, m] / path_length) if path_length > 0 else 1.0
    logger.debug(f"[SCORING] DTW distance computed: {result:.4f}")
    return result


def compute_transformer_similarity(seq1: np.ndarray, seq2: np.ndarray) -> float:
    logger.debug(f"[SCORING] Computing transformer similarity")
    if len(seq1) < 2 or len(seq2) < 2:
        logger.debug(f"[SCORING] Sequences too short for velocity computation, using cosine similarity")
        return compute_cosine_similarity(seq1, seq2)
    vel1 = seq1[1:] - seq1[:-1]
    vel2 = seq2[1:] - seq2[:-1]
    vel_sim = compute_cosine_similarity(vel1, vel2)
    static_sim = compute_cosine_similarity(seq1, seq2)
    result = static_sim * 0.6 + vel_sim * 0.4
    logger.debug(f"[SCORING] Transformer similarity: static={static_sim:.4f}, velocity={vel_sim:.4f}, combined={result:.4f}")
    return result


def compute_overall_score(user_seq: np.ndarray, reference_seq: np.ndarray) -> Dict[str, float]:
    logger.info("[SCORING] Starting overall score computation")
    logger.debug(f"[SCORING] User sequence shape: {user_seq.shape}, Reference sequence shape: {reference_seq.shape}")
    
    logger.debug("[SCORING] Computing cosine similarity...")
    cosine_sim = compute_cosine_similarity(user_seq, reference_seq)
    
    logger.debug("[SCORING] Computing DTW distance...")
    dtw_dist = compute_dtw_distance(user_seq, reference_seq)
    
    logger.debug("[SCORING] Computing transformer similarity...")
    transformer_sim = compute_transformer_similarity(user_seq, reference_seq)
    
    dtw_sim = 1.0 / (1.0 + dtw_dist)
    logger.debug(f"[SCORING] All metrics computed - cosine: {cosine_sim:.4f}, dtw_sim: {dtw_sim:.4f}, transformer: {transformer_sim:.4f}")
    
    overall = cosine_sim * 0.4 + dtw_sim * 0.35 + transformer_sim * 0.25
    score = max(0, min(100, overall * 100))
    
    accuracy = round(cosine_sim * 100, 2)
    completeness = round(min(len(user_seq) / 30, 1.0) * 100, 2)
    timing = round(transformer_sim * 100, 2)
    
    logger.info(f"[SCORING] Overall score computed: {score:.2f} (accuracy: {accuracy}%, completeness: {completeness}%, timing: {timing}%)")
    
    result = {
        "score": round(score, 2),
        "cosine_similarity": round(cosine_sim, 4),
        "dtw_similarity": round(dtw_sim, 4),
        "transformer_similarity": round(transformer_sim, 4),
        "accuracy": accuracy,
        "completeness": completeness,
        "timing": timing,
    }
    logger.debug(f"[SCORING] Result dict: {result}")
    return result


def generate_feedback(score: float) -> str:
    logger.debug(f"[SCORING] Generating feedback for score: {score}")
    if score >= 90:
        feedback = "Excellent! Perfect form. Keep up the great work!"
    elif score >= 80:
        feedback = "Great job! Minor adjustments needed for perfection."
    elif score >= 70:
        feedback = "Good work! Focus on hand positions and movements."
    elif score >= 60:
        feedback = "Getting there! Try to match the reference more closely."
    elif score >= 50:
        feedback = "Keep practicing! Pay attention to finger positions."
    elif score >= 40:
        feedback = "Try again! Make sure your hand is visible and steady."
    else:
        feedback = "Keep trying! Ensure good lighting and camera angle."
    logger.debug(f"[SCORING] Feedback generated: {feedback}")
    return feedback
