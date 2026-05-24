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

// --- ĐOẠN SỬA ĐỔI CẤU HÌNH TỐI ƯU ---
export const N_HAND = 21;
export const N_POSE = 23;
export const FACE_EXPRESSION_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 95,
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
  33, 133, 362, 263, 1, 4, 168
];
export const N_FACE = FACE_EXPRESSION_INDICES.length;
export const FEATURE_SIZE = (N_HAND * 3) + (N_HAND * 3) + (N_POSE * 4) + (N_FACE * 3);
export const VIDEOS_PER_ACTION = 100;
export const FRAMES_PER_VIDEO = 30;
export const VIDEOS_PER_HAND = 50;