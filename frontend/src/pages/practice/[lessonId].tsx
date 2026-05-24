// pages/[lessonId].tsx
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import CameraView from '../../components/camera/CameraView';
import { FrameLandmarks, N_POSE, N_FACE, N_HAND, FRAMES_PER_VIDEO, FEATURE_SIZE, FrameSample } from '../../types/landmarks';
import TopNav from '../../components/layout/TopNav';
import { Lesson, ScoringResult } from '../../types/api';
import { fetchLesson as fetchLessonApi, saveAttempt, scoreGesture } from '../../services/api/client';

const PracticeLesson: React.FC = () => {
  const router = useRouter();
  const { lessonId } = router.query;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [keypointBuffer, setKeypointBuffer] = useState<number[][]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load lesson
  useEffect(() => {
    if (lessonId) {
      fetchLessonApi(lessonId as string)
        .then(setLesson)
        .catch(() => setError('Failed to load lesson'))
        .finally(() => setLoading(false));
    }
  }, [lessonId]);

  // Nhận frame từ CameraView (FrameSample đã có keypoints 329)
  const handleFrameDetected = (sample: FrameSample) => {
    if (!isRecording) return;
    if (sample.keypoints.length !== FEATURE_SIZE) return;
    setKeypointBuffer(prev => [...prev, sample.keypoints]);
  };

  // Khi buffer đủ 30 frame, gửi evaluate
  useEffect(() => {
    if (isRecording && keypointBuffer.length >= FRAMES_PER_VIDEO) {
      const sequence = keypointBuffer.slice(0, FRAMES_PER_VIDEO);
      evaluateGesture(sequence);
      setKeypointBuffer([]);
    }
  }, [keypointBuffer, isRecording]);

  const evaluateGesture = async (sequence: number[][]) => {
    if (!lesson) return;
    try {
      const result = await scoreGesture(sequence, lesson.reference_sign?.toUpperCase() || 'A');
      setEvaluation(result);
      await saveAttempt(1, {
        lesson_id: lesson.id,
        sign_id: lesson.sign_id,
        score: result.score,
        feedback: result.feedback,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setKeypointBuffer([]);
    } else {
      setEvaluation(null);
      setIsRecording(true);
      setKeypointBuffer([]);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p>Loading...</p></div>;
  if (!lesson) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p>Lesson not found</p></div>;

  const videoUrl = lesson?.reference_video_url
  ? `http://localhost:8000${lesson.reference_video_url}`
  : undefined;
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="lessons" />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold">{lesson.title}</h2>
            <p className="text-white/50 mt-2">{lesson.description}</p>
          </div>
          <Link href="/lessons" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10 transition">
            Back to Lessons
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Cột trái: Camera + Video mẫu */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              { videoUrl ? (
                <video
                  src={videoUrl}
                  autoPlay loop muted
                  className="w-full max-w-xs rounded-xl border border-white/10"
                  controls
                />
              ) : (
                <p className="text-white/40">No reference video available.</p>
              )}
            </div>
            <CameraView
              isRecording={isRecording}
              mode="collection"
              onFrameDetected={handleFrameDetected}
            />
            <div className="flex justify-center mt-4">
              <button
                onClick={toggleRecording}
                className={`px-8 py-3 rounded-xl font-semibold ${
                  isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isRecording ? 'Stop' : 'Start Recording'}
              </button>
            </div>
          </section>

          {/* Cột phải: Kết quả đánh giá */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <h3 className="text-xl font-semibold mb-6">Evaluation</h3>
            {evaluation ? (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl font-bold">{evaluation.score.toFixed(0)}%</div>
                  <p className="text-white/60 mt-2">{evaluation.feedback}</p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-black/20 p-3 flex justify-between">
                    <span>Hand Similarity</span>
                    <span>{evaluation.hand_similarity.toFixed(1)}%</span>
                  </div>
                    {Object.entries(evaluation.finger_details).map(([finger, info]: any) => (
                      <div key={finger} className="rounded-2xl bg-black/20 p-3 flex justify-between">
                        <span className="capitalize">{finger}</span>
                        <span className={info.mean_distance < 0.05 ? 'text-green-400' : info.mean_distance < 0.1 ? 'text-yellow-400' : 'text-red-400'}>
                          {info.similarity.toFixed(2)} - {info.suggestion} (dist: {info.mean_distance?.toFixed(3)})
                        </span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
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