import React, { useRef, useEffect, useState } from 'react';
import { HandTracker } from '../lib/handTracker';
import { HandLandmarks } from '../types/landmarks';

interface CameraViewProps {
  onLandmarksDetected?: (landmarks: HandLandmarks[]) => void;
  isRecording?: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ onLandmarksDetected, isRecording }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const trackerReadyRef = useRef(false);
  const onLandmarksDetectedRef = useRef(onLandmarksDetected as ((landmarks: HandLandmarks[]) => void) | undefined);
  const isRecordingRef = useRef<boolean>(!!isRecording);
  const [isTracking, setIsTracking] = useState(false);

  // Keep a ref to the latest callback so we don't re-init the tracker on every parent render.
  useEffect(() => {
    onLandmarksDetectedRef.current = onLandmarksDetected;
  }, [onLandmarksDetected]);

  useEffect(() => {
    const initTracker = async () => {
      if (canvasRef.current) {
        trackerRef.current = new HandTracker();
        await trackerRef.current.init(canvasRef.current, (results) => {
          if (results.multiHandLandmarks) {
            // small debug log to help diagnose black-screen issues
            // eslint-disable-next-line no-console
            console.debug('CameraView:onResults hands=', results.multiHandLandmarks.length);
            if (onLandmarksDetectedRef.current) {
              const landmarks = results.multiHandLandmarks.map((lm: any) =>
                HandTracker.convertLandmarks(lm)
              );
              onLandmarksDetectedRef.current(landmarks);
            }
          }
        });
        trackerReadyRef.current = true;
        // eslint-disable-next-line no-console
        console.debug('CameraView:tracker ready');
        // If parent already requested recording while tracker was initializing, start now.
        if (isRecordingRef.current) {
          startTracking();
        }
      }
    };

    initTracker();

    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
      }
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTracking = () => {
    if (!trackerReadyRef.current) return;
    if (videoRef.current && trackerRef.current && !isTracking) {
      try {
        trackerRef.current.start(videoRef.current);
        // eslint-disable-next-line no-console
        console.debug('CameraView:startTracking');
        setIsTracking(true);
      } catch (err) {
        // ignore start errors but log for debugging
        // eslint-disable-next-line no-console
        console.error('Failed to start tracker:', err);
      }
    }
  };

  const stopTracking = () => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      // eslint-disable-next-line no-console
      console.debug('CameraView:stopTracking');
      setIsTracking(false);
    }
  };

  // Keep ref of recording state and start/stop tracker when the prop changes.
  useEffect(() => {
    isRecordingRef.current = !!isRecording;
    if (!trackerReadyRef.current) return;
    if (isRecording) startTracking();
    else stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full h-auto"
        autoPlay
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-auto"
        width={640}
        height={480}
      />
      <div className="mt-4">
        {!isTracking ? (
          <button
            onClick={startTracking}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Start Hand Tracking
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Stop Tracking
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraView;