// pages/lessons.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import TopNav from '../components/layout/TopNav';
import { fetchLessons as fetchLessonsApi, fetchUserProgress } from '../services/api/client';
import { Lesson, Progress } from '../types/api';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, Star, Trophy, ArrowRight, Calendar, Target } from 'lucide-react';

const Lessons: React.FC = () => {
  const { user, refreshUser } = useAuth(); // lấy thêm refreshUser
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  // Daily Challenge state
  const [dailySign, setDailySign] = useState('');
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(user?.streak || 0);
  const [dailyReward, setDailyReward] = useState(0);
  const [dailyCanComplete, setDailyCanComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchDailyChallenge();
    fetchLessons();
    fetchProgress();
  }, [user]); // phụ thuộc user

  const fetchDailyChallenge = async () => {
      if (!user) return;
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/daily-challenge/sign?user_id=${user.id}`);
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          setDailySign(data.sign);
          setDailyCompleted(data.completed);
          setDailyStreak(data.streak);
          setDailyReward(data.reward_xp);
          setDailyCanComplete(data.can_complete);
      } catch (err) {
          console.error('Daily challenge error:', err);
      }
  };

  const handleDailyComplete = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/daily-challenge/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, sign: dailySign }),
      });
      if (res.ok) {
        const data = await res.json();
        setDailyCompleted(true);
        setDailyStreak(data.streak);
        setDailyReward(0);
        // Làm mới thông tin user (XP, level, streak) trên toàn app
        await refreshUser();
      } else {
        const errData = await res.json();
        console.error(errData.detail);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const fetchLessons = async () => {
    try {
      const data = await fetchLessonsApi();
      setLessons(data);
    } catch (error) {
      console.error('Failed to fetch lessons:', error);
    }
  };

  const fetchProgress = async () => {
    try {
      const data = await fetchUserProgress(user?.id || 1);
      setProgress(data);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressForLesson = (signId: number) => {
    return progress.find(p => p.sign_id === signId);
  };

  const getDifficultyColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
      case 'intermediate':
        return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
      case 'advanced':
        return 'bg-orange-500/10 text-orange-300 border border-orange-500/20';
      case 'expert':
        return 'bg-rose-500/10 text-rose-300 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 border border-slate-500/20';
    }
  };

  const filteredLessons =
    filter === 'all'
      ? lessons
      : lessons.filter(l => l.difficulty.toLowerCase() === filter.toLowerCase());

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-8 shadow-2xl">
          <div className="text-lg font-medium text-white/70">Loading lessons...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="lessons" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-semibold">Sign Language Lessons</h1>
            <p className="text-white/50 mt-2">Structured practice sessions with measurable progress tracking.</p>
          </div>
        </div>

        {/* Daily Challenge Section */}
        {user && (
          <div className="mb-10 rounded-3xl border border-white/10 bg-slate-900/80 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="text-orange-400" size={28} />
                  Daily Challenge
                </h2>
                <p className="text-white/50 mt-1">Complete today's sign to maintain your streak</p>
              </div>
                <div className="flex gap-4 items-center">
                    <div className="bg-white/5 rounded-xl px-4 py-3 text-center">
                        <p className="text-white/60 text-sm">Streak</p>
                        <p className="text-2xl font-bold text-orange-400">{dailyStreak} days</p>
                    </div>
                    <div className="bg-white/5 rounded-xl px-4 py-3 text-center">
                        <p className="text-white/60 text-sm">Reward</p>
                        <p className="text-2xl font-bold text-yellow-400">+{dailyReward} XP</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col items-center">
              <p className="text-white/60 text-sm mb-3">Today's Sign</p>
              <p className="text-5xl sm:text-6xl font-bold text-white">{dailySign}</p>
                {!dailyCompleted ? (
                    <div className="flex flex-col items-center gap-3">
                        {!dailyCanComplete ? (
                            <>
                                <p className="text-yellow-400 text-sm">
                                    Practice <strong>{dailySign}</strong> in a lesson first, then come back!
                                </p>
                                <Link
                                    href={`/practice/${lessons.find(l => l.reference_sign === dailySign)?.id || 1}`}
                                    className="px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition"
                                >
                                    Practice {dailySign}
                                </Link>
                            </>
                        ) : (
                            <button
                                onClick={handleDailyComplete}
                                className="mt-6 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition flex items-center gap-2"
                            >
                                <Trophy size={18} /> Mark as Complete
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="mt-6 text-green-400 font-semibold flex items-center gap-2">
                        <Trophy size={18} /> Completed! Come back tomorrow.
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Quiz Section */}
        <div className="mb-10 rounded-3xl border border-white/10 bg-slate-900/80 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="text-yellow-400" size={28} />
              Quiz Challenge
            </h2>
            <p className="text-white/50 mt-1">Test your knowledge and earn XP</p>
          </div>
          <Link
            href="/quiz"
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition flex items-center gap-2"
          >
            Start Quiz <ArrowRight size={18} />
          </Link>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          {['all', 'beginner', 'intermediate', 'advanced'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-2xl px-5 py-2 text-sm font-medium transition ${
                filter === f
                  ? 'bg-white text-slate-950'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Lesson Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => {
            const lessonProgress = getProgressForLesson(lesson.sign_id);
            return (
              <div
                key={lesson.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl hover:bg-white/[0.07] transition"
              >
                <div className="flex justify-between items-start mb-5">
                  <h3 className="text-xl font-semibold">{lesson.title}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getDifficultyColor(lesson.difficulty)}`}>
                    {lesson.difficulty}
                  </span>
                </div>

                <p className="text-sm leading-6 text-white/55 mb-5">{lesson.description}</p>

                {lessonProgress && (
                  <div className="mb-5">
                    <div className="flex justify-between text-sm text-white/50 mb-2">
                      <span>Best Score</span>
                      <span className="text-white">{lessonProgress.best_score.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: `${lessonProgress.best_score}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-white/35">
                      {lessonProgress.attempts_count} attempts {lessonProgress.completed ? '• completed' : ''}
                    </div>
                  </div>
                )}

                <Link
                  href={`/practice/${lesson.id}`}
                  className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm font-medium hover:bg-black/30 transition"
                >
                  {lessonProgress?.completed ? 'Review Lesson' : 'Start Lesson'}
                </Link>
              </div>
            );
          })}
        </div>

        {filteredLessons.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center mt-10">
            <p className="text-lg text-white/45">No lessons available for this filter.</p>
            <p className="text-sm text-white/25 mt-2">Try selecting a different difficulty level.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Lessons;