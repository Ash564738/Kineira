import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { LandmarkPoint, HandLandmarks } from '../types/landmarks';

export class HandTracker {
  private hands: Hands | null = null;
  private camera: Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private onResultsCallback: ((results: any) => void) | null = null;

  async init(canvas: HTMLCanvasElement, onResults?: (results: any) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onResultsCallback = onResults || null;

    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => {
      this.onResults(results);
    });
  }

  private onResults(results: any) {
    if (this.ctx && this.canvas) {
      this.ctx.save();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 5
          });
          drawLandmarks(this.ctx, landmarks, {
            color: '#FF0000',
            lineWidth: 2
          });
        }
      }
      this.ctx.restore();
    }

    if (this.onResultsCallback) {
      this.onResultsCallback(results);
    }
  }

  start(video: HTMLVideoElement) {
    if (!this.hands) return;

    this.camera = new Camera(video, {
      onFrame: async () => {
        if (this.hands) {
          await this.hands.send({ image: video });
        }
      },
      width: 640,
      height: 480
    });
    this.camera.start();
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
    }
  }

  // Convert MediaPipe landmarks to our format
  static convertLandmarks(landmarks: any[]): HandLandmarks {
    return landmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z
    }));
  }
}