# api/routers/recognition.py
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from pathlib import Path

from api.services.inference import inference_service, normalize_relative_hand
from api.services.scoring import (
    compute_finger_details,
    compute_hand_aware_score,
    compute_handshape_similarity,
    generate_feedback,
    mirror_user_hand,
)
from config import LEFT_HAND_INDICES, N_HAND, RIGHT_HAND_INDICES
from ml.hand_utils import detect_active_hands, analyze_hand_configuration

logger = logging.getLogger(__name__)
router = APIRouter()


class TranslateRequest(BaseModel):
    keypoints_sequence: List[List[float]]


class TranslateResponse(BaseModel):
    sign: str
    confidence: float


class ScoreRequest(BaseModel):
    user_sequence: List[List[float]]
    reference_sequence: Optional[List[List[float]]] = None
    target_sign: Optional[str] = None


class ScoreResponse(BaseModel):
    score: float
    feedback: str
    accuracy: float
    completeness: float
    timing: float
    details: Dict[str, Any]
    sign: Optional[str] = None
    confidence: Optional[float] = None
    hand_similarity: Optional[float] = None
    finger_details: Optional[Dict[str, Any]] = None


def _unique_ordered(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen and item is not None:
            out.append(item)
            seen.add(item)
    return out


def _resolve_reference_path(ref_dir: Path, sign: str, preferred_hands: List[str]) -> Tuple[Optional[Path], Optional[str]]:
    for hand in _unique_ordered(preferred_hands):
        candidate = ref_dir / f"ref_{sign}_{hand}.npy"
        if candidate.exists():
            return candidate, hand
    return None, None


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    logger.info("=" * 80)
    logger.info("TRANSLATE PROCESS STARTED")
    logger.info("=" * 80)
    try:
        result = inference_service.predict_keras(req.keypoints_sequence)
        if not result.get("stable", False):
            logger.info("[TRANSLATE] Not yet stable, returning pending")
            return TranslateResponse(sign="pending", confidence=0.0)

        response = TranslateResponse(
            sign=result.get("sign", "unknown"),
            confidence=result.get("confidence", 0.0),
        )
        logger.info(f"[TRANSLATE] Successful - sign: {response.sign}, confidence: {response.confidence}")
        return response
    except Exception as exc:
        logger.error(f"[TRANSLATE] Failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        logger.info("TRANSLATE PROCESS ENDED")
        logger.info("=" * 80)


@router.post("/score", response_model=ScoreResponse)
async def score(req: ScoreRequest) -> ScoreResponse:
    logger.info("=" * 80)
    logger.info("SCORING PROCESS STARTED")
    logger.info("=" * 80)

    expected_sign = req.target_sign

    raw_user_seq = np.array(req.user_sequence, dtype=np.float32)
    if raw_user_seq.size == 0:
        raise HTTPException(status_code=400, detail="User sequence cannot be empty")

    hand_cfg = analyze_hand_configuration(raw_user_seq)
    detected_hand = hand_cfg["hand_type"]
    dominant_hand = hand_cfg["dominant_hand"]

    if detected_hand == "both":
        alignment_hand = dominant_hand if dominant_hand in ("left", "right") else "both"
    elif detected_hand in ("left", "right"):
        alignment_hand = detected_hand
    else:
        alignment_hand = "both"

    # 1) Tải reference
    reference_seq = None
    loaded_hand = None
    need_mirror = False

    if req.reference_sequence is not None and len(req.reference_sequence) > 0:
        reference_seq = np.array(req.reference_sequence, dtype=np.float32)

        ref_cfg = analyze_hand_configuration(reference_seq)
        loaded_hand = ref_cfg["hand_type"] if ref_cfg["hand_type"] in ("left", "right", "both") else "custom"
        if loaded_hand == "none":
            loaded_hand = alignment_hand if alignment_hand in ("left", "right", "both") else "both"

        logger.info(f"[SCORE] Using custom reference (hand={loaded_hand})")

    elif req.target_sign is not None:
        ref_dir = inference_service.keras_model_path.parent
        sign = req.target_sign

        if alignment_hand in ("left", "right"):
            opposite = "right" if alignment_hand == "left" else "left"
            preferred_hands = [alignment_hand, "both", opposite]
        else:
            preferred_hands = ["both", "right", "left"]

        ref_path, loaded_hand = _resolve_reference_path(ref_dir, sign, preferred_hands)

        if ref_path is None:
            raise HTTPException(status_code=400, detail=f"No reference for {sign}")

        reference_seq = np.load(ref_path).astype(np.float32)
        logger.info(f"[SCORE] Loaded reference {ref_path.name} (hand={loaded_hand})")

        if loaded_hand in ("left", "right") and alignment_hand in ("left", "right") and loaded_hand != alignment_hand:
            need_mirror = True

    else:
        raise HTTPException(status_code=400, detail="Either reference_sequence or target_sign must be provided")

    if reference_seq is None or reference_seq.size == 0:
        raise HTTPException(status_code=400, detail="Reference sequence cannot be empty")

    # 2) Chuẩn hóa user
    user_seq_rel = normalize_relative_hand(raw_user_seq)

    # 3) Mirror nếu handedness không khớp
    if need_mirror and loaded_hand in ("left", "right"):
        user_seq_rel = mirror_user_hand(user_seq_rel, target_hand=loaded_hand)

    # 4) Scale nhất quán bằng scaler đã train
    user_seq_norm = inference_service.normalize_sequence(user_seq_rel)
    user_normalized = user_seq_norm
    ref_normalized = reference_seq

    # 5) Prediction
    pred_result = inference_service.predict_keras(req.user_sequence)
    predicted_sign = pred_result.get("sign", "unknown")
    confidence = pred_result.get("confidence", 0.0)
    logger.info(f"[SCORE] Predicted sign: {predicted_sign} ({confidence:.2%})")

    # 6) Chọn hand indices theo reference đã load
    if loaded_hand == "both":
        hand_indices = list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)
        active_hand_for_score = "both"
    elif loaded_hand == "left":
        hand_indices = list(LEFT_HAND_INDICES)
        active_hand_for_score = "left"
    elif loaded_hand == "right":
        hand_indices = list(RIGHT_HAND_INDICES)
        active_hand_for_score = "right"
    else:
        # fallback
        if alignment_hand == "left":
            hand_indices = list(LEFT_HAND_INDICES)
            active_hand_for_score = "left"
        elif alignment_hand == "right":
            hand_indices = list(RIGHT_HAND_INDICES)
            active_hand_for_score = "right"
        else:
            hand_indices = list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)
            active_hand_for_score = "both"

    # 7) Handshape similarity mới: curl/extension, không dùng landmark distance thô
    hand_sim_pct = compute_handshape_similarity(
        user_normalized[:, hand_indices],
        ref_normalized[:, hand_indices],
        N_HAND
    ) * 100.0

    finger_feedback = compute_finger_details(
        user_normalized[:, hand_indices],
        ref_normalized[:, hand_indices],
        N_HAND
    )

    logger.info(f"[SCORE] Hand similarity: {hand_sim_pct:.1f}%")

    # 8) Tổng điểm
    score_dict = compute_hand_aware_score(
        user_normalized,
        ref_normalized,
        predicted_sign=predicted_sign,
        expected_sign=expected_sign,
        active_hand=active_hand_for_score,
        hand_sim_override=hand_sim_pct / 100.0 if hand_sim_pct > 0 else 0.0,
    )

    overall_score = score_dict["score"]
    feedback = generate_feedback(overall_score)

    logger.info("SCORING PROCESS COMPLETED")

    return ScoreResponse(
        score=overall_score,
        feedback=feedback,
        accuracy=score_dict["hand_score"],
        completeness=round(min(len(user_seq_norm) / 30, 1.0) * 100, 2),
        timing=0.0,
        details={
            "hand_score": score_dict["hand_score"],
            "pose_score": score_dict["pose_score"],
            "face_score": score_dict["face_score"],
            "penalty_applied": score_dict["penalty_applied"],
            "normalization_method": f"ref_{loaded_hand}",
        },
        sign=predicted_sign,
        confidence=confidence,
        hand_similarity=hand_sim_pct,
        finger_details=finger_feedback,
    )


@router.post("/translate/reset")
async def reset_translate():
    logger.info("[TRANSLATE] Resetting smoother...")
    inference_service.smoother.reset()
    return {"status": "reset"}