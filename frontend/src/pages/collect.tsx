// src/pages/collect.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraView from '../components/camera/CameraView';
import collectionService, { AllStatus } from '../services/api/collectionService';
import trainingService from '../services/api/trainingService';
import TopNav from '../components/layout/TopNav';
import { FEATURE_SIZE, FrameSample, VIDEOS_PER_ACTION, FRAMES_PER_VIDEO } from '../types/landmarks';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius, effects } from '../styles/theme';
import { apiUrl, getAuthHeaders } from '../services/api/config';
import ProtectedRoute from '../components/ProtectedRoute';
import PageState from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastProvider';

const STATUS_POLL_MS = 10000;
const MAX_WAIT_MS_PER_FRAME = 5000;
const VIDEOS_PER_HAND = 50;
const PAUSE_SECONDS = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CollectContent: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];
  const { showToast } = useToast();

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
  const [info, setInfo] = useState<string | null>(null);
  const [pauseCountdown, setPauseCountdown] = useState<number>(0);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [failedVideos, setFailedVideos] = useState<number[]>([]);

  const collectingRef = useRef(collectingState);
  collectingRef.current = collectingState;

  const latestSampleRef = useRef<FrameSample | null>(null);
  const cameraReady = useRef(false);
  const stopRequested = useRef(false);
  const lockedRef = useRef(false);
  const currentActionRef = useRef('');
  const targetVideosRef = useRef(50);
  const pauseResolveRef = useRef<(() => void) | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    loadAllStatus().finally(() => setLoadingStatus(false));
    const interval = setInterval(loadAllStatus, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (!isTraining || loadingStatus) return;  // chờ load xong mới poll
    const poll = setInterval(async () => {
      try {
        const s = await trainingService.getStatus();
        setTrainingStatus(s);
        if (s.status === 'completed' || s.status === 'failed') setIsTraining(false);
      } catch (e) { console.error(e); }
    }, 1000);
    return () => clearInterval(poll);
  }, [isTraining, loadingStatus]);

  async function loadAllStatus() {
    try {
      const status = await collectionService.getAllStatus();
      setAllStatus(status);
    } catch (err) {
      console.error('Status load error:', err);
    }
  };

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

  const pauseWithUI = (message: string, seconds: number, manualContinue = true): Promise<void> => {
    return new Promise((resolve) => {
      setInfo(message);
      setPauseCountdown(seconds);
      setShowContinueButton(manualContinue);

      if (seconds > 0) {
        const interval = setInterval(() => {
          setPauseCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              if (!manualContinue) {
                setInfo(null);
                setShowContinueButton(false);
                resolve();
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        pauseResolveRef.current = () => {
          clearInterval(interval);
          setInfo(null);
          setShowContinueButton(false);
          resolve();
        };
      } else {
        pauseResolveRef.current = () => {
          setInfo(null);
          setShowContinueButton(false);
          resolve();
        };
      }
    });
  };

  const waitForHandSwitch = (): Promise<void> => {
    return pauseWithUI(
      'Please switch hands to perform the gesture. Click "Ready" to continue.',
      0,
      true
    );
  };

  const pauseBetweenVideos = (videoNum: number): Promise<void> => {
    return pauseWithUI(
      `Please take a break after video ${videoNum}. Continuing in ${PAUSE_SECONDS}s...`,
      PAUSE_SECONDS,
      true
    );
  };

  const handleContinuePause = () => {
    pauseResolveRef.current?.();
  };

  const captureOneVideo = async (action: string, videoNum: number): Promise<boolean> => {
    console.log(`[Collect] Starting video ${videoNum} for ${action}`);
    const framesBuffer: { frame_num: number; keypoints: number[] }[] = [];

    for (let frameNum = 0; frameNum < FRAMES_PER_VIDEO; frameNum++) {
      if (stopRequested.current) return false;

      const sample = await waitForValidSample();
      if (!sample) {
        setError(`No valid keypoints for video ${videoNum}, frame ${frameNum}. This video will be retried later.`);
        console.warn(`[Collect] frame ${frameNum} invalid or timeout`);
        return false;
      }

      console.log(`[Frame ${frameNum}] keypoints length=${sample.keypoints.length}, first10=`, sample.keypoints.slice(0, 10));
      framesBuffer.push({ frame_num: frameNum, keypoints: sample.keypoints });
      setCollectingState((prev) => ({ ...prev, videoNum, frameNum: frameNum + 1 }));
    }

    try {
      console.log(`[Collect] Sending batch for action=${action}, video=${videoNum}`);
      const resp = await collectionService.saveFrameBatch(action, videoNum, framesBuffer);
      console.log('[Batch save response]', resp);
      return true;
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
      console.error('Batch save failed:', err);
      setError(`Batch save failed for video ${videoNum}: ${err.message}`);
      return false;
    }
  };

  const retryFailedVideos = async (action: string, failed: number[]) => {
    setError(null);
    setInfo(`${failed.length} failed video(s). Preparing to retry...`);
    for (const videoNum of failed) {
      if (stopRequested.current) break;
      await collectionService.deleteVideo(action, videoNum);
      const startOk = await collectionService.startCollection(action, videoNum, true);
      if (!startOk) {
        setError(`Cannot restart video ${videoNum}. Stopping retry.`);
        break;
      }
      setCollectingState(prev => ({ ...prev, isCollecting: true, videoNum, frameNum: 0 }));
      const ok = await captureOneVideo(action, videoNum);
      if (!ok) {
        setError(`Video ${videoNum} still failed after retry.`);
        break;
      }
      if (!stopRequested.current) await pauseWithUI(`Please take a break after video ${videoNum}.`, PAUSE_SECONDS, true);
      await loadAllStatus();
    }
    setInfo(null);
    setFailedVideos([]);
  };

  const runAllVideos = async (action: string) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    stopRequested.current = false;
    try {
      const status = allStatus[action] || { target: VIDEOS_PER_ACTION };
      const TOTAL_VIDEOS = status.target;
      targetVideosRef.current = TOTAL_VIDEOS;

      const nextResp = await fetch(apiUrl(`/data-collection/next-video/${action}`), {
        headers: getAuthHeaders(),
      });
      if (!nextResp.ok) throw new Error('Failed to get next video');
      const { next_video_num } = await nextResp.json();
      let nextVideo = next_video_num;

      currentActionRef.current = action;
      setCollectingState({ isCollecting: true, action, videoNum: nextVideo, frameNum: 0 });

      const failed: number[] = [];

      while (nextVideo <= TOTAL_VIDEOS && !stopRequested.current) {
        if (TOTAL_VIDEOS >= VIDEOS_PER_HAND * 2 && nextVideo === VIDEOS_PER_HAND + 1) {
          await waitForHandSwitch();
        }

        const startOk = await collectionService.startCollection(action, nextVideo, false);
        if (!startOk) {
          nextVideo++;
          continue;
        }

        const ok = await captureOneVideo(action, nextVideo);
        if (!ok) {
          failed.push(nextVideo);
        }

        if (!stopRequested.current && nextVideo < TOTAL_VIDEOS) {
          await pauseBetweenVideos(nextVideo);
        }

        nextVideo++;
        setCollectingState(prev => ({ ...prev, videoNum: nextVideo, frameNum: 0 }));
        await loadAllStatus();
      }

      if (failed.length > 0 && !stopRequested.current) {
        setFailedVideos(failed);
        await retryFailedVideos(action, failed);
      }

      if (nextVideo > TOTAL_VIDEOS) {
        console.log(`[Collect] All ${TOTAL_VIDEOS} videos done for ${action}`);
      }
    } catch (err) {
      console.error('runAllVideos error:', err);
      setError('Unexpected error in collection');
    } finally {
      lockedRef.current = false;
      setCollectingState(prev => ({ ...prev, isCollecting: false }));
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
    const nextResp = await fetch(apiUrl(`/data-collection/next-video/${action}`), {
      headers: getAuthHeaders(),
    });
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
    setCollectingState({ isCollecting: true, action, videoNum: next_video_num, frameNum: 0 });

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

  // ---------- Button classes using theme tokens ----------
  const cardActiveClass = `w-full py-1.5 ${borderRadius.button} text-sm font-medium ${effects.transition} ${palette.actionButtonBg} ${palette.actionButtonText} ${palette.actionButtonHoverBg} ${palette.actionButtonHoverText}`;
  const cardDisabledClass = `w-full py-1.5 ${borderRadius.button} text-sm font-medium ${effects.transition} ${palette.disabledButtonBg} ${palette.disabledButtonText} cursor-not-allowed`;

  const largeActiveClass = `px-5 py-3 ${borderRadius.button} font-semibold ${palette.actionButtonBg} ${palette.actionButtonText} ${palette.actionButtonHoverBg} ${palette.actionButtonHoverText} ${effects.transition}`;
  const largeDisabledClass = `px-5 py-3 ${borderRadius.button} font-semibold ${effects.transition} ${palette.disabledButtonBg} ${palette.disabledButtonText} cursor-not-allowed`;

  if (loadingStatus) {
    return <PageState type="loading" message="Loading collection status..." showNavSpace />;
  }

  // ========== JSX ==========
  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav active="collect" />
      <main className={spacing.container}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>Data Collection</h1>
            <p className={`${palette.textMuted} mt-2`}>Collect data for training sign language recognition models.</p>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className={`mb-4 p-4 ${borderRadius.smallBox} border ${palette.cardBorder} ${palette.errorText} ${palette.cardBg}`}>
            {error}
          </div>
        )}

        {/* Info / pause notification */}
        {info && (
          <div className={`mb-4 p-4 ${borderRadius.smallBox} border ${palette.cardBorder} ${palette.infoText} ${palette.cardBg} flex flex-col items-center`}>
            <p className="mb-3">{info}</p>
            {pauseCountdown > 0 && <p className="text-lg font-bold mb-2">{pauseCountdown}s</p>}
            {showContinueButton && (
              <button onClick={handleContinuePause} className={largeActiveClass}>
                Continue Now
              </button>
            )}
          </div>
        )}

        {/* Recording panel */}
        {collectingState.isCollecting && (
          <div className={`mb-8 ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`${typography.heading.cardTitle} ${palette.textPrimary}`}>
                Recording: {collectingState.action}
              </h2>
              <span className={`${typography.body.normal} ${palette.textMuted}`}>
                Video {collectingState.videoNum}/{targetVideosRef.current} · Frame{' '}
                {collectingState.frameNum}/{FRAMES_PER_VIDEO}
              </span>
            </div>

            <div className={`h-2 ${palette.progressTrackBg} rounded-full mb-5`}>
              <div
                className={`h-full rounded-full ${palette.progressFillBg} transition-all duration-100`}
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
              <button onClick={handleCancelCollection} className={largeActiveClass}>
                Stop Collection
              </button>
            </div>
          </div>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(allStatus).map(([action, status]: [string, any]) => {
            const complete = status.videos_collected >= status.target;
            return (
              <div
                key={action}
                className={`${borderRadius.item} border ${palette.cardBorder} ${palette.cardBg} ${spacing.itemPadding} flex flex-col items-center`}
              >
                <span className={`${typography.heading.cardTitle} ${palette.textPrimary} mb-1`}>{action}</span>
                <span className={`${typography.body.small} ${palette.textMuted} mb-2`}>
                  {status.videos_collected}/{status.target}
                </span>
                <div className={`w-full h-1.5 ${palette.progressTrackBg} rounded-full mb-3`}>
                  <div
                    className={`h-full rounded-full ${palette.progressFillBg} transition-all duration-300`}
                    style={{
                      width: `${(status.videos_collected / status.target) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => handleStartCollection(action)}
                  disabled={complete || lockedRef.current}
                  className={complete || lockedRef.current ? cardDisabledClass : cardActiveClass}
                >
                  {complete ? 'Complete' : 'Collect'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Training section */}
        <div className={`mt-10 ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
          <h2 className={`${typography.heading.cardTitle} ${palette.textPrimary} mb-3`}>Model Training</h2>
          {trainingStatus ? (
            <div>
              <p className={`${typography.body.normal} ${palette.textMuted}`}>Status: {trainingStatus.status}</p>
              <p className={`${typography.body.normal} ${palette.textMuted}`}>Message: {trainingStatus.message}</p>
              {trainingStatus.accuracy && (
                <p className={`${typography.body.normal} ${palette.textMuted}`}>
                  Accuracy: {(trainingStatus.accuracy * 100).toFixed(2)}%
                </p>
              )}
              {isTraining && (
                <button onClick={handleCancelTraining} className={`mt-3 ${largeActiveClass}`}>
                  Cancel Training
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleStartTraining}
              disabled={!canStartTraining}
              className={canStartTraining ? largeActiveClass : largeDisabledClass}
            >
              {canStartTraining ? 'Start Training' : 'Collect all videos first'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

const Collect: React.FC = () => {
  return (
    <ProtectedRoute requireAdmin>
      <CollectContent />
    </ProtectedRoute>
  );
};

export default Collect;