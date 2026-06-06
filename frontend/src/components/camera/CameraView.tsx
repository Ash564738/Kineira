import React, { useEffect, useRef, useState } from 'react';
import { LandmarkTracker } from '../../lib/landmarks/LandmarkTracker';
import { FrameSample } from '../../types/landmarks';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors } from '../../styles/theme';

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
  const { theme } = useTheme();
  const palette = themeColors[theme];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<LandmarkTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onFrameDetectedRef = useRef(onFrameDetected);
  useEffect(() => {
    onFrameDetectedRef.current = onFrameDetected;
  }, [onFrameDetected]);

  const [ready, setReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!canvasRef.current) return;
      try {
        const tracker = new LandmarkTracker();
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

  const syncCanvasSize = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    if (videoWidth && videoHeight) {
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
    }
  };

  const startCamera = async () => {
    if (!videoRef.current || !trackerRef.current || isTracking) return;
    try {
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

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      console.log('========== CAMERA SETTINGS ==========');
      console.log('width      :', settings.width);
      console.log('height     :', settings.height);
      console.log('frameRate  :', settings.frameRate);
      console.log('deviceId   :', settings.deviceId);
      console.log('=====================================');

      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) return reject(new Error('No video element'));
        videoRef.current.onloadedmetadata = () => {
          syncCanvasSize();
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
    <div
      className={`relative mx-auto w-full max-w-[640px] aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl ${palette.cameraBg}`}
    >
      <video
        ref={videoRef}
        autoPlay muted playsInline
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] z-10"
      />
      {!isTracking && (
        <div
          className={`absolute inset-0 ${palette.cameraOverlayBg} flex flex-col items-center justify-center gap-2 z-20 transition-all duration-300`}
        >
          <div
            className={`w-8 h-8 rounded-full border-2 border-t-transparent ${palette.cameraSpinnerColor} animate-spin`}
          />
          <span
            className={`${palette.cameraOverlayText} text-xs tracking-widest uppercase font-medium mt-2`}
          >
            Camera is {ready ? 'ready' : 'initializing'}...
          </span>
        </div>
      )}
    </div>
  );
};

export default CameraView;