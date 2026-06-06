# api/routers/recognition.py
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from pathlib import Path

from api.services.inference import inference_service, normalize_relative_hand
from api.services.scoring import (
    compute_embedding_similarity,
    compute_finger_details,
    compute_hand_aware_score,
    compute_handshape_similarity,
    generate_feedback,
    mirror_user_hand,
    DYNAMIC_SIGNS,
)
from config import LEFT_HAND_INDICES, N_HAND, RIGHT_HAND_INDICES
from ml.hand_utils import analyze_hand_configuration

WORD_MAP = {"ME": "I"}
logger = logging.getLogger(__name__)
router = APIRouter()


class TranslateRequest(BaseModel):
    keypoints_sequence: List[List[float]]


class TranslateResponse(BaseModel):
    sign: str
    confidence: float
    sentence: str = ""


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
    embedding_similarity: Optional[float] = None
    pose_similarity: Optional[float] = None
    face_similarity: Optional[float] = None
    display_score: Optional[float] = None


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

        raw_sign = result.get("sign", "unknown")
        confidence = result.get("confidence", 0.0)

        mapped_sign = WORD_MAP.get(raw_sign, raw_sign)
        mapped_sentence = " ".join(
            WORD_MAP.get(word, word)
            for word in inference_service.smoother.current_sentence
        )

        if not result.get("stable", False):
            logger.info("[TRANSLATE] Not yet stable, returning pending")
            return TranslateResponse(
                sign="pending",
                confidence=0.0,
                sentence=mapped_sentence
            )

        response = TranslateResponse(
            sign=mapped_sign,
            confidence=confidence,
            sentence=mapped_sentence,
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
    is_dynamic = expected_sign in DYNAMIC_SIGNS if expected_sign else False

    raw_user_seq = np.array(req.user_sequence, dtype=np.float32)
    if raw_user_seq.size == 0:
        raise HTTPException(status_code=400, detail="User sequence cannot be empty")

    hand_cfg = analyze_hand_configuration(raw_user_seq)
    detected_hand = hand_cfg["hand_type"]
    dominant_hand = hand_cfg["dominant_hand"]

    alignment_hand = "both"
    if detected_hand == "both":
        alignment_hand = dominant_hand if dominant_hand in ("left", "right") else "both"
    elif detected_hand in ("left", "right"):
        alignment_hand = detected_hand

    reference_seq = None
    loaded_hand = None
    need_mirror = False

    if req.reference_sequence is not None and len(req.reference_sequence) > 0:
        reference_seq = np.array(req.reference_sequence, dtype=np.float32)
        reference_seq = normalize_relative_hand(reference_seq)
        reference_seq = inference_service.normalize_sequence(reference_seq)

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

    user_seq_rel = normalize_relative_hand(raw_user_seq)
    if need_mirror and loaded_hand in ("left", "right"):
        user_seq_rel = mirror_user_hand(user_seq_rel, target_hand=loaded_hand)

    user_normalized = inference_service.normalize_sequence(user_seq_rel)
    ref_normalized = reference_seq

    pred_result = inference_service.predict_keras(user_normalized, already_normalized=True)
    predicted_sign = pred_result.get("sign", "unknown")
    confidence = pred_result.get("confidence", 0.0)
    logger.info(f"[SCORE] Predicted sign: {predicted_sign} ({confidence:.2%})")

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
        if alignment_hand == "left":
            hand_indices = list(LEFT_HAND_INDICES)
            active_hand_for_score = "left"
        elif alignment_hand == "right":
            hand_indices = list(RIGHT_HAND_INDICES)
            active_hand_for_score = "right"
        else:
            hand_indices = list(LEFT_HAND_INDICES) + list(RIGHT_HAND_INDICES)
            active_hand_for_score = "both"

    user_emb = inference_service.get_embedding(user_normalized, already_normalized=True)
    emb_sim = 0.5
    if user_emb is not None:
        ref_dir = inference_service.keras_model_path.parent
        ref_emb_path = ref_dir / f"ref_{expected_sign}_{loaded_hand}_embed.npy"
        if ref_emb_path.exists():
            ref_emb = np.load(ref_emb_path)
            emb_sim = compute_embedding_similarity(user_emb, ref_emb)
            logger.info(f"[SCORE] Embedding similarity: {emb_sim:.4f}")
        else:
            logger.warning(f"[SCORE] No embedding reference for {expected_sign}_{loaded_hand}")

    hand_sim_pct = compute_handshape_similarity(
        user_normalized[:, hand_indices],
        ref_normalized[:, hand_indices],
        N_HAND,
        use_dtw=is_dynamic,
    ) * 100.0

    finger_feedback = compute_finger_details(
        user_normalized[:, hand_indices],
        ref_normalized[:, hand_indices],
        N_HAND,
        use_dtw=is_dynamic,
    )

    if is_dynamic and emb_sim is not None:
        hand_sim_display = 0.35 * hand_sim_pct + 0.65 * emb_sim * 100.0
    else:
        hand_sim_display = hand_sim_pct

    score_dict = compute_hand_aware_score(
        user_normalized,
        ref_normalized,
        predicted_sign=predicted_sign,
        expected_sign=expected_sign,
        active_hand=active_hand_for_score,
        hand_sim_override=hand_sim_display / 100.0 if hand_sim_display > 0 else 0.0,
        embedding_sim=emb_sim,
        confidence=confidence,
        is_dynamic=is_dynamic,
    )

    display_score = (
        0.5 * hand_sim_display +
        0.3 * score_dict["pose_score"] +
        0.2 * score_dict["face_score"]
    )

    overall_score = score_dict["score"]
    feedback = generate_feedback(display_score)

    logger.info("SCORING PROCESS COMPLETED")

    return ScoreResponse(
        score=overall_score,
        feedback=feedback,
        accuracy=score_dict["hand_score"],
        completeness=round(min(len(user_normalized) / 30, 1.0) * 100, 2),
        timing=0.0,
        details={
            "hand_score": score_dict["hand_score"],
            "pose_score": score_dict["pose_score"],
            "face_score": score_dict["face_score"],
            "penalty_applied": score_dict["penalty_applied"],
            "normalization_method": f"ref_{loaded_hand}",
            "embedding_similarity": emb_sim,
            "pose_similarity": score_dict["pose_score"],
            "face_similarity": score_dict["face_score"],
            "display_score": round(display_score, 2),
            "is_dynamic": is_dynamic,
        },
        sign=predicted_sign,
        confidence=confidence,
        hand_similarity=round(hand_sim_display, 2),
        embedding_similarity=emb_sim,
        finger_details=finger_feedback,
        pose_similarity=score_dict["pose_score"],
        face_similarity=score_dict["face_score"],
        display_score=round(display_score, 2),
    )


@router.post("/translate/reset")
async def reset_translate():
    logger.info("[TRANSLATE] Resetting smoother...")
    inference_service.smoother.reset()
    return {"status": "reset"}