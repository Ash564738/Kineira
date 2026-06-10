// src/pages/practice/[lessonId].tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import CameraView from '../../components/camera/CameraView';
import Button from '../../components/layout/Button';
import { FRAMES_PER_VIDEO, FEATURE_SIZE, FrameSample } from '../../types/landmarks';
import TopNav from '../../components/layout/TopNav';
import { Lesson } from '../../types/api';
import { fetchLesson as fetchLessonApi, saveAttempt, scoreGesture } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import AICoachFeedback from '../../components/practice/AICoachFeedback';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius } from '../../styles/theme';
import { apiUrl } from '../../services/api/config';
import ProtectedRoute from '../../components/ProtectedRoute';
import PageState from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastProvider';

const PracticeContent: React.FC = () => {
  const router = useRouter();
  const { lessonId } = router.query;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [keypointBuffer, setKeypointBuffer] = useState<number[][]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { user, refreshUser } = useAuth();
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [evalTimestamp, setEvalTimestamp] = useState(0);
  const currentEvaluationRef = useRef<any>(null);
  const [continuousMode, setContinuousMode] = useState(false);
  const { theme } = useTheme();
  const palette = themeColors[theme];
  const { showToast } = useToast();

  // Fetch lesson
  const loadLesson = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchLessonApi(lessonId as string);
      setLesson(data);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  // Frame detection
  const handleFrameDetected = useCallback((sample: FrameSample) => {
    if (!isRecording || isWaitingForAI) return;
    if (sample.keypoints.length !== FEATURE_SIZE) return;
    setKeypointBuffer(prev => [...prev, sample.keypoints]);
  }, [isRecording, isWaitingForAI]);

  // Auto-evaluate when buffer full
  useEffect(() => {
    if (isRecording && keypointBuffer.length >= FRAMES_PER_VIDEO && !isWaitingForAI) {
      setIsRecording(false);
      const sequence = keypointBuffer.slice(0, FRAMES_PER_VIDEO);
      setKeypointBuffer([]);
      evaluateAndCoach(sequence);
    }
  }, [keypointBuffer, isRecording, isWaitingForAI]);

  const evaluateAndCoach = async (sequence: number[][]) => {
    if (!lesson || !user) return;
    setIsWaitingForAI(true);
    try {
      const result = await scoreGesture(sequence, lesson.reference_sign?.toUpperCase() || 'A');
      setEvaluation(result);
      setLastEvaluation(result);
      currentEvaluationRef.current = result;
      setEvalTimestamp(Date.now());
      saveAttempt(user.id, {
        lesson_id: lesson.id,
        sign_id: lesson.sign_id,
        score: result.score,
        feedback: result.feedback,
      }).catch(console.error);
      await refreshUser();
    } catch (err: any) {
      showToast(err.message || 'Evaluation failed', 'error');
    } finally {
      // Không bỏ chặn ở đây, sẽ được bỏ chặn khi AI coach hoàn tất
    }
  };

  const handleAiCoachDone = useCallback(() => {
    setIsWaitingForAI(false);
    setKeypointBuffer([]);
    if (continuousMode) {
      setTimeout(() => setIsRecording(true), 3000);
    }
  }, [continuousMode]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setKeypointBuffer([]);
      if (lastEvaluation && user && !isWaitingForAI) {
        setIsWaitingForAI(true);
        setEvalTimestamp(Date.now());
      }
    } else {
      setEvaluation(null);
      setLastEvaluation(null);
      currentEvaluationRef.current = null;
      setIsRecording(true);
      setKeypointBuffer([]);
    }
  };

  // --- Trạng thái Loading ---
  if (loading) {
    return <PageState type="loading" message="Loading lesson..." />;
  }

  // --- Trạng thái Error (fetch) ---
  if (fetchError) {
    return (
      <PageState
        type="error"
        title="Failed to load lesson"
        message={fetchError}
        onAction={loadLesson}
        actionLabel="Retry"
      />
    );
  }

  // --- Trạng thái Empty (không có lesson) ---
  if (!lesson) {
    return (
      <PageState
        type="empty"
        title="Lesson not found"
        message="The lesson you are looking for does not exist."
      />
    );
  }

  const videoUrl = lesson?.reference_video_url
    ? apiUrl(lesson.reference_video_url)
    : undefined;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav active="lessons" />
      <main className={spacing.container}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>
              {lesson.title}
            </h2>
            <p className={`${palette.textMuted} mt-2`}>{lesson.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Cột trái */}
          <section className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
            <div className="flex justify-center mb-4">
              {videoUrl ? (
                <div className="relative mx-auto w-full max-w-[640px] aspect-[4/3]">
                  <video
                    src={videoUrl}
                    autoPlay loop muted
                    className={`w-full h-full object-cover ${borderRadius.button} border ${palette.cardBorder}`}
                    controls
                  />
                </div>
              ) : (
                <div className={`relative mx-auto w-full max-w-[640px] aspect-[4/3] ${borderRadius.button} border ${palette.cardBorder} ${palette.emptyStateBg} flex items-center justify-center`}>
                  <p className={palette.textMuted}>No reference video available.</p>
                </div>
              )}
            </div>
            <CameraView
              isRecording={isRecording}
              mode="collection"
              onFrameDetected={handleFrameDetected}
            />
            <div className="flex flex-col items-center gap-3 mt-4">
              <Button
                variant={isRecording ? 'danger' : 'primary'}
                onClick={toggleRecording}
                disabled={isWaitingForAI}
              >
                {isRecording ? 'Stop' : 'Start Recording'}
              </Button>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={continuousMode}
                  onChange={e => setContinuousMode(e.target.checked)}
                  className="accent-black dark:accent-[#BBE1FA]"
                />
                <span className={palette.textMuted}>
                  Continuous practice (auto‑restart after feedback)
                </span>
              </label>
            </div>
          </section>

          {/* Cột phải */}
          <section className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
            <h3 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-6`}>
              Evaluation
            </h3>
            {evaluation ? (
              <>
                <div className="text-center mb-6">
                  <div className={`text-6xl font-bold ${palette.textPrimary}`}>
                    {(evaluation.display_score ?? evaluation.score).toFixed(0)}%
                  </div>
                  <p className={`${palette.textMuted} mt-2`}>{evaluation.feedback}</p>
                </div>
                <div className="space-y-3">
                  <div className={`${borderRadius.item} ${palette.cardBg} border ${palette.cardBorder} ${spacing.itemPadding} flex justify-between`}>
                    <span className={palette.textMuted}>Hand Similarity</span>
                    <span className={palette.textPrimary}>
                      {evaluation.hand_similarity.toFixed(1)}%
                    </span>
                  </div>
                  {Object.entries(evaluation.finger_details || {}).map(([finger, info]: any) => {
                    const simValue = info.similarity;
                    let colorClass: string = palette.errorText;
                    if (simValue >= 0.9) colorClass = 'text-green-600';
                    else if (simValue >= 0.75) colorClass = 'text-amber-600';
                    return (
                      <div key={finger} className={`${borderRadius.item} ${palette.cardBg} border ${palette.cardBorder} ${spacing.itemPadding} flex justify-between`}>
                        <span className={`capitalize ${palette.textMuted}`}>{finger}</span>
                        <span className={colorClass}>
                          {(simValue * 100).toFixed(0)}% - {info.suggestion}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {user && currentEvaluationRef.current && (
                  <AICoachFeedback
                    userId={user.id}
                    score={evaluation.display_score ?? evaluation.score}
                    handSimilarity={currentEvaluationRef.current.hand_similarity / 100}
                    motionScore={(currentEvaluationRef.current.pose_similarity ?? 70) / 100}
                    bodyScore={(currentEvaluationRef.current.face_similarity ?? 80) / 100}
                    sign={lesson.reference_sign?.toUpperCase() || 'A'}
                    fingerDetails={currentEvaluationRef.current.finger_details}
                    resetKey={evalTimestamp}
                    onAiResponse={handleAiCoachDone}
                  />
                )}
              </>
            ) : (
              <div className={`${borderRadius.item} border border-dashed ${palette.cardBorder} p-10 text-center ${palette.textMuted}`}>
                Start recording to get evaluation.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

const PracticePage: React.FC = () => {
  return (
    <ProtectedRoute>
      <PracticeContent />
    </ProtectedRoute>
  );
};

export default PracticePage;