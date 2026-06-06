// src/pages/practice/[lessonId].tsx
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import CameraView from '../../components/camera/CameraView';
import Button from '../../components/layout/Button';
import { FRAMES_PER_VIDEO, FEATURE_SIZE, FrameSample } from '../../types/landmarks';
import TopNav from '../../components/layout/TopNav';
import { Lesson } from '../../types/api';
import { fetchLesson as fetchLessonApi, saveAttempt, scoreGesture } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import AICoachFeedback from './AICoachFeedback';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius } from '../../styles/theme';

const PracticeLesson: React.FC = () => {
  const router = useRouter();
  const { lessonId } = router.query;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [keypointBuffer, setKeypointBuffer] = useState<number[][]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, refreshUser } = useAuth();
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);
  const [aiCallCount, setAiCallCount] = useState(0);

  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentEvaluationRef = useRef<any>(null);
  const [evalTimestamp, setEvalTimestamp] = useState(0);

  const { theme } = useTheme();
  const palette = themeColors[theme];

  useEffect(() => {
    if (lessonId) {
      fetchLessonApi(lessonId as string)
        .then(setLesson)
        .catch(() => setError('Failed to load lesson'))
        .finally(() => setLoading(false));
    }
  }, [lessonId]);

  const handleFrameDetected = (sample: FrameSample) => {
    if (!isRecording) return;
    if (isWaitingForAI) return;
    if (sample.keypoints.length !== FEATURE_SIZE) return;
    setKeypointBuffer(prev => [...prev, sample.keypoints]);
  };

  useEffect(() => {
    if (isRecording && keypointBuffer.length >= FRAMES_PER_VIDEO && !isWaitingForAI) {
      const sequence = keypointBuffer.slice(0, FRAMES_PER_VIDEO);
      evaluateGesture(sequence);
      setKeypointBuffer([]);
    }
  }, [keypointBuffer, isRecording, isWaitingForAI]);

  const evaluateGesture = async (sequence: number[][]) => {
    if (!lesson || !user) return;
    try {
      const result = await scoreGesture(sequence, lesson.reference_sign?.toUpperCase() || 'A');
      setEvaluation(result);
      setLastEvaluation(result);
      currentEvaluationRef.current = result;

      await saveAttempt(user.id, {
        lesson_id: lesson.id,
        sign_id: lesson.sign_id,
        score: result.score,
        feedback: result.feedback,
      }).catch(console.error);

      await refreshUser();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setKeypointBuffer([]);
      if (lastEvaluation && user) {
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

  if (loading) return (
    <div className={`min-h-screen ${palette.pageBg} flex items-center justify-center`}>
      <p className={palette.textMuted}>Loading...</p>
    </div>
  );
  if (!lesson) return (
    <div className={`min-h-screen ${palette.pageBg} flex items-center justify-center`}>
      <p className={palette.textMuted}>Lesson not found</p>
    </div>
  );

  const videoUrl = lesson?.reference_video_url
    ? `http://localhost:8000${lesson.reference_video_url}`
    : undefined;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav active="lessons" />
      <main className={spacing.container}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>{lesson.title}</h2>
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
            <div className="flex justify-center mt-4">
              <Button
                variant={isRecording ? 'danger' : 'primary'}
                onClick={toggleRecording}
              >
                {isRecording ? 'Stop' : 'Start Recording'}
              </Button>
            </div>
          </section>

          {/* Cột phải */}
          <section className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
            <h3 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-6`}>Evaluation</h3>
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
                    <span className={palette.textPrimary}>{evaluation.hand_similarity.toFixed(1)}%</span>
                  </div>
                  {Object.entries(evaluation.finger_details || {}).map(([finger, info]: any) => {
                    const simValue = info.similarity;
                    // FIX: cho phép gán các literal khác nhau bằng cách khai báo kiểu string
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
                    onAiResponse={() => {
                      setIsWaitingForAI(false);
                      setKeypointBuffer([]);
                      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
                    }}
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

export default PracticeLesson;