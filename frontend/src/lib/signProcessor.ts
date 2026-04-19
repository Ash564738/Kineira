import { HandLandmarks } from '../types/landmarks';

export interface SignResult {
  sign: string;
  confidence: number;
}

export class SignProcessor {
  // Simple rule-based sign recognition for basic signs
  // In a real implementation, this would use a trained ML model
  recognizeSign(landmarks: HandLandmarks): SignResult {
    if (landmarks.length < 21) {
      return { sign: 'unknown', confidence: 0 };
    }

    // Basic heuristics for common signs
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const thumbIp = landmarks[3];
    const indexPip = landmarks[6];
    const middlePip = landmarks[10];
    const ringPip = landmarks[14];
    const pinkyPip = landmarks[18];

    const wrist = landmarks[0];

    // Check for "A" sign (fist with thumb out)
    const isFist = this.isFist(landmarks);
    const thumbExtended = this.isFingerExtended(thumbTip, thumbIp, wrist);

    if (isFist && thumbExtended) {
      return { sign: 'A', confidence: 0.8 };
    }

    // Check for "B" sign (flat hand)
    const allExtended = this.areAllFingersExtended(landmarks);
    if (allExtended) {
      return { sign: 'B', confidence: 0.7 };
    }

    // Check for "C" sign (curved hand)
    const isCurved = this.isHandCurved(landmarks);
    if (isCurved) {
      return { sign: 'C', confidence: 0.6 };
    }

    // Check for "D" sign (index finger extended, others closed)
    const indexExtended = this.isFingerExtended(indexTip, indexPip, wrist);
    const othersClosed = !this.isFingerExtended(middleTip, middlePip, wrist) &&
                        !this.isFingerExtended(ringTip, ringPip, wrist) &&
                        !this.isFingerExtended(pinkyTip, pinkyPip, wrist);

    if (indexExtended && othersClosed && !thumbExtended) {
      return { sign: 'D', confidence: 0.75 };
    }

    // Default to unknown
    return { sign: 'unknown', confidence: 0.1 };
  }

  private isFingerExtended(tip: any, pip: any, wrist: any): boolean {
    const tipToWrist = Math.sqrt((tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2);
    const pipToWrist = Math.sqrt((pip.x - wrist.x) ** 2 + (pip.y - wrist.y) ** 2);
    return tipToWrist > pipToWrist * 1.2; // Tip is significantly further than pip
  }

  private isFist(landmarks: HandLandmarks): boolean {
    const fingers = [
      { tip: landmarks[8], pip: landmarks[6] }, // index
      { tip: landmarks[12], pip: landmarks[10] }, // middle
      { tip: landmarks[16], pip: landmarks[14] }, // ring
      { tip: landmarks[20], pip: landmarks[18] }  // pinky
    ];

    return fingers.every(finger => !this.isFingerExtended(finger.tip, finger.pip, landmarks[0]));
  }

  private areAllFingersExtended(landmarks: HandLandmarks): boolean {
    const fingers = [
      { tip: landmarks[4], pip: landmarks[3] }, // thumb
      { tip: landmarks[8], pip: landmarks[6] }, // index
      { tip: landmarks[12], pip: landmarks[10] }, // middle
      { tip: landmarks[16], pip: landmarks[14] }, // ring
      { tip: landmarks[20], pip: landmarks[18] }  // pinky
    ];

    return fingers.every(finger => this.isFingerExtended(finger.tip, finger.pip, landmarks[0]));
  }

  private isHandCurved(landmarks: HandLandmarks): boolean {
    // Check if fingertips are closer to wrist than expected for flat hand
    const wrist = landmarks[0];
    const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];

    const avgDistance = fingertips.reduce((sum, tip) => {
      return sum + Math.sqrt((tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2);
    }, 0) / fingertips.length;

    // For curved hand, average distance should be less than for flat hand
    return avgDistance < 0.3; // Normalized distance threshold
  }
}