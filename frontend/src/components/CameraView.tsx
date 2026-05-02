import React, { useRef, useEffect, useState } from 'react';
import { LandmarkTracker } from '../lib/landmarks/LandmarkTracker';
import { FrameLandmarks, LandmarkPoint } from '../types/landmarks';

interface CameraViewProps {
  onLandmarksDetected?: (frame: FrameLandmarks) => void;
  isRecording?: boolean;
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20]
];

const FACE_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [4,5],[5,6],[6,7],[7,8],[8,9]
];

const POSE_CONNECTIONS = [
  [11, 12],
  [11, 13],[13, 15],[15, 17],
  [12, 14],[14, 16],[16, 18],
  [11, 23],[12, 24],
  [23, 24],
  [23, 25],[25, 27],[27, 29],
  [24, 26],[26, 28],[28, 30]
];

const CameraView: React.FC<CameraViewProps> = ({
  onLandmarksDetected,
  isRecording = false
}) => {
  console.log('[CameraView] Component render started with props:', {
    hasOnLandmarksDetected: typeof onLandmarksDetected === 'function',
    isRecording
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<LandmarkTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const latestFrameRef = useRef<FrameLandmarks | null>(null);
  const rafRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const drawPoint = (
    ctx: CanvasRenderingContext2D,
    p: LandmarkPoint,
    color: string,
    isMajorJoint: boolean = false
  ) => {
    try {
      const radius = isMajorJoint ? 4 : 2;

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.globalAlpha = 0.5;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.fill();
    } catch (error) {
      console.error('[CameraView] drawPoint failed:', error, p);
    }
  };

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    a: LandmarkPoint,
    b: LandmarkPoint,
    color: string
  ) => {
    try {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.globalAlpha = 0.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.8;
      ctx.stroke();

      ctx.globalAlpha = 1.0;
    } catch (error) {
      console.error('[CameraView] drawLine failed:', error, { a, b });
    }
  };

  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    points: LandmarkPoint[],
    connections: number[][],
    color: string,
    isPose: boolean = false
  ) => {
    try {
      if (!points?.length) {
        return;
      }

      for (const [a, b] of connections) {
        if (points[a] && points[b]) {
          drawLine(ctx, points[a], points[b], color);
        }
      }

      for (const p of points) {
        if (p) {
          drawPoint(ctx, p, color, isPose);
        }
      }
    } catch (error) {
      console.error('[CameraView] drawSkeleton failed:', error);
    }
  };

  const renderLoop = () => {
    try {
      const canvas = canvasRef.current;
      const frame = latestFrameRef.current;

      if (canvas && frame) {
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          drawSkeleton(ctx, frame.left_hand, HAND_CONNECTIONS, '#00e5ff');
          drawSkeleton(ctx, frame.right_hand, HAND_CONNECTIONS, '#ff4dff');
          drawSkeleton(ctx, frame.pose, POSE_CONNECTIONS, '#00ff88', true);
          drawSkeleton(ctx, frame.face, FACE_CONNECTIONS, '#ffd166');
        } else {
          console.warn('[CameraView] renderLoop could not get canvas context');
        }
      }

      rafRef.current = requestAnimationFrame(renderLoop);
    } catch (error) {
      console.error('[CameraView] renderLoop failed:', error);
      rafRef.current = requestAnimationFrame(renderLoop);
    }
  };

  useEffect(() => {
    const init = async () => {
      console.log('[CameraView] Initialization started:', {
        hasCanvasElement: !!canvasRef.current
      });

      if (!canvasRef.current) {
        console.error('[CameraView] Initialization aborted because canvasRef is null');
        return;
      }

      const tracker = new LandmarkTracker();
      console.log('[CameraView] LandmarkTracker instance created');

      try {
        await tracker.init(canvasRef.current, (frame) => {
          try {
            latestFrameRef.current = frame;

            console.debug('[CameraView] Frame received from tracker:', {
              leftHandPoints: frame.left_hand?.length || 0,
              rightHandPoints: frame.right_hand?.length || 0,
              posePoints: frame.pose?.length || 0,
              facePoints: frame.face?.length || 0
            });

            onLandmarksDetected?.(frame);
          } catch (callbackError) {
            console.error('[CameraView] onLandmarksDetected callback failed:', callbackError);
          }
        });

        console.log('[CameraView] Tracker initialized successfully');
      } catch (error) {
        console.error('[CameraView] Tracker initialization failed:', error);
        return;
      }

      trackerRef.current = tracker;
      setReady(true);
      console.log('[CameraView] Component marked ready');

      rafRef.current = requestAnimationFrame(renderLoop);
    };

    init().catch((error) => {
      console.error('[CameraView] Unexpected init failure:', error);
    });

    return () => {
      try {
        console.log('[CameraView] Cleanup started');

        trackerRef.current?.stop();

        streamRef.current?.getTracks().forEach((track) => {
          console.log('[CameraView] Stopping media track:', {
            kind: track.kind,
            label: track.label
          });
          track.stop();
        });

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }

        console.log('[CameraView] Cleanup completed');
      } catch (error) {
        console.error('[CameraView] Cleanup failed:', error);
      }
    };
  }, []);

  const startCamera = async () => {
    console.log('[CameraView] startCamera invoked:', {
      hasVideoRef: !!videoRef.current,
      hasTrackerRef: !!trackerRef.current,
      ready,
      isTracking
    });

    if (!videoRef.current) {
      console.error('[CameraView] startCamera failed because videoRef is null');
      return;
    }

    if (!trackerRef.current) {
      console.error('[CameraView] startCamera failed because trackerRef is null');
      return;
    }

    if (isTracking) {
      console.warn('[CameraView] startCamera skipped because tracking is already active');
      return;
    }

    try {
      console.log('[CameraView] Requesting browser camera access');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });

      console.log('[CameraView] Camera stream acquired:', {
        streamId: stream.id,
        trackCount: stream.getTracks().length
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error('videoRef became null before metadata load'));
          return;
        }

        videoRef.current.onloadedmetadata = () => {
          console.log('[CameraView] Video metadata loaded successfully');
          resolve();
        };

        setTimeout(() => {
          reject(new Error('Video metadata load timeout'));
        }, 5000);
      });

      await videoRef.current.play();
      console.log('[CameraView] Video playback started');

      trackerRef.current.start(videoRef.current);
      console.log('[CameraView] Tracker start called');

      setIsTracking(true);
      console.log('[CameraView] isTracking state updated to true');
    } catch (error: any) {
      console.error('[CameraView] startCamera failed with error:', {
        name: error?.name,
        message: error?.message,
        fullError: error
      });

      if (error.name === 'NotAllowedError') {
        alert('Camera permission denied. Please allow camera access in your browser settings and refresh the page.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera found. Please connect a camera and refresh the page.');
      } else {
        alert('Error starting camera: ' + error.message);
      }
    }
  };

  const stopCamera = () => {
    try {
      console.log('[CameraView] stopCamera invoked:', {
        hadTracker: !!trackerRef.current,
        hadStream: !!streamRef.current
      });

      trackerRef.current?.stop();

      streamRef.current?.getTracks().forEach((track) => {
        console.log('[CameraView] Stopping track inside stopCamera:', {
          kind: track.kind,
          label: track.label
        });
        track.stop();
      });

      streamRef.current = null;
      setIsTracking(false);

      console.log('[CameraView] stopCamera completed');
    } catch (error) {
      console.error('[CameraView] stopCamera failed:', error);
    }
  };

  useEffect(() => {
    console.log('[CameraView] isRecording effect triggered:', {
      isRecording,
      ready,
      isTracking
    });

    try {
      if (!ready) {
        console.log('[CameraView] skipped because not ready');
        return;
      }

      if (isRecording && !isTracking) {
        console.log('[CameraView] starting camera because recording=true and tracking=false');
        startCamera();
      }

      if (!isRecording && isTracking) {
        console.log('[CameraView] stopping camera because recording=false and tracking=true');
        stopCamera();
      }
    } catch (error) {
      console.error('[CameraView] isRecording effect failed:', error);
    }
  }, [isRecording, ready, isTracking]);

  return (
    <div className="relative mx-auto w-[640px]">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={640}
        height={480}
        className="rounded-2xl shadow-2xl scale-x-[-1]"
      />

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 pointer-events-none rounded-2xl scale-x-[-1]"
      />
    </div>
  );
};

export default CameraView;