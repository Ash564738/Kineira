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
} from '../../types/landmarks';

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

        // Only clear and draw landmarks — video is rendered by the <video> element
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

    frame.pose = this.extractPose(results.poseLandmarks?.[0]);
    frame.face = this.extractXYZ(results.faceLandmarks?.[0], N_FACE);
    frame.left_hand = this.extractXYZ(results.leftHandLandmarks?.[0], N_HAND);
    frame.right_hand = this.extractXYZ(results.rightHandLandmarks?.[0], N_HAND);

    const keypoints = this.extractKeypoints(results);

    if (keypoints.length !== FEATURE_SIZE) {
      console.warn(
        `[LandmarkTracker] expected ${FEATURE_SIZE}, got ${keypoints.length}`
      );
    }

    return { frame, keypoints };
  }

  private extractKeypoints(results: HolisticLandmarkerResult): number[] {
    const pose = new Array<number>(N_POSE * 4).fill(0);
    const face = new Array<number>(N_FACE * 3).fill(0);
    const lh = new Array<number>(N_HAND * 3).fill(0);
    const rh = new Array<number>(N_HAND * 3).fill(0);

    const poseLandmarks = results.poseLandmarks?.[0];
    if (poseLandmarks?.length) {
      const flat: number[] = [];
      for (let i = 0; i < N_POSE; i++) {
        const lm = poseLandmarks[i];
        flat.push(lm?.x ?? 0, lm?.y ?? 0, lm?.z ?? 0, lm?.visibility ?? 0);
      }
      for (let i = 0; i < pose.length && i < flat.length; i++) pose[i] = flat[i];
    }

    const faceLandmarks = results.faceLandmarks?.[0];
    if (faceLandmarks?.length) {
      const flat: number[] = [];
      for (let i = 0; i < N_FACE; i++) {
        const lm = faceLandmarks[i];
        flat.push(lm?.x ?? 0, lm?.y ?? 0, lm?.z ?? 0);
      }
      for (let i = 0; i < face.length && i < flat.length; i++) face[i] = flat[i];
    }

    const leftHand = results.leftHandLandmarks?.[0];
    if (leftHand?.length) {
      const flat: number[] = [];
      for (let i = 0; i < N_HAND; i++) {
        const lm = leftHand[i];
        flat.push(lm?.x ?? 0, lm?.y ?? 0, lm?.z ?? 0);
      }
      for (let i = 0; i < lh.length && i < flat.length; i++) lh[i] = flat[i];
    }

    const rightHand = results.rightHandLandmarks?.[0];
    if (rightHand?.length) {
      const flat: number[] = [];
      for (let i = 0; i < N_HAND; i++) {
        const lm = rightHand[i];
        flat.push(lm?.x ?? 0, lm?.y ?? 0, lm?.z ?? 0);
      }
      for (let i = 0; i < rh.length && i < flat.length; i++) rh[i] = flat[i];
    }

    return [...pose, ...face, ...lh, ...rh];
  }

  private extractPose(points?: LandmarkPoint[]): LandmarkPoint[] {
    const out: LandmarkPoint[] = [];
    for (let i = 0; i < N_POSE; i++) {
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

  private extractXYZ(
    points: LandmarkPoint[] | undefined,
    count: number
  ): LandmarkPoint[] {
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

  // Converts normalized [0,1] coords → canvas pixel coords before drawing
  private toPixel(p: LandmarkPoint): { px: number; py: number } {
    return {
      px: p.x * this.canvas.width,
      py: p.y * this.canvas.height,
    };
  }

  private drawPoint(
    p: LandmarkPoint,
    radius: number,
    color: string
  ) {
    const { px, py } = this.toPixel(p);
    this.ctx.beginPath();
    this.ctx.arc(px, py, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawLine(
    a: LandmarkPoint,
    b: LandmarkPoint,
    color: string,
    width: number
  ) {
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
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
  ];

    const POSE_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8],
      [9, 10], [11, 12],
      [11, 13], [13, 15], [15, 17], [17, 19], [19, 15], [15, 21],
      [12, 14], [14, 16], [16, 18], [18, 20], [20, 16], [16, 22],
      [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [27, 29], [29, 31], [31, 27],
      [24, 26], [26, 28], [28, 30], [30, 32], [32, 28],
    ];

  const FACE_CONTOUR_CONNECTIONS = [
    [10, 338], [338, 297], [297, 332], [332, 284],
    [284, 251], [251, 389], [389, 356], [356, 454],
    [454, 323], [323, 361], [361, 288], [288, 397],
    [397, 365], [365, 379], [379, 378], [378, 400],
    [400, 377], [377, 152], [152, 148], [148, 176],
    [176, 149], [149, 150], [150, 136], [136, 172],
    [172, 58], [58, 132], [132, 93], [93, 234],
    [234, 127], [127, 162], [162, 21], [21, 54],
    [54, 103], [103, 67], [67, 109], [109, 10]
  ];

  // Left hand – green lines, red dots
  this.drawSkeleton(
    frame.left_hand,
    HAND_CONNECTIONS,
    '#00ff00',   // green lines
    '#ff0000',   // red dots
    2,
    2.5
  );

  // Right hand – blue lines, red dots
  this.drawSkeleton(
    frame.right_hand,
    HAND_CONNECTIONS,
    '#87CEFA',   // blue lines
    '#ff0000',   // red dots
    2,
    2.5
  );

  // Pose – subtle style (optional – you can tweak as you like)
  this.drawSkeleton(
    frame.pose,
    POSE_CONNECTIONS,
    '#1E90FF',
    '#ff0000',
    2,
    3
  );

  // Face – white outline, white dots, thin
  this.drawSkeleton(
    frame.face,
    FACE_CONTOUR_CONNECTIONS,
    '#ffffff',   // white lines
    '#ffffff',   // white dots
    1,           // line thickness
    1            // dot radius
  );
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

  // Draw connections
  for (const [a, b] of connections) {
    if (points[a] && points[b]) {
      this.drawLine(points[a], points[b], lineColor, lineWidth);
    }
  }

  // Draw all joints uniformly
  for (const p of points) {
    if (!p) continue;
    this.drawPoint(p, jointRadius, jointColor);
  }
}
}