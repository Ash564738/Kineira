import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import CameraView from '../components/camera/CameraView';
import { FrameLandmarks, N_POSE, N_FACE, N_HAND } from '../types/landmarks';
import TopNav from '../components/layout/TopNav';
import { Lesson, ScoringResult } from '../types/api';
import { fetchLesson as fetchLessonApi, saveAttempt, scoreGesture } from '../services/api/client';

console.log('[PracticeLesson] Module initialized');

const PracticeLesson: React.FC = () => {
  console.log('[PracticeLesson] Component render cycle started at timestamp:', new Date().toISOString());

  const router = useRouter();
  const { lessonId } = router.query;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [landmarksBuffer, setLandmarksBuffer] = useState<FrameLandmarks[]>([]);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [frameCount, setFrameCount] = useState(0);
  const [attempts, setAttempts] = useState<number>(0);

  const framesRef = useRef<FrameLandmarks[]>([]);
  const sendingRef = useRef(false);

  console.log('[PracticeLesson] Current state snapshot:', {
    lessonId,
    hasLesson: !!lesson,
    isRecording,
    loading,
    frameCount,
    attempts,
    landmarksBufferLength: landmarksBuffer.length,
    sending: sendingRef.current
  });

  useEffect(() => {
    console.log('[PracticeLesson] lessonId dependency changed:', lessonId);
    try {
      if (lessonId) {
        fetchLesson();
      }
    } catch (effectError) {
      console.error('[PracticeLesson] useEffect fetchLesson failure:', effectError);
    }
  }, [lessonId]);

  const fetchLesson = async () => {
    console.log('[PracticeLesson] fetchLesson invoked for lessonId:', lessonId);
    try {
      const lessonData = await fetchLessonApi(lessonId as string);
      console.log('[PracticeLesson] Lesson payload received:', lessonData);
      setLesson(lessonData);
    } catch (error) {
      console.error('[PracticeLesson] Failed to fetch lesson:', error);
    } finally {
      console.log('[PracticeLesson] fetchLesson completed, updating loading state to false');
      setLoading(false);
    }
  };

  const handleLandmarksDetected = (frame: FrameLandmarks) => {
    console.log('[PracticeLesson] handleLandmarksDetected called:', {
      isRecording,
      currentBufferedFrames: framesRef.current.length
    });

    try {
      if (!isRecording) {
        console.log('[PracticeLesson] Ignoring frame because recording is disabled');
        return;
      }

      framesRef.current.push(frame);
      setLandmarksBuffer([...framesRef.current]);
      setFrameCount(framesRef.current.length);

      console.log('[PracticeLesson] Frame appended successfully:', {
        updatedFrameCount: framesRef.current.length
      });

      if (framesRef.current.length >= 30 && !sendingRef.current) {
        console.log('[PracticeLesson] Frame threshold reached, sending sequence to API');
        sendToAPI([...framesRef.current]);
      }
    } catch (error) {
      console.error('[PracticeLesson] handleLandmarksDetected processing error:', error);
    }
  };

  // Helper function to convert FrameLandmarks array to flat keypoint arrays
  const convertFramesToKeypoints = (frames: FrameLandmarks[]): number[][] => {
    return frames.map(frame => {
      const keypoints: number[] = [];
      
      // Pose: 33 points × 4 (x, y, z, visibility)
      for (let i = 0; i < N_POSE; i++) {
        const p = frame.pose[i] || { x: 0, y: 0, z: 0, visibility: 0 };
        keypoints.push(p.x, p.y, p.z, p.visibility ?? 0);
      }
      
      // Face: 478 points × 3 (x, y, z)
      for (let i = 0; i < N_FACE; i++) {
        const p = frame.face[i] || { x: 0, y: 0, z: 0 };
        keypoints.push(p.x, p.y, p.z);
      }
      
      // Left hand: 21 points × 3 (x, y, z)
      for (let i = 0; i < N_HAND; i++) {
        const p = frame.left_hand[i] || { x: 0, y: 0, z: 0 };
        keypoints.push(p.x, p.y, p.z);
      }
      
      // Right hand: 21 points × 3 (x, y, z)
      for (let i = 0; i < N_HAND; i++) {
        const p = frame.right_hand[i] || { x: 0, y: 0, z: 0 };
        keypoints.push(p.x, p.y, p.z);
      }
      
      return keypoints;
    });
  };

  const sendToAPI = async (sequence: FrameLandmarks[]) => {
    console.log('[PracticeLesson] sendToAPI invoked with sequence length:', sequence.length);

    if (sendingRef.current || !lesson) {
      console.warn('[PracticeLesson] sendToAPI blocked:', {
        sendingInProgress: sendingRef.current,
        hasLesson: !!lesson
      });
      return;
    }

    try {
      sendingRef.current = true;
      console.log('[PracticeLesson] sendingRef set to true before request execution');
      console.log('=' + '='.repeat(50));
      console.log('[SCORING_FLOW] SCORING PROCESS STARTED');
      console.log('=' + '='.repeat(50));

      // Convert FrameLandmarks to flat keypoint arrays
      console.log('[SCORING_FLOW] Converting landmarks to keypoints...');
      const userSequence = convertFramesToKeypoints(sequence);
      console.log('[SCORING_FLOW] User sequence converted - length:', userSequence.length, 'frames');
      
      // Create reference sequence (zeros for now - would be ideal gesture in production)
      // TODO: In production, load ideal gesture from training data
      console.log('[SCORING_FLOW] Creating reference sequence (placeholder zeros)...');
      const referenceSequence = Array(30).fill(0).map(() => 
        Array(1692).fill(0)
      );
      console.log('[SCORING_FLOW] Reference sequence created - length:', referenceSequence.length, 'frames');

      console.log('[SCORING_FLOW] Prepared scoring sequences:', {
        userSequenceLength: userSequence.length,
        referenceSequenceLength: referenceSequence.length,
        userKeypointsDim: userSequence[0]?.length || 0,
        referenceKeypointsDim: referenceSequence[0]?.length || 0
      });

      console.log('[SCORING_FLOW] Calling scoreGesture API...');
      const result = await scoreGesture(userSequence, referenceSequence);
      console.log('[SCORING_FLOW] Scoring result payload:', result);
      console.log('[SCORING_FLOW] Score:', result.score, '- Feedback:', result.feedback);
      console.log('[SCORING_FLOW] Metrics - Accuracy:', result.accuracy, 'Completeness:', result.completeness, 'Timing:', result.timing);
      console.log('=' + '='.repeat(50));
      console.log('[SCORING_FLOW] SCORING PROCESS COMPLETED');
      console.log('=' + '='.repeat(50));
      
      setScoringResult(result);
      setAttempts(prev => prev + 1);
      await persistAttempt(result.score, result.feedback);
    } catch (error) {
      console.error('[SCORING_FLOW] SCORING PROCESS FAILED:', error);
      console.error('[PracticeLesson] API call failed:', error);
      console.log('=' + '='.repeat(50));
      console.log('[SCORING_FLOW] SCORING PROCESS FAILED');
      console.log('=' + '='.repeat(50));
    } finally {
      console.log('[PracticeLesson] sendToAPI completed, resetting sendingRef to false');
      sendingRef.current = false;
    }
  };

  const persistAttempt = async (attemptScore: number, attemptFeedback: string) => {
    console.log('[PracticeLesson] saveAttempt invoked:', {
      attemptScore,
      attemptFeedback
    });

    try {
      await saveAttempt(1, {
        lesson_id: parseInt(lessonId as string, 10),
        sign_id: lesson?.sign_id || 0,
        score: attemptScore,
        feedback: attemptFeedback
      });
    } catch (error) {
      console.error('[PracticeLesson] Failed to save attempt:', error);
    }
  };

  const toggleRecording = () => {
    console.log('[PracticeLesson] toggleRecording triggered:', {
      currentlyRecording: isRecording,
      bufferedFrames: framesRef.current.length
    });

    try {
      if (isRecording) {
        if (framesRef.current.length >= 10) {
          console.log('[PracticeLesson] Stopping recording and sending remaining buffered frames');
          sendToAPI([...framesRef.current]);
        }
      } else {
        console.log('[PracticeLesson] Resetting state for fresh recording session');
        framesRef.current = [];
        setLandmarksBuffer([]);
        setFrameCount(0);
        setScoringResult(null);
      }

      setIsRecording(!isRecording);
    } catch (error) {
      console.error('[PracticeLesson] toggleRecording error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-8 shadow-2xl">
          <div className="text-lg font-medium text-white/70">Loading lesson...</div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-10 py-8 shadow-2xl">
          <div className="text-lg font-medium text-red-300">Lesson not found</div>
        </div>
      </div>
    );
  }

  const signLetter = lesson.title.match(/Letter ([A-Z])/)?.[1] || lesson.reference_sign?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="lessons" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold">{lesson.title}</h2>
            <p className="text-white/50 mt-2">{lesson.description}</p>
          </div>
          <Link
            href="/lessons"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10 transition"
          >
            Back to Lessons
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-7xl font-bold">{signLetter}</div>
              <p className="text-white/50 mt-2">Target sign</p>
              <p className="text-white/35 text-sm mt-1">Attempts: {attempts}</p>
            </div>

            {/* @ts-ignore: CameraView props may differ; passing handler for landmarks detection */}
            <CameraView onLandmarksDetected={handleLandmarksDetected} isRecording={isRecording} />

            <div className="mt-6 flex justify-center">
              <button
                onClick={toggleRecording}
                className={`min-w-[220px] rounded-2xl px-8 py-4 font-medium transition ${
                  isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            </div>

            {isRecording && (
              <div className="mt-4 text-center text-sm text-red-300">
                Recording in progress — {frameCount} frames captured
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <h3 className="text-xl font-semibold mb-6">Evaluation</h3>

            {scoringResult ? (
              <>
                <div className="text-center mb-8">
                  <div className="text-6xl font-bold">{scoringResult.score.toFixed(0)}%</div>
                  <p className="text-white/60 mt-3">{scoringResult.feedback}</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-black/20 p-4 flex justify-between">
                    <span className="text-white/50">Accuracy</span>
                    <span>{scoringResult.details.accuracy.toFixed(0)}%</span>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-4 flex justify-between">
                    <span className="text-white/50">Completeness</span>
                    <span>{scoringResult.details.completeness.toFixed(0)}%</span>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-4 flex justify-between">
                    <span className="text-white/50">Timing</span>
                    <span>{scoringResult.details.timing.toFixed(0)}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
                Start a recording to generate scoring data.
              </div>
            )}

            <div className="mt-8 border-t border-white/10 pt-6">
              <h4 className="text-sm font-semibold text-white/70 mb-3">Practice notes</h4>
              <ul className="space-y-2 text-sm text-white/45">
                <li>Keep your hand inside the camera frame.</li>
                <li>Use stable lighting to improve tracking.</li>
                <li>Hold the gesture briefly before moving.</li>
                <li>Repeat several times for a better average score.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PracticeLesson;