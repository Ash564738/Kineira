from typing import Dict, List

Point = List[float]
Frame = Dict[str, List[Point]]


def _mirror_x(points: List[Point]) -> List[Point]:
    mirrored: List[Point] = []
    for p in points:
        if len(p) >= 3:
            mirrored.append([1.0 - float(p[0]), float(p[1]), float(p[2])])
    return mirrored


def _hand_activity(points: List[Point]) -> float:
    if len(points) < 2:
        return 0.0

    wrist = points[0]
    if len(wrist) < 3:
        return 0.0

    score = 0.0
    for p in points[1:]:
        if len(p) < 3:
            continue
        dx = float(p[0]) - float(wrist[0])
        dy = float(p[1]) - float(wrist[1])
        dz = float(p[2]) - float(wrist[2])
        score += (dx * dx + dy * dy + dz * dz) ** 0.5
    return score


def canonicalize_frame(frame: Frame) -> Frame:
    left = frame.get("left_hand", []) or []
    right = frame.get("right_hand", []) or []
    pose = frame.get("pose", []) or []
    face = frame.get("face", []) or []

    left_score = _hand_activity(left)
    right_score = _hand_activity(right)

    should_mirror = False
    if left and not right:
        should_mirror = True
    elif left and right and left_score > right_score:
        should_mirror = True

    if not should_mirror:
        return {
            "left_hand": left,
            "right_hand": right,
            "pose": pose,
            "face": face,
        }

    return {
        "left_hand": _mirror_x(right),
        "right_hand": _mirror_x(left),
        "pose": _mirror_x(pose),
        "face": _mirror_x(face),
    }
