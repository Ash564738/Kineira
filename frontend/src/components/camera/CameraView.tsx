// src/components/camera/CameraView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { LandmarkTracker } from '../../lib/landmarks/LandmarkTracker';
import { FrameSample } from '../../types/landmarks';

interface CameraViewProps {
  isRecording?: boolean;
  mode?: 'recognition' | 'collection';
  onFrameDetected?: (sample: FrameSample) => void;
  onCameraReady?: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({
  isRecording = false,
  mode = 'recognition',
  onFrameDetected,
  onCameraReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<LandmarkTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // GIẢI PHÁP LỖI 1: Dùng Ref Pattern để tránh Stale Closure cho callback
  const onFrameDetectedRef = useRef(onFrameDetected);
  useEffect(() => {
    onFrameDetectedRef.current = onFrameDetected;
  }, [onFrameDetected]);

  const [ready, setReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  // Khởi tạo Tracker
  useEffect(() => {
    const init = async () => {
      if (!canvasRef.current) return;
      try {
        const tracker = new LandmarkTracker();
        // Cải tiến: Gọi ref.current bên trong closure để luôn lấy hàm mới nhất
        await tracker.init(canvasRef.current, (sample: FrameSample) => {
          onFrameDetectedRef.current?.(sample);
        });
        trackerRef.current = tracker;
        setReady(true);
      } catch (e) {
        console.error('[CameraView] tracker init failed:', e);
        setReady(false);
      }
    };

    init();

    return () => {
      trackerRef.current?.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // GIẢI PHÁP LỖI 2: Đồng bộ kích thước Canvas theo kích thước hiển thị thực của Video
  const syncCanvasSize = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    
    if (videoWidth && videoHeight) {
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      console.debug(`[CameraView] Canvas resized to match video: ${videoWidth}x${videoHeight}`);
    }
  };

  const startCamera = async () => {
    if (!videoRef.current || !trackerRef.current || isTracking) return;

    try {
      // Tối ưu hóa cấu hình camera góc rộng/chuẩn
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) return reject(new Error('No video element'));
        videoRef.current.onloadedmetadata = () => {
          syncCanvasSize(); // Đồng bộ kích thước ngay khi nạp xong metadata
          resolve();
        };
        setTimeout(() => reject(new Error('Video metadata load timeout')), 5000);
      });

      await videoRef.current.play();
      trackerRef.current.start(videoRef.current);
      setIsTracking(true);
      onCameraReady?.();
    } catch (error: any) {
      console.error('[CameraView] camera start failed:', error);
      alert(`Camera error: ${error.message}`);
    }
  };

  const stopCamera = () => {
    trackerRef.current?.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setIsTracking(false);
  };

  useEffect(() => {
    if (!ready) return;
    if (isRecording && !isTracking) startCamera();
    if (!isRecording && isTracking) stopCamera();
  }, [isRecording, ready, isTracking]);

  return (
    <div className="relative mx-auto w-full max-w-[640px] aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl bg-zinc-900">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] z-10"
      />

      {!isTracking && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-20 transition-all duration-300">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-white/20 animate-spin" />
          <span className="text-white/40 text-xs tracking-widest uppercase font-medium mt-2">
            Camera is {ready ? 'ready' : 'initializing'}...
          </span>
        </div>
      )}
    </div>
  );
};

export default CameraView;
