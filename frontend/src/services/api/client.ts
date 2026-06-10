// src/services/api/client.ts
import { Attempt, AttemptPayload, Lesson, PredictionResult, Progress, ScoringResult } from "../../types/api";
import { apiUrl } from "./config";
const getToken = () => localStorage.getItem('auth_token');

export async function fetchWithToken(url: string, options: RequestInit = {}) {
  const token = getToken();
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return fetch(url, options);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function translateSign(keypointsSequence: number[][]) {
  const res = await fetch(apiUrl("/translate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keypoints_sequence: keypointsSequence }),
  });
  return parseJson<PredictionResult>(res);
}

export async function scoreGesture(userSequence: number[][], targetSign: string) {
  const res = await fetch(apiUrl("/score"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_sequence: userSequence,
      target_sign: targetSign,
    }),
  });
  return parseJson<ScoringResult>(res);
}

export async function fetchLessons() {
  const res = await fetch(apiUrl("/lessons"));
  return parseJson<Lesson[]>(res);
}

export async function fetchLesson(lessonId: string | number) {
  const res = await fetch(apiUrl(`/lessons/${lessonId}`));
  return parseJson<Lesson>(res);
}

export async function fetchUserProgress(userId = 1) {
  const res = await fetch(apiUrl(`/users/${userId}/progress`));
  return parseJson<Progress[]>(res);
}

export async function fetchUserAttempts(userId = 1) {
  const res = await fetch(apiUrl(`/users/${userId}/attempts`));
  return parseJson<Attempt[]>(res);
}

export async function saveAttempt(userId: number, payload: AttemptPayload) {
  const res = await fetch(apiUrl(`/users/${userId}/progress`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<Attempt>(res);
}

export async function resetTranslate() {
  const res = await fetch(apiUrl("/translate/reset"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return parseJson<{ status: string }>(res);
}