import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import CameraView from '../../components/camera/CameraView';
import { FrameLandmarks } from '../../types/landmarks';
import TopNav from '../../components/layout/TopNav';
import { Lesson, ScoringResult } from '../../types/api';
import { fetchLesson as fetchLessonApi, saveAttempt, scoreSign } from '../../services/api/client';

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

      const payload = sequence.map(frame => ({
        left_hand: frame.left_hand || [],
        right_hand: frame.right_hand || [],
        pose: frame.pose || [],
        face: frame.face || []
      }));

      console.log('[PracticeLesson] Prepared scoring payload metadata:', {
        payloadFrames: payload.length,
        referenceSign: lesson.reference_sign || 'a'
      });

      const result = await scoreSign(payload, lesson.reference_sign || 'a', 'alphabet');
      console.log('[PracticeLesson] Scoring result payload:', result);
      setScoringResult(result);
      setAttempts(prev => prev + 1);
      await persistAttempt(result.score, result.feedback);
    } catch (error) {
      console.error('[PracticeLesson] API call failed:', error);
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