import { Attempt, AttemptPayload, Lesson, PredictionResult, Progress, ScoringResult } from "../../types/api";
import { FrameLandmarks } from "../../types/landmarks";
import { API_BASE_URL } from "./config";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function recognizeSign(sequence: FrameLandmarks[], mode: "alphabet" | "word" | "sentence") {
  const res = await fetch(`${API_BASE_URL}/recognize-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landmarks_sequence: sequence, mode }),
  });
  return parseJson<PredictionResult>(res);
}

export async function scoreSign(sequence: FrameLandmarks[], referenceSign: string, mode = "alphabet") {
  const res = await fetch(`${API_BASE_URL}/score-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landmarks_sequence: sequence, reference_sign: referenceSign, mode }),
  });
  return parseJson<ScoringResult>(res);
}

export async function fetchLessons() {
  const res = await fetch(`${API_BASE_URL}/lessons`);
  return parseJson<Lesson[]>(res);
}

export async function fetchLesson(lessonId: string | number) {
  const res = await fetch(`${API_BASE_URL}/lessons/${lessonId}`);
  return parseJson<Lesson>(res);
}

export async function fetchUserProgress(userId = 1) {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/progress`);
  return parseJson<Progress[]>(res);
}

export async function fetchUserAttempts(userId = 1) {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/attempts`);
  return parseJson<Attempt[]>(res);
}

export async function saveAttempt(userId: number, payload: AttemptPayload) {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<Attempt>(res);
}
