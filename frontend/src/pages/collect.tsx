'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraView from '../components/camera/CameraView';
import collectionService, { AllStatus } from '../services/api/collectionService';
import trainingService from '../services/api/trainingService';
import TopNav from '../components/layout/TopNav';
import { FEATURE_SIZE, FrameSample, VIDEOS_PER_ACTION, FRAMES_PER_VIDEO } from '../types/landmarks';

const STATUS_POLL_MS = 10000;
const MAX_WAIT_MS_PER_FRAME = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const Collect: React.FC = () => {
  const [allStatus, setAllStatus] = useState<AllStatus>({});
  const [collectingState, setCollectingState] = useState({
    isCollecting: false,
    action: '',
    videoNum: 0,
    frameNum: 0,
  });
  const [trainingStatus, setTrainingStatus] = useState<any>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectingRef = useRef(collectingState);
  collectingRef.current = collectingState;

  const latestSampleRef = useRef<FrameSample | null>(null);
  const cameraReady = useRef(false);
  const stopRequested = useRef(false);
  const lockedRef = useRef(false);

  const currentActionRef = useRef('');

  const targetVideosRef = useRef(50);

  const loadAllStatus = async () => {
    try {
      const status = await collectionService.getAllStatus();
      setAllStatus(status);
    } catch (err) {
      console.error('Status load error:', err);
    }
  };

  useEffect(() => {
    loadAllStatus();
    const interval = setInterval(loadAllStatus, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isTraining) return;
    const poll = setInterval(async () => {
      try {
        const s = await trainingService.getStatus();
        setTrainingStatus(s);
        if (s.status === 'completed' || s.status === 'failed') setIsTraining(false);
      } catch (e) {
        console.error(e);
      }
    }, 1000);
    return () => clearInterval(poll);
  }, [isTraining]);


  const summarizeKeypoints = (keypoints: number[]) => {
    const len = keypoints?.length ?? 0;
    const zeros = keypoints.filter((v) => v === 0).length;
    const hasNaN = keypoints.some((v) => Number.isNaN(v));
    const hasInf = keypoints.some((v) => !Number.isFinite(v));
    const min = len ? Math.min(...keypoints) : null;
    const max = len ? Math.max(...keypoints) : null;

    console.log('[FrameSample summary]', {
      len,
      zeros,
      zeroRatio: len ? zeros / len : 0,
      hasNaN,
      hasInf,
      min,
      max,
      first20: keypoints.slice(0, 20),
    });
  };

  const isValidSample = (sample: FrameSample | null) => {
    return (
      !!sample &&
      Array.isArray(sample.keypoints) &&
      sample.keypoints.length === FEATURE_SIZE &&
      sample.keypoints.every((v) => Number.isFinite(v))
    );
  };

  const handleFrameDetected = useCallback((sample: FrameSample) => {
    latestSampleRef.current = sample;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[FrameSample raw]', {
        timestamp: sample.timestamp,
        keypointsLength: sample.keypoints?.length,
      });
      summarizeKeypoints(sample.keypoints);
    }
  }, []);

  const waitForValidSample = async (): Promise<FrameSample | null> => {
    const start = Date.now();
    while (!stopRequested.current && Date.now() - start < MAX_WAIT_MS_PER_FRAME) {
      const s = latestSampleRef.current;
      if (isValidSample(s)) {
        latestSampleRef.current = null;
        return s;
      }
      await sleep(5);
    }
    return null;
  };

  const captureOneVideo = async (action: string, videoNum: number): Promise<boolean> => {
    console.log(`[Collect] Starting video ${videoNum} for ${action}`);
    const framesBuffer: { frame_num: number; keypoints: number[] }[] = [];

    // Thu thập đủ 30 frame
    for (let frameNum = 0; frameNum < FRAMES_PER_VIDEO; frameNum++) {
      if (stopRequested.current) return false;

      const sample = await waitForValidSample();
      if (!sample) {
        setError(
          `No valid keypoints for ${action} video ${videoNum}, frame ${frameNum}. Abort.`
        );
        console.warn(`[Collect] frame ${frameNum} invalid or timeout`);
        return false;
      }

      // Log ngắn gọn để debug dữ liệu nhận
      console.log(`[Frame ${frameNum}] keypoints length=${sample.keypoints.length}, first10=`, sample.keypoints.slice(0, 10));

      framesBuffer.push({ frame_num: frameNum, keypoints: sample.keypoints });

      setCollectingState((prev) => ({
        ...prev,
        videoNum,
        frameNum: frameNum + 1,
      }));
    }

    // Gửi batch
    try {
      console.log(`[Collect] Sending batch for action=${action}, video=${videoNum}, frames=${framesBuffer.length}`);
      const resp = await collectionService.saveFrameBatch(action, videoNum, framesBuffer);
      console.log('[Batch save response]', resp);
      return true;
    } catch (err: any) {
      console.error('Batch save failed:', err);
      setError(`Batch save failed: ${err.message}`);
      stopRequested.current = true;
      setCollectingState((prev) => ({ ...prev, isCollecting: false }));
      return false;
    }
  };

  const runAllVideos = async (action: string) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      stopRequested.current = false;

    try {
        // Lấy số video tiếp theo từ server
        const nextResp = await fetch(`http://localhost:8000/data-collection/next-video/${action}`);
        if (!nextResp.ok) throw new Error('Failed to get next video');
        const { next_video_num } = await nextResp.json();
        let nextVideo = next_video_num;

        currentActionRef.current = action;

        setCollectingState({
            isCollecting: true,
            action,
            videoNum: nextVideo,
            frameNum: 0,
        });

        const status = allStatus[action] || { target: VIDEOS_PER_ACTION };
        const TOTAL_VIDEOS = status.target;

        while (nextVideo <= TOTAL_VIDEOS && !stopRequested.current) {
            // Bắt đầu video
            const startResp = await collectionService.startCollection(action, nextVideo);
            if (!startResp) {
                // Nếu video đã tồn tại, tăng lên 1
                nextVideo += 1;
                continue;
            }

            const ok = await captureOneVideo(action, nextVideo);
            if (!ok) break;

            nextVideo += 1;
            setCollectingState((prev) => ({
                ...prev,
                videoNum: nextVideo,
                frameNum: 0,
            }));

            await loadAllStatus();

            if (nextVideo > TOTAL_VIDEOS) {
                console.log(`[Collect] All ${TOTAL_VIDEOS} videos done for ${action}`);
                break;
            }
        }
    } catch (err) {
        console.error('runAllVideos error:', err);
    } finally {
        lockedRef.current = false;
        setCollectingState((prev) => ({ ...prev, isCollecting: false }));
        loadAllStatus();
    }
  };

  const handleCameraReady = useCallback(() => {
    cameraReady.current = true;
    if (collectingRef.current.isCollecting && !lockedRef.current) {
      runAllVideos(currentActionRef.current);
    }
  }, []);

  const handleStartCollection = async (action: string) => {
      setError(null);

      // Lấy số video tiếp theo
      const nextResp = await fetch(`http://localhost:8000/data-collection/next-video/${action}`);
      if (!nextResp.ok) {
          setError('Failed to get next video number');
          return;
      }
      const { next_video_num } = await nextResp.json();

      const status = allStatus[action] || { target: VIDEOS_PER_ACTION };
      const TOTAL_VIDEOS = status.target;
      targetVideosRef.current = TOTAL_VIDEOS;

      if (status.videos_collected >= TOTAL_VIDEOS) {
          setError(`"${action}" already complete.`);
          return;
      }

      currentActionRef.current = action;
      setCollectingState({
          isCollecting: true,
          action,
          videoNum: next_video_num,
          frameNum: 0,
      });

      if (cameraReady.current && !lockedRef.current) {
          runAllVideos(action);
      }
  };

  const handleCancelCollection = () => {
    stopRequested.current = true;
    setCollectingState((prev) => ({ ...prev, isCollecting: false }));
  };

  const handleStartTraining = async () => {
    setError(null);
    setIsTraining(true);
    try {
      await trainingService.startTraining();
      setTrainingStatus({ status: 'queued', message: 'Training queued...' });
    } catch (err) {
      console.error(err);
      setError('Failed to start training');
      setIsTraining(false);
    }
  };

  const handleCancelTraining = async () => {
    try {
      await trainingService.cancelTraining();
      setIsTraining(false);
      setTrainingStatus(null);
    } catch (err) {
      console.error(err);
    }
  };

  const canStartTraining = Object.values(allStatus).every(
    (s: any) => s.videos_collected >= s.target
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="collect" />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">Data Collection</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}

        {collectingState.isCollecting && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Recording: {collectingState.action}
              </h2>
              <span className="text-sm text-white/60">
                Video {collectingState.videoNum}/{targetVideosRef.current} · Frame{' '}
                {collectingState.frameNum}/{FRAMES_PER_VIDEO}
              </span>
            </div>

            <div className="h-2 bg-slate-700 rounded-full mb-5">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-100"
                style={{ width: `${(collectingState.frameNum / FRAMES_PER_VIDEO) * 100}%` }}
              />
            </div>

            <CameraView
              isRecording={true}
              mode="collection"
              onFrameDetected={handleFrameDetected}
              onCameraReady={handleCameraReady}
            />

            <div className="mt-4 flex justify-center">
              <button
                onClick={handleCancelCollection}
                className="px-5 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30"
              >
                Stop Collection
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(allStatus).map(([action, status]: [string, any]) => {
            const complete = status.videos_collected >= status.target;
            return (
              <div
                key={action}
                className="rounded-xl border border-white/10 bg-slate-900/40 p-3 flex flex-col items-center"
              >
                <span className="text-lg font-bold mb-1">{action}</span>
                <span className="text-xs text-white/50 mb-2">
                  {status.videos_collected}/{status.target}
                </span>
                <div className="w-full h-1.5 bg-slate-700 rounded-full mb-3">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${(status.videos_collected / status.target) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => handleStartCollection(action)}
                  disabled={complete || lockedRef.current}
                  className={`w-full py-1.5 rounded-lg text-sm font-medium transition ${
                    complete
                      ? 'bg-slate-700 text-white/40 cursor-not-allowed'
                      : lockedRef.current
                      ? 'bg-slate-700 text-white/40 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-white/90'
                  }`}
                >
                  {complete ? 'Complete' : 'Collect'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
          <h2 className="text-lg font-semibold mb-3">Model Training</h2>
          {trainingStatus ? (
            <div>
              <p className="text-sm text-white/70">Status: {trainingStatus.status}</p>
              <p className="text-sm text-white/70">Message: {trainingStatus.message}</p>
              {trainingStatus.accuracy && (
                <p className="text-sm text-white/70">
                  Accuracy: {(trainingStatus.accuracy * 100).toFixed(2)}%
                </p>
              )}
              {isTraining && (
                <button
                  onClick={handleCancelTraining}
                  className="mt-3 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200"
                >
                  Cancel Training
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleStartTraining}
              disabled={!canStartTraining}
              className="px-5 py-2 rounded-lg bg-white text-black disabled:bg-slate-700 disabled:text-white/40"
            >
              {canStartTraining ? 'Start Training' : 'Collect all videos first'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default Collect;