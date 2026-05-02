import logging

from fastapi import APIRouter, HTTPException

from api.schemas.common import ScoringRequest, ScoringResponse, SignRecognitionRequest, SignRecognitionResponse
from api.services.inference import inference_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/recognize-sign", response_model=SignRecognitionResponse)
async def recognize(req: SignRecognitionRequest) -> SignRecognitionResponse:
    try:
        result = inference_service.recognize(req.landmarks_sequence, mode=req.mode or "word")
        return SignRecognitionResponse(**result)
    except Exception as exc:
        logger.exception("recognize endpoint failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/score-sign", response_model=ScoringResponse)
async def score(req: ScoringRequest) -> ScoringResponse:
    try:
        result = inference_service.score(
            landmarks_sequence=req.landmarks_sequence,
            reference_sign=req.reference_sign,
            mode=req.mode or "word",
        )
        return ScoringResponse(**result)
    except Exception as exc:
        logger.exception("score endpoint failed")
        raise HTTPException(status_code=500, detail=str(exc))
