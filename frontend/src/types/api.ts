// src/types/api.ts
export interface PredictionResult {
  sign: string;
  confidence: number;
}

export interface ScoringResult {
  score: number;
  feedback: string;
  accuracy: number;
  completeness: number;
  timing: number;
  details: {
    cosine_similarity: number;
    dtw_similarity: number;
    transformer_similarity: number;
  };
  sign?: string;
  confidence?: number;
  hand_similarity?: number;
  finger_details?: Record<string, FingerDetail>;
  overall_score?: number;
}

export interface FingerDetail {
  similarity: number;
  cosine_similarity: number;
  magnitude_similarity: number;
  suggestion: string;
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  sign_id: number;
  difficulty: string;
  reference_video_url?: string;
  reference_sign?: string;
}

export interface Progress {
  sign_id: number;
  best_score: number;
  attempts_count: number;
  completed: boolean;
}

export interface Attempt {
  id: number;
  lesson_id: number;
  sign_id: number;
  score: number;
  feedback: string;
  created_at: string;
}

export interface AttemptPayload {
  lesson_id: number;
  sign_id: number;
  score: number;
  feedback: string;
}