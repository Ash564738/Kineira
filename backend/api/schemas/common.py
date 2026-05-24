# api/schemas/common.py
from typing import Dict, List, Optional

from pydantic import BaseModel


class Point3D(BaseModel):
    x: float
    y: float
    z: float


class FrameData(BaseModel):
    left_hand: List[Point3D] = []
    right_hand: List[Point3D] = []
    pose: List[Point3D] = []
    face: List[Point3D] = []


class SignRecognitionRequest(BaseModel):
    landmarks_sequence: List[FrameData]
    mode: Optional[str] = "word"


class SignRecognitionResponse(BaseModel):
    sign: str
    confidence: float
    gloss: str
    sentence: str


class ScoringRequest(BaseModel):
    landmarks_sequence: List[FrameData]
    reference_sign: str
    mode: Optional[str] = "word"


class ScoringResponse(BaseModel):
    score: float
    feedback: str
    details: Dict[str, float]
    is_correct: bool
    reference_sign: str
    user_sign: str


class LessonResponse(BaseModel):
    id: int
    title: str
    description: str
    sign_id: int
    difficulty: str
    reference_video_url: Optional[str] = None
    reference_sign: Optional[str] = None


class ProgressResponse(BaseModel):
    sign_id: int
    best_score: float
    attempts_count: int
    completed: bool


class AttemptRequest(BaseModel):
    lesson_id: int
    sign_id: int
    score: float
    feedback: str
    landmarks_data: Optional[str] = None


class AttemptResponse(BaseModel):
    id: int
    lesson_id: int
    sign_id: int
    score: float
    feedback: str
    created_at: str
