from typing import Dict

import numpy as np
from scipy.spatial.distance import cdist


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


def compute_dtw_distance(seq1: np.ndarray, seq2: np.ndarray) -> float:
    n, m = len(seq1), len(seq2)
    s1 = seq1.reshape(n, -1)
    s2 = seq2.reshape(m, -1)
    dist_matrix = cdist(s1, s2, metric="euclidean")

    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = dist_matrix[i - 1, j - 1]
            dtw[i, j] = cost + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])
    path_length = n + m
    return float(dtw[n, m] / path_length) if path_length > 0 else 1.0


def compute_transformer_similarity(seq1: np.ndarray, seq2: np.ndarray) -> float:
    if len(seq1) < 2 or len(seq2) < 2:
        return compute_cosine_similarity(seq1, seq2)
    vel1 = seq1[1:] - seq1[:-1]
    vel2 = seq2[1:] - seq2[:-1]
    vel_sim = compute_cosine_similarity(vel1, vel2)
    static_sim = compute_cosine_similarity(seq1, seq2)
    return static_sim * 0.6 + vel_sim * 0.4


def compute_overall_score(user_seq: np.ndarray, reference_seq: np.ndarray) -> Dict[str, float]:
    cosine_sim = compute_cosine_similarity(user_seq, reference_seq)
    dtw_dist = compute_dtw_distance(user_seq, reference_seq)
    transformer_sim = compute_transformer_similarity(user_seq, reference_seq)
    dtw_sim = 1.0 / (1.0 + dtw_dist)
    overall = cosine_sim * 0.4 + dtw_sim * 0.35 + transformer_sim * 0.25
    score = max(0, min(100, overall * 100))
    return {
        "score": round(score, 2),
        "cosine_similarity": round(cosine_sim, 4),
        "dtw_similarity": round(dtw_sim, 4),
        "transformer_similarity": round(transformer_sim, 4),
        "accuracy": round(cosine_sim * 100, 2),
        "completeness": round(min(len(user_seq) / 30, 1.0) * 100, 2),
        "timing": round(transformer_sim * 100, 2),
    }


def generate_feedback(score: float) -> str:
    if score >= 90:
        return "Excellent! Perfect form. Keep up the great work!"
    if score >= 80:
        return "Great job! Minor adjustments needed for perfection."
    if score >= 70:
        return "Good work! Focus on hand positions and movements."
    if score >= 60:
        return "Getting there! Try to match the reference more closely."
    if score >= 50:
        return "Keep practicing! Pay attention to finger positions."
    if score >= 40:
        return "Try again! Make sure your hand is visible and steady."
    return "Keep trying! Ensure good lighting and camera angle."
