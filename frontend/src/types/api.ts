import { FrameLandmarks } from "./landmarks";

export interface PredictionResult {
  sign: string;
  confidence: number;
  gloss: string;
  sentence: string;
}

export interface ScoringResult {
  score: number;
  feedback: string;
  details: {
    accuracy: number;
    completeness: number;
    timing: number;
  };
  is_correct: boolean;
  reference_sign: string;
  user_sign: string;
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
  landmarks_data?: string;
}

export interface RecognizePayload {
  landmarks_sequence: FrameLandmarks[];
  mode: "alphabet" | "word" | "sentence";
}
