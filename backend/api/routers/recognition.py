import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import sys
from pathlib import Path

from api.services.inference import inference_service, normalize_relative_hand
from api.services.scoring import compute_cosine_similarity, compute_hand_aware_score, generate_feedback, compute_euclidean_similarity

backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))
from ml.hand_utils import (
    detect_active_hands,
    normalize_hand_representation,
    analyze_hand_configuration,
    LEFT_HAND_INDICES,
    RIGHT_HAND_INDICES,
)

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
            confidence=result.get("confidence", 0.0)
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

    # 1. Xác định tay người dùng
    raw_user_seq = np.array(req.user_sequence, dtype=np.float32)
    has_left, has_right = detect_active_hands(raw_user_seq)
    if has_left and not has_right:
        user_hand = "left"
    elif has_right and not has_left:
        user_hand = "right"
    else:
        user_hand = "both"

    # 2. Tải reference phù hợp
    reference_seq = None
    if req.reference_sequence is not None and len(req.reference_sequence) > 0:
        reference_seq = np.array(req.reference_sequence, dtype=np.float32)
    elif req.target_sign is not None:
        ref_dir = inference_service.keras_model_path.parent
        if user_hand == "left":
            ref_path = ref_dir / f"ref_{req.target_sign}_left.npy"
        elif user_hand == "right":
            ref_path = ref_dir / f"ref_{req.target_sign}_right.npy"
        else:
            ref_path = ref_dir / f"ref_{req.target_sign}.npy"
            if not ref_path.exists():
                ref_path = ref_dir / f"ref_{req.target_sign}_right.npy"

        if not ref_path.exists():
            raise HTTPException(status_code=400, detail=f"No reference for {req.target_sign} ({user_hand} hand)")
        reference_seq = np.load(ref_path)
        logger.info(f"[SCORE] Loaded reference for {user_hand} hand: {ref_path.name}, shape={reference_seq.shape}")
    else:
        raise HTTPException(status_code=400, detail="Either reference_sequence or target_sign must be provided")

    if raw_user_seq.size == 0 or reference_seq.size == 0:
        raise HTTPException(status_code=400, detail="Sequences cannot be empty")

    # 3. Chuẩn hóa
    user_seq_rel = normalize_relative_hand(raw_user_seq)
    user_seq_norm = inference_service.normalize_sequence(user_seq_rel)
    user_normalized = user_seq_norm
    ref_normalized = reference_seq
    norm_method = "same_hand_reference"

    # 4. Dự đoán ký hiệu
    pred_result = inference_service.predict_keras(req.user_sequence)
    predicted_sign = pred_result.get("sign", "unknown")
    confidence = pred_result.get("confidence", 0.0)
    logger.info(f"[SCORE] Predicted sign: {predicted_sign} ({confidence:.2%})")

    # 5. Phân tích ngón tay (để lấy finger similarity và tính hand_sim sau)
    if user_hand == "left":
        user_hand_indices = list(LEFT_HAND_INDICES)
        ref_hand_indices = list(LEFT_HAND_INDICES)
    else:
        user_hand_indices = list(RIGHT_HAND_INDICES)
        ref_hand_indices = list(RIGHT_HAND_INDICES)

    finger_feedback = {}
    if len(user_hand_indices) > 0:
        try:
            compare_hand = user_normalized[:, user_hand_indices]
            ref_compare = ref_normalized[:, ref_hand_indices]

            finger_groups = {
                "thumb": [0,1,2,3,4],
                "index": [5,6,7,8],
                "middle": [9,10,11,12],
                "ring": [13,14,15,16],
                "pinky": [17,18,19,20]
            }

            for finger, ids in finger_groups.items():
                cols = []
                for i in ids:
                    cols.extend([i*3, i*3+1, i*3+2])
                user_finger = compare_hand[:, cols]
                ref_finger = ref_compare[:, cols]

                cos_sim = compute_cosine_similarity(user_finger, ref_finger)
                euclidean_sim = compute_euclidean_similarity(user_finger, ref_finger)

                if euclidean_sim > 0.85:
                    suggestion = "Perfect"
                elif euclidean_sim > 0.7:
                    suggestion = "Good, slight adjustment"
                elif euclidean_sim > 0.5:
                    suggestion = "Needs improvement"
                else:
                    suggestion = "Significant deviation"

                finger_feedback[finger] = {
                    "similarity": round(euclidean_sim, 4),
                    "cosine_similarity": round(cos_sim, 4),
                    "suggestion": suggestion
                }
        except Exception as e:
            logger.warning(f"[SCORE] Finger details failed: {e}")

    # 6. Tính Hand similarity tổng thể dựa trên trung bình các ngón tay
    hand_sim_pct = 0.0
    if finger_feedback:
        hand_sim_pct = sum(v["similarity"] for v in finger_feedback.values()) / len(finger_feedback) * 100
    else:
        try:
            compare_hand = user_normalized[:, user_hand_indices]
            ref_compare = ref_normalized[:, ref_hand_indices]
            hand_sim_pct = float(compute_euclidean_similarity(compare_hand, ref_compare) * 100)
        except Exception as e:
            logger.warning(f"[SCORE] Hand similarity failed: {e}")

    logger.info(f"[SCORE] Hand similarity: {hand_sim_pct:.1f}%")

    # 7. Tính điểm tổng (truyền hand_sim_override)
    expected_sign = req.target_sign
    score_dict = compute_hand_aware_score(
        user_normalized, ref_normalized,
        predicted_sign=predicted_sign,
        expected_sign=expected_sign,
        active_hand=user_hand,
        hand_sim_override=hand_sim_pct / 100.0 if hand_sim_pct > 0 else None
    )
    overall_score = score_dict["score"]
    feedback = generate_feedback(overall_score)

    logger.info("SCORING PROCESS COMPLETED")

    return ScoreResponse(
        score=overall_score,
        feedback=feedback,
        accuracy=score_dict["hand_score"],
        completeness=round(min(len(user_seq_norm)/30, 1.0)*100, 2),
        timing=0.0,
        details={
            "hand_score": score_dict["hand_score"],
            "pose_score": score_dict["pose_score"],
            "face_score": score_dict["face_score"],
            "penalty_applied": score_dict["penalty_applied"],
            "normalization_method": norm_method,
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