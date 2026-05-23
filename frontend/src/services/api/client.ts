import { Attempt, AttemptPayload, Lesson, PredictionResult, Progress, ScoringResult } from "../../types/api";
import { API_BASE_URL } from "./config";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function translateSign(keypointsSequence: number[][]) {
  const res = await fetch(`${API_BASE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keypoints_sequence: keypointsSequence }),
  });
  return parseJson<PredictionResult>(res);
}

export async function scoreGesture(userSequence: number[][], referenceSequence: number[][]) {
  const res = await fetch(`${API_BASE_URL}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_sequence: userSequence, reference_sequence: referenceSequence }),
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