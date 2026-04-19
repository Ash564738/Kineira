from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import torch
import torch.nn as nn
import json
from sqlalchemy.orm import Session
from database import get_db, create_user, get_user_by_id, create_sign, get_signs, create_lesson, get_lessons, create_attempt, get_user_attempts, get_user_progress
from models import User, Sign, Lesson, Attempt, Progress

app = FastAPI(title="Kineira Sign Language API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],  # Next.js dev server(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float

class HandLandmarks(BaseModel):
    landmarks: List[LandmarkPoint]

class SignRecognitionRequest(BaseModel):
    landmarks_sequence: List[HandLandmarks]  # Sequence of hand landmarks over time

class SignRecognitionResponse(BaseModel):
    sign: str
    confidence: float
    score: float

class ScoringRequest(BaseModel):
    user_landmarks: List[LandmarkPoint]
    reference_sign: str

class ScoringResponse(BaseModel):
    score: float
    feedback: str
    details: dict

class UserCreate(BaseModel):
    username: str
    email: str

class AttemptCreate(BaseModel):
    user_id: int
    lesson_id: int
    sign_id: int
    score: float
    feedback: str
    landmarks_data: str

# Simple LSTM model for sign recognition (placeholder)
class SignRecognitionModel(nn.Module):
    def __init__(self, input_size=63, hidden_size=128, num_classes=10):  # 21 landmarks * 3 coords
        super(SignRecognitionModel, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])  # Take last time step
        return out

# Load or create model (placeholder)
model = SignRecognitionModel()
sign_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']  # Placeholder

@app.get("/")
async def root():
    return {"message": "Kineira Sign Language API"}

@app.post("/users", response_model=dict)
async def create_new_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = create_user(db, user.username, user.email)
        return {"id": db_user.id, "username": db_user.username, "email": db_user.email}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/users/{user_id}")
async def get_user(user_id: int, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "username": user.username, "email": user.email}

@app.get("/signs")
async def get_all_signs(db: Session = Depends(get_db)):
    signs = get_signs(db)
    return [{"id": s.id, "name": s.name, "description": s.description, "difficulty_level": s.difficulty_level} for s in signs]

@app.get("/signs/{sign_id}")
async def get_sign(sign_id: int, db: Session = Depends(get_db)):
    signs = get_signs(db)
    sign = next((s for s in signs if s.id == sign_id), None)
    if not sign:
        raise HTTPException(status_code=404, detail="Sign not found")
    return {"id": sign.id, "name": sign.name, "description": sign.description, "difficulty_level": sign.difficulty_level}

@app.get("/lessons")
async def get_all_lessons(db: Session = Depends(get_db)):
    lessons = get_lessons(db)
    return [{"id": l.id, "title": l.title, "description": l.description, "sign_id": l.sign_id} for l in lessons]

@app.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lessons = get_lessons(db)
    lesson = next((l for l in lessons if l.id == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"id": lesson.id, "title": lesson.title, "description": lesson.description, "sign_id": lesson.sign_id}

@app.post("/attempts")
async def create_new_attempt(attempt: AttemptCreate, db: Session = Depends(get_db)):
    try:
        db_attempt = create_attempt(
            db,
            attempt.user_id,
            attempt.lesson_id,
            attempt.sign_id,
            attempt.score,
            attempt.feedback,
            attempt.landmarks_data
        )
        return {"id": db_attempt.id, "score": db_attempt.score, "feedback": db_attempt.feedback}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/users/{user_id}/attempts")
async def get_attempts(user_id: int, db: Session = Depends(get_db)):
    attempts = get_user_attempts(db, user_id)
    return [{"id": a.id, "lesson_id": a.lesson_id, "sign_id": a.sign_id, "score": a.score, "feedback": a.feedback, "created_at": a.created_at} for a in attempts]

@app.get("/users/{user_id}/progress")
async def get_progress(user_id: int, db: Session = Depends(get_db)):
    progress = get_user_progress(db, user_id)
    return [{"sign_id": p.sign_id, "best_score": p.best_score, "attempts_count": p.attempts_count, "completed": p.completed} for p in progress]

@app.post("/recognize-sign", response_model=SignRecognitionResponse)
async def recognize_sign(request: SignRecognitionRequest):
    try:
        # Convert landmarks to tensor
        sequence = []
        for hand_landmarks in request.landmarks_sequence:
            landmarks = [[p.x, p.y, p.z] for p in hand_landmarks.landmarks]
            flat = np.array(landmarks).flatten()
            sequence.append(flat)

        if not sequence:
            return SignRecognitionResponse(sign="unknown", confidence=0.0, score=0.0)

        # Pad or truncate sequence to fixed length (placeholder)
        max_length = 30
        if len(sequence) > max_length:
            sequence = sequence[:max_length]
        elif len(sequence) < max_length:
            # Pad with zeros
            padding = [np.zeros(63) for _ in range(max_length - len(sequence))]
            sequence.extend(padding)

        input_tensor = torch.tensor(sequence, dtype=torch.float32).unsqueeze(0)

        # Model prediction (placeholder - random for now)
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)

        predicted_sign = sign_labels[predicted.item()]
        score = confidence.item() * 100

        return SignRecognitionResponse(
            sign=predicted_sign,
            confidence=confidence.item(),
            score=score
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score-gesture", response_model=ScoringResponse)
async def score_gesture(request: ScoringRequest):
    try:
        # Placeholder scoring logic
        # In real implementation, compare with reference gesture

        user_landmarks = np.array([[p.x, p.y, p.z] for p in request.user_landmarks])

        # Simple scoring based on landmark distribution
        if len(user_landmarks) < 21:
            return ScoringResponse(
                score=0.0,
                feedback="Incomplete hand detection",
                details={"reason": "insufficient_landmarks"}
            )

        # Calculate some basic metrics
        wrist = user_landmarks[0]
        fingertips = user_landmarks[[4, 8, 12, 16, 20]]  # thumb, index, middle, ring, pinky

        # Distance from wrist to fingertips
        distances = np.linalg.norm(fingertips - wrist, axis=1)
        avg_distance = np.mean(distances)

        # Score based on average distance (placeholder logic)
        score = min(100, avg_distance * 1000)  # Arbitrary scaling

        feedback = "Good form!" if score > 70 else "Keep practicing!"

        return ScoringResponse(
            score=round(score, 1),
            feedback=feedback,
            details={
                "avg_distance": float(avg_distance),
                "landmarks_count": len(user_landmarks)
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)