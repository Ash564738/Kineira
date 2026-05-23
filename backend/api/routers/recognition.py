import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from api.services.inference import inference_service
from api.services.scoring import compute_overall_score, generate_feedback
import numpy as np

logger = logging.getLogger(__name__)
router = APIRouter()

class TranslateRequest(BaseModel):
    keypoints_sequence: List[List[float]]

class TranslateResponse(BaseModel):
    sign: str
    confidence: float

class ScoreRequest(BaseModel):
    user_sequence: List[List[float]]
    reference_sequence: List[List[float]]

class ScoreResponse(BaseModel):
    score: float
    feedback: str
    accuracy: float
    completeness: float
    timing: float
    details: Dict[str, Any]

@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    logger.info("=" * 80)
    logger.info("TRANSLATE PROCESS STARTED")
    logger.info("=" * 80)
    logger.info(f"[TRANSLATE_ENDPOINT] Received translate request")
    logger.debug(f"[TRANSLATE_ENDPOINT] Input sequence shape: {len(req.keypoints_sequence)} frames, {len(req.keypoints_sequence[0]) if req.keypoints_sequence else 0} dimensions")
    
    try:
        logger.info("[TRANSLATE_ENDPOINT] Calling inference_service.predict_keras()...")
        result = inference_service.predict_keras(req.keypoints_sequence)
        logger.debug(f"[TRANSLATE_ENDPOINT] Inference result: {result}")
        
        response = TranslateResponse(
            sign=result.get("sign", "unknown"),
            confidence=result.get("confidence", 0.0)
        )
        logger.info(f"[TRANSLATE_ENDPOINT] Translate successful - sign: {response.sign}, confidence: {response.confidence}")
        logger.info("=" * 80)
        logger.info("TRANSLATE PROCESS COMPLETED")
        logger.info("=" * 80)
        return response
    except Exception as exc:
        logger.error(f"[TRANSLATE_ENDPOINT] Translate endpoint failed: {type(exc).__name__}: {str(exc)}", exc_info=True)
        logger.info("=" * 80)
        logger.info("TRANSLATE PROCESS FAILED")
        logger.info("=" * 80)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/score", response_model=ScoreResponse)
async def score(req: ScoreRequest) -> ScoreResponse:
    """Score user gesture against reference gesture with feedback and corrections."""
    logger.info("=" * 80)
    logger.info("SCORING PROCESS STARTED")
    logger.info("=" * 80)
    logger.info(f"[SCORE_ENDPOINT] Received score request")
    logger.debug(f"[SCORE_ENDPOINT] User sequence: {len(req.user_sequence)} frames, {len(req.user_sequence[0]) if req.user_sequence else 0} dimensions")
    logger.debug(f"[SCORE_ENDPOINT] Reference sequence: {len(req.reference_sequence)} frames, {len(req.reference_sequence[0]) if req.reference_sequence else 0} dimensions")
    
    try:
        user_seq = np.array(req.user_sequence, dtype=np.float32)
        reference_seq = np.array(req.reference_sequence, dtype=np.float32)
        logger.debug(f"[SCORE_ENDPOINT] Converted sequences to numpy. User shape: {user_seq.shape}, Ref shape: {reference_seq.shape}")
        
        if user_seq.size == 0 or reference_seq.size == 0:
            logger.error(f"[SCORE_ENDPOINT] Empty sequence detected - user_size: {user_seq.size}, ref_size: {reference_seq.size}")
            raise ValueError("Sequences cannot be empty")
        
        # Compute scoring metrics
        logger.info("[SCORE_ENDPOINT] Computing overall score...")
        score_result = compute_overall_score(user_seq, reference_seq)
        score_value = score_result["score"]
        logger.debug(f"[SCORE_ENDPOINT] Score computed: {score_result}")
        
        # Generate feedback with corrections
        logger.info(f"[SCORE_ENDPOINT] Generating feedback for score {score_value}...")
        feedback = generate_feedback(score_value)
        logger.debug(f"[SCORE_ENDPOINT] Feedback generated: {feedback}")
        
        response = ScoreResponse(
            score=score_value,
            feedback=feedback,
            accuracy=score_result["accuracy"],
            completeness=score_result["completeness"],
            timing=score_result["timing"],
            details={
                "cosine_similarity": score_result["cosine_similarity"],
                "dtw_similarity": score_result["dtw_similarity"],
                "transformer_similarity": score_result["transformer_similarity"],
            }
        )
        logger.info(f"[SCORE_ENDPOINT] Scoring complete - Score: {score_value}, Accuracy: {score_result['accuracy']}, Completeness: {score_result['completeness']}")
        logger.info("=" * 80)
        logger.info("SCORING PROCESS COMPLETED")
        logger.info("=" * 80)
        return response
    except Exception as exc:
        logger.error(f"[SCORE_ENDPOINT] Score endpoint failed: {type(exc).__name__}: {str(exc)}", exc_info=True)
        logger.info("=" * 80)
        logger.info("SCORING PROCESS FAILED")
        logger.info("=" * 80)
        raise HTTPException(status_code=500, detail=str(exc))