import {
  FilesetResolver,
  HolisticLandmarker,
  HolisticLandmarkerResult,
} from '@mediapipe/tasks-vision';
import {
  FEATURE_SIZE,
  FrameLandmarks,
  FrameSample,
  LandmarkPoint,
  N_FACE,
  N_HAND,
  N_POSE,
  FACE_EXPRESSION_INDICES,
} from '../../types/landmarks';

// Chỉ số Pose thân trên (23 điểm đầu tiên của MediaPipe Pose)
const POSE_UPPER_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export class LandmarkTracker {
  private holistic!: HolisticLandmarker;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private callback?: (sample: FrameSample) => void;
  private animationId: number | null = null;
  private running = false;

  async init(canvas: HTMLCanvasElement, callback?: (sample: FrameSample) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to get 2D context from canvas');
    this.ctx = ctx;
    this.callback = callback;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    this.holistic = await HolisticLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
      },
      runningMode: 'VIDEO',
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minFaceSuppressionThreshold: 0.3,
      minHandLandmarksConfidence: 0.5,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minPoseSuppressionThreshold: 0.3,
      outputFaceBlendshapes: false,
      outputPoseSegmentationMasks: false,
    });
  }

  start(video: HTMLVideoElement) {
    if (this.running) return;
    this.running = true;

    const render = () => {
      if (!this.running) return;
      try {
        const now = performance.now();
        const results = this.holistic.detectForVideo(video, now);
        const { frame, keypoints } = this.convertResults(results);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawFrame(frame);

        this.callback?.({
          frame,
          keypoints,
          timestamp: now,
        });

        this.animationId = requestAnimationFrame(render);
      } catch (error) {
        console.error('[LandmarkTracker] render loop failed:', error);
        this.animationId = requestAnimationFrame(render);
      }
    };
    render();
  }

  stop() {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private convertResults(results: HolisticLandmarkerResult): {
    frame: FrameLandmarks;
    keypoints: number[];
  } {
    const frame: FrameLandmarks = {
      left_hand: [],
      right_hand: [],
      pose: [],
      face: [],
    };

    // Để vẽ, ta vẫn lấy toàn bộ landmarks gốc (cho đẹp)
    frame.pose = this.extractPoseFull(results.poseLandmarks?.[0]);
    frame.face = this.extractXYZ(results.faceLandmarks?.[0], 468); // Vẽ toàn bộ mặt
    frame.left_hand = this.extractXYZ(results.leftHandLandmarks?.[0], N_HAND);
    frame.right_hand = this.extractXYZ(results.rightHandLandmarks?.[0], N_HAND);

    const keypoints = this.extractKeypoints(results);

    if (keypoints.length !== FEATURE_SIZE) {
      console.warn(`[LandmarkTracker] expected ${FEATURE_SIZE}, got ${keypoints.length}`);
    }

    return { frame, keypoints };
  }

  private extractKeypoints(results: HolisticLandmarkerResult): number[] {
    const lh = new Array<number>(N_HAND * 3).fill(0);
    const rh = new Array<number>(N_HAND * 3).fill(0);
    const pose = new Array<number>(N_POSE * 4).fill(0);
    const face = new Array<number>(N_FACE * 3).fill(0);

    // Tay trái
    const leftHand = results.leftHandLandmarks?.[0];
    if (leftHand?.length) {
      for (let i = 0; i < N_HAND; i++) {
        const lm = leftHand[i];
        const base = i * 3;
        lh[base] = lm?.x ?? 0;
        lh[base + 1] = lm?.y ?? 0;
        lh[base + 2] = lm?.z ?? 0;
      }
    }

    // Tay phải
    const rightHand = results.rightHandLandmarks?.[0];
    if (rightHand?.length) {
      for (let i = 0; i < N_HAND; i++) {
        const lm = rightHand[i];
        const base = i * 3;
        rh[base] = lm?.x ?? 0;
        rh[base + 1] = lm?.y ?? 0;
        rh[base + 2] = lm?.z ?? 0;
      }
    }

    // Pose thân trên (23 điểm, có visibility)
    const poseLandmarks = results.poseLandmarks?.[0];
    if (poseLandmarks?.length) {
      for (let i = 0; i < POSE_UPPER_INDICES.length; i++) {
        const idx = POSE_UPPER_INDICES[i];
        const lm = poseLandmarks[idx];
        const base = i * 4;
        pose[base] = lm?.x ?? 0;
        pose[base + 1] = lm?.y ?? 0;
        pose[base + 2] = lm?.z ?? 0;
        pose[base + 3] = lm?.visibility ?? 0;
      }
    }

    // Mặt biểu cảm (37 điểm chọn lọc)
    const faceLandmarks = results.faceLandmarks?.[0];
    if (faceLandmarks?.length) {
      for (let i = 0; i < FACE_EXPRESSION_INDICES.length; i++) {
        const idx = FACE_EXPRESSION_INDICES[i];
        const lm = faceLandmarks[idx];
        const base = i * 3;
        face[base] = lm?.x ?? 0;
        face[base + 1] = lm?.y ?? 0;
        face[base + 2] = lm?.z ?? 0;
      }
    }

    return [...lh, ...rh, ...pose, ...face];
  }

  // Vẽ toàn bộ Pose (33 điểm) – không ảnh hưởng đến keypoints
  private extractPoseFull(points?: LandmarkPoint[]): LandmarkPoint[] {
    const out: LandmarkPoint[] = [];
    for (let i = 0; i < 33; i++) {
      const p = points?.[i];
      out.push({
        x: p?.x ?? 0,
        y: p?.y ?? 0,
        z: p?.z ?? 0,
        visibility: p?.visibility ?? 0,
      });
    }
    return out;
  }

  private extractXYZ(points: LandmarkPoint[] | undefined, count: number): LandmarkPoint[] {
    const out: LandmarkPoint[] = [];
    for (let i = 0; i < count; i++) {
      const p = points?.[i];
      out.push({
        x: p?.x ?? 0,
        y: p?.y ?? 0,
        z: p?.z ?? 0,
      });
    }
    return out;
  }

  // ---------- Phần vẽ giữ nguyên như cũ ----------
  private toPixel(p: LandmarkPoint): { px: number; py: number } {
    return { px: p.x * this.canvas.width, py: p.y * this.canvas.height };
  }
  private drawPoint(p: LandmarkPoint, radius: number, color: string) {
    const { px, py } = this.toPixel(p);
    this.ctx.beginPath();
    this.ctx.arc(px, py, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }
  private drawLine(a: LandmarkPoint, b: LandmarkPoint, color: string, width: number) {
    const { px: ax, py: ay } = this.toPixel(a);
    const { px: bx, py: by } = this.toPixel(b);
    this.ctx.beginPath();
    this.ctx.moveTo(ax, ay);
    this.ctx.lineTo(bx, by);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.stroke();
  }

  private drawFrame(frame: FrameLandmarks) {
    const HAND_CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[0,17],[17,18],[18,19],[19,20],
    ];
    const POSE_CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,7],
      [0,4],[4,5],[5,6],[6,8],
      [9,10],[11,12],
      [11,13],[13,15],[15,17],[17,19],[19,15],[15,21],
      [12,14],[14,16],[16,18],[18,20],[20,16],[16,22],
      [11,23],[12,24],[23,24],
      [23,25],[25,27],[27,29],[29,31],[31,27],
      [24,26],[26,28],[28,30],[30,32],[32,28],
    ];
    const FACE_CONTOUR_CONNECTIONS = [
      [10,338],[338,297],[297,332],[332,284],
      [284,251],[251,389],[389,356],[356,454],
      [454,323],[323,361],[361,288],[288,397],
      [397,365],[365,379],[379,378],[378,400],
      [400,377],[377,152],[152,148],[148,176],
      [176,149],[149,150],[150,136],[136,172],
      [172,58],[58,132],[132,93],[93,234],
      [234,127],[127,162],[162,21],[21,54],
      [54,103],[103,67],[67,109],[109,10]
    ];

    this.drawSkeleton(frame.left_hand, HAND_CONNECTIONS, '#00ff00', '#ff0000', 2, 2.5);
    this.drawSkeleton(frame.right_hand, HAND_CONNECTIONS, '#87CEFA', '#ff0000', 2, 2.5);
    this.drawSkeleton(frame.pose, POSE_CONNECTIONS, '#1E90FF', '#ff0000', 2, 3);
    this.drawSkeleton(frame.face, FACE_CONTOUR_CONNECTIONS, '#ffffff', '#ffffff', 1, 1);
  }

  private drawSkeleton(
    points: LandmarkPoint[],
    connections: number[][],
    lineColor: string,
    jointColor: string,
    lineWidth: number,
    jointRadius: number,
  ) {
    if (!points?.length) return;
    for (const [a, b] of connections) {
      if (points[a] && points[b]) {
        this.drawLine(points[a], points[b], lineColor, lineWidth);
      }
    }
    for (const p of points) {
      if (!p) continue;
      this.drawPoint(p, jointRadius, jointColor);
    }
  }
}