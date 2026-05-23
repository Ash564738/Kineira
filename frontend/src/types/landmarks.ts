export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FrameLandmarks {
  left_hand: LandmarkPoint[];
  right_hand: LandmarkPoint[];
  pose: LandmarkPoint[];
  face: LandmarkPoint[];
}

export interface FrameSample {
  frame: FrameLandmarks;
  keypoints: number[];
  timestamp: number;
}

export const N_POSE = 33;
export const N_FACE = 468;
export const N_HAND = 21;
export const FEATURE_SIZE = N_POSE * 4 + N_FACE * 3 + N_HAND * 3 + N_HAND * 3;
export const VIDEOS_PER_ACTION = 30;
export const FRAMES_PER_VIDEO = 30;