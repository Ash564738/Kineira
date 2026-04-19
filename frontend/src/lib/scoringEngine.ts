import { HandLandmarks } from '../types/landmarks';

export interface ScoringResult {
  score: number;
  feedback: string;
  details: {
    accuracy: number;
    completeness: number;
    timing: number;
  };
}

export class ScoringEngine {
  // Simple scoring based on landmark presence and basic gesture recognition
  // This is a placeholder - real implementation would compare with reference gestures
  scoreGesture(landmarks: HandLandmarks[]): ScoringResult {
    if (landmarks.length === 0) {
      return {
        score: 0,
        feedback: "No hands detected",
        details: {
          accuracy: 0,
          completeness: 0,
          timing: 0
        }
      };
    }

    const hand = landmarks[0];
    if (hand.length < 21) {
      return {
        score: 20,
        feedback: "Incomplete hand detection",
        details: {
          accuracy: 20,
          completeness: hand.length / 21 * 100,
          timing: 50
        }
      };
    }

    // Basic scoring - in real implementation, compare with reference gesture
    const accuracy = this.calculateAccuracy(hand);
    const completeness = 100; // All landmarks detected
    const timing = 80; // Placeholder

    const score = (accuracy + completeness + timing) / 3;

    return {
      score: Math.round(score),
      feedback: this.generateFeedback(score),
      details: {
        accuracy,
        completeness,
        timing
      }
    };
  }

  private calculateAccuracy(hand: HandLandmarks): number {
    // Simple heuristic: check if fingers are extended or closed
    // This is very basic - real scoring would use ML models
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    const wrist = hand[0];

    // Calculate distances from wrist to fingertips
    const distances = [
      Math.sqrt((thumbTip.x - wrist.x) ** 2 + (thumbTip.y - wrist.y) ** 2),
      Math.sqrt((indexTip.x - wrist.x) ** 2 + (indexTip.y - wrist.y) ** 2),
      Math.sqrt((middleTip.x - wrist.x) ** 2 + (middleTip.y - wrist.y) ** 2),
      Math.sqrt((ringTip.x - wrist.x) ** 2 + (ringTip.y - wrist.y) ** 2),
      Math.sqrt((pinkyTip.x - wrist.x) ** 2 + (pinkyTip.y - wrist.y) ** 2)
    ];

    // Normalize distances (this is approximate)
    const maxDistance = Math.max(...distances);
    const normalized = distances.map(d => d / maxDistance * 100);

    // Average score based on finger extension
    return normalized.reduce((sum, d) => sum + d, 0) / normalized.length;
  }

  private generateFeedback(score: number): string {
    if (score >= 80) return "Excellent! Great form.";
    if (score >= 60) return "Good job! Minor adjustments needed.";
    if (score >= 40) return "Keep practicing! Focus on finger positions.";
    return "Try again! Make sure your hand is visible and steady.";
  }
}