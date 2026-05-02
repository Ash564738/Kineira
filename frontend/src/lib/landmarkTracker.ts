import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker
} from '@mediapipe/tasks-vision';

import { FrameLandmarks } from '../types/landmarks';

const POSE_INDEXES = [11, 12, 13, 14, 15, 16, 23, 24];
const FACE_INDEXES = [33, 263, 61, 291, 1, 13, 14, 70, 300, 152];

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

const POSE_CONNECTIONS = [
  [0,1], [0,2], [2,4], [1,3], [0,6], [3,5], [6,7], [1,7]
];

type Point = { x: number; y: number; z: number };

export class LandmarkTracker {
  private hand!: HandLandmarker;
  private pose!: PoseLandmarker;
  private face!: FaceLandmarker;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private callback?: (frame: FrameLandmarks) => void;
  private animationId: number | null = null;

  async init(canvas: HTMLCanvasElement, callback?: (frame: FrameLandmarks) => void) {
    console.log('[LandmarkTracker] init started with canvas element:', canvas);

    try {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d')!;
      this.callback = callback;

      console.log('[LandmarkTracker] canvas context initialized:', {
        width: this.canvas.width,
        height: this.canvas.height,
        hasCallback: typeof callback === 'function'
      });

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      console.log('[LandmarkTracker] FilesetResolver loaded successfully:', vision);

      this.hand = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
        },
        numHands: 2,
        runningMode: 'VIDEO'
      });

      console.log('[LandmarkTracker] hand landmarker created successfully');

      this.pose = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
        },
        runningMode: 'VIDEO'
      });

      console.log('[LandmarkTracker] pose landmarker created successfully');

      this.face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
        },
        numFaces: 1,
        runningMode: 'VIDEO'
      });

      console.log('[LandmarkTracker] face landmarker created successfully');
      console.log('[LandmarkTracker] init completed successfully');
    } catch (error) {
      console.error('[LandmarkTracker] init failed with error:', error);
      throw error;
    }
  }

  private drawLine(a: Point, b: Point, color: string, width: number) {
    try {
      console.debug('[LandmarkTracker] drawLine called with points:', { a, b, color, width });

      this.ctx.beginPath();
      this.ctx.moveTo(a.x * this.canvas.width, a.y * this.canvas.height);
      this.ctx.lineTo(b.x * this.canvas.width, b.y * this.canvas.height);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = width;
      this.ctx.globalAlpha = 0.8;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    } catch (error) {
      console.error('[LandmarkTracker] drawLine failed:', error);
    }
  }

  private drawPoint(p: Point, radius: number, color: string) {
    try {
      console.debug('[LandmarkTracker] drawPoint called with point:', { p, radius, color });

      const x = p.x * this.canvas.width;
      const y = p.y * this.canvas.height;

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();
    } catch (error) {
      console.error('[LandmarkTracker] drawPoint failed:', error);
    }
  }

  private drawHand(points: Point[], color: string) {
    try {
      console.debug('[LandmarkTracker] drawHand called with points count:', points.length);

      HAND_CONNECTIONS.forEach(([a, b]) => {
        this.drawLine(points[a], points[b], color, 2.5);
      });

      points.forEach((p, i) => {
        const radius = [4, 8, 12, 16, 20].includes(i) ? 4 : 2.5;
        this.drawPoint(p, radius, color);
      });
    } catch (error) {
      console.error('[LandmarkTracker] drawHand failed:', error);
    }
  }

  private drawPose(points: Point[]) {
    try {
      console.debug('[LandmarkTracker] drawPose called with points count:', points.length);

      POSE_CONNECTIONS.forEach(([a, b]) => {
        this.drawLine(points[a], points[b], 'rgba(255,255,255,0.75)', 2);
      });

      points.forEach((p) => this.drawPoint(p, 3, '#ffffff'));
    } catch (error) {
      console.error('[LandmarkTracker] drawPose failed:', error);
    }
  }

  private drawFace(points: Point[]) {
    try {
      console.debug('[LandmarkTracker] drawFace called with points count:', points.length);
      points.forEach((p) => this.drawPoint(p, 1.8, '#cbd5e1'));
    } catch (error) {
      console.error('[LandmarkTracker] drawFace failed:', error);
    }
  }

  start(video: HTMLVideoElement) {
    console.log('[LandmarkTracker] start called with video element:', video);

    const render = () => {
      try {
        const now = performance.now();
        console.debug('[LandmarkTracker] render frame started at timestamp:', now);

        const handRes = this.hand.detectForVideo(video, now);
        const poseRes = this.pose.detectForVideo(video, now);
        const faceRes = this.face.detectForVideo(video, now);

        console.debug('[LandmarkTracker] detection results:', {
          hands: handRes.landmarks.length,
          poses: poseRes.landmarks.length,
          faces: faceRes.faceLandmarks.length
        });

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

        const frame: FrameLandmarks = {
          left_hand: [],
          right_hand: [],
          pose: [],
          face: []
        };

        handRes.landmarks.forEach((hand, i) => {
          const label = handRes.handedness[i][0].categoryName.toLowerCase();
          const points = hand.map((p) => ({ x: p.x, y: p.y, z: p.z }));
          const color = label === 'left' ? '#22c55e' : '#38bdf8';

          console.debug('[LandmarkTracker] processing hand:', {
            index: i,
            label,
            pointsCount: points.length
          });

          this.drawHand(points, color);

          if (label === 'left') frame.left_hand = points;
          if (label === 'right') frame.right_hand = points;
        });

        if (poseRes.landmarks.length) {
          const posePoints = POSE_INDEXES.map((i) => {
            const p = poseRes.landmarks[0][i];
            return { x: p.x, y: p.y, z: p.z };
          });

          console.debug('[LandmarkTracker] pose points extracted:', posePoints.length);

          frame.pose = posePoints;
          this.drawPose(posePoints);
        }

        if (faceRes.faceLandmarks.length) {
          const facePoints = FACE_INDEXES.map((i) => {
            const p = faceRes.faceLandmarks[0][i];
            return { x: p.x, y: p.y, z: p.z };
          });

          console.debug('[LandmarkTracker] face points extracted:', facePoints.length);

          frame.face = facePoints;
          this.drawFace(facePoints);
        }

        console.debug('[LandmarkTracker] invoking callback with frame:', frame);
        this.callback?.(frame);

        this.animationId = requestAnimationFrame(render);
        console.debug('[LandmarkTracker] next animation frame scheduled:', this.animationId);
      } catch (error) {
        console.error('[LandmarkTracker] render loop failed:', error);
        this.animationId = requestAnimationFrame(render);
      }
    };

    try {
      render();
    } catch (error) {
      console.error('[LandmarkTracker] start failed:', error);
    }
  }

  stop() {
    console.log('[LandmarkTracker] stop called with animationId:', this.animationId);

    try {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        console.log('[LandmarkTracker] animation frame cancelled:', this.animationId);
        this.animationId = null;
      } else {
        console.warn('[LandmarkTracker] stop called but no animation frame was active');
      }
    } catch (error) {
      console.error('[LandmarkTracker] stop failed:', error);
    }
  }
}