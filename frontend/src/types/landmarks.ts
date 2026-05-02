export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface FrameLandmarks {
  left_hand: LandmarkPoint[];
  right_hand: LandmarkPoint[];
  pose: LandmarkPoint[];
  face: LandmarkPoint[];
}