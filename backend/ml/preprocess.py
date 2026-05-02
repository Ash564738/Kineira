from typing import Any, Dict, List, Optional

import numpy as np

from ml.orientation import canonicalize_frame

HAND_POINTS = 21
POSE_POINTS = 8
FACE_POINTS = 10

HAND_SIZE = HAND_POINTS * 3
POSE_SIZE = POSE_POINTS * 3
FACE_SIZE = FACE_POINTS * 3
INPUT_SIZE = HAND_SIZE * 2 + POSE_SIZE + FACE_SIZE

MODE_MAX_FRAMES = {
    "alphabet": 60,
    "word": 60,
    "sentence": 100,
}

FEATURE_WEIGHTS = {
    "alphabet": {"hand": 2.0, "pose": 0.2, "face": 0.1},
    "word": {"hand": 2.0, "pose": 0.5, "face": 0.2},
    "sentence": {"hand": 2.0, "pose": 0.5, "face": 0.2},
}


def normalize_hand(hand: List[List[float]]) -> np.ndarray:
    if len(hand) == 0:
        return np.zeros((HAND_POINTS, 3), dtype=np.float32)

    arr = np.array(hand, dtype=np.float32)
    wrist = arr[0]
    arr = arr - wrist
    scale = np.max(np.linalg.norm(arr, axis=1))
    if scale > 1e-6:
        arr = arr / scale
    return arr


def flatten_points(points: Any, expected_points: int) -> np.ndarray:
    arr = np.zeros((expected_points, 3), dtype=np.float32)
    if points is None:
        return arr.flatten()

    if isinstance(points, np.ndarray):
        pts = points
    else:
        pts = np.array(points, dtype=np.float32) if len(points) > 0 else np.zeros((0, 3), dtype=np.float32)

    if len(pts) > 0:
        n = min(len(pts), expected_points)
        arr[:n] = pts[:n]
    return arr.flatten()


def _extract_points(frame: Any) -> Dict[str, List[List[float]]]:
    if isinstance(frame, dict):
        return {
            "left_hand": frame.get("left_hand", []) or [],
            "right_hand": frame.get("right_hand", []) or [],
            "pose": frame.get("pose", []) or [],
            "face": frame.get("face", []) or [],
        }

    return {
        "left_hand": [[p.x, p.y, p.z] for p in frame.left_hand],
        "right_hand": [[p.x, p.y, p.z] for p in frame.right_hand],
        "pose": [[p.x, p.y, p.z] for p in frame.pose],
        "face": [[p.x, p.y, p.z] for p in frame.face],
    }


def prepare_frame(frame: Any, mode: str = "word") -> np.ndarray:
    mode_key = mode if mode in FEATURE_WEIGHTS else "word"
    weights = FEATURE_WEIGHTS[mode_key]

    raw = _extract_points(frame)
    oriented = canonicalize_frame(raw)

    left = normalize_hand(oriented["left_hand"]) if oriented["left_hand"] else np.zeros((HAND_POINTS, 3), dtype=np.float32)
    right = normalize_hand(oriented["right_hand"]) if oriented["right_hand"] else np.zeros((HAND_POINTS, 3), dtype=np.float32)
    pose = oriented["pose"]
    face = oriented["face"]

    return np.concatenate([
        flatten_points(left, HAND_POINTS) * weights["hand"],
        flatten_points(right, HAND_POINTS) * weights["hand"],
        flatten_points(pose, POSE_POINTS) * weights["pose"],
        flatten_points(face, FACE_POINTS) * weights["face"],
    ]).astype(np.float32)


def preprocess_sequence(sequence: List[Any], mode: str = "word", max_frames: Optional[int] = None) -> Optional[np.ndarray]:
    frames: List[np.ndarray] = []
    for frame in sequence:
        try:
            frames.append(prepare_frame(frame, mode=mode))
        except Exception:
            continue

    if len(frames) == 0:
        return None

    target_frames = max_frames or MODE_MAX_FRAMES.get(mode, 60)
    if len(frames) > target_frames:
        idx = np.linspace(0, len(frames) - 1, target_frames).astype(int)
        frames = [frames[i] for i in idx]
    else:
        while len(frames) < target_frames:
            frames.append(frames[-1].copy())

    return np.array(frames, dtype=np.float32)
