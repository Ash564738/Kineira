// src/pages/lessons.tsx
import React, { useState, useEffect } from 'react';
import TopNav from '../components/layout/TopNav';
import Button from '../components/layout/Button';
import { fetchLessons as fetchLessonsApi, fetchUserProgress } from '../services/api/client';
import { Lesson, Progress } from '../types/api';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, ArrowRight, Calendar, Target } from 'lucide-react';
import { useRouter } from 'next/router';
import { useTheme } from '../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius, effects } from '../styles/theme';
import { apiUrl } from '../services/api/config';
import ProtectedRoute from '../components/ProtectedRoute';
import PageState from '@/components/ui/PageState';

const LessonsContent: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const palette = themeColors[theme];

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [dailySign, setDailySign] = useState('');
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(user?.streak || 0);
  const [dailyReward, setDailyReward] = useState(0);
  const [dailyCanComplete, setDailyCanComplete] = useState(false);

  // Tải dữ liệu ban đầu
  useEffect(() => {
    if (!user) return;
    fetchDailyChallenge();
    loadAllData();
  }, [user]);

  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchDailyChallenge();
        fetchProgress();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  useEffect(() => {
    const handleRouteChange = () => {
      if (user) {
        fetchDailyChallenge();
        fetchProgress();
      }
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchLessons(), fetchProgress()]);
    } catch (e) {
      setError('Failed to load lessons. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyChallenge = async () => {
    if (!user) return;
    try {
      const res = await fetch(apiUrl(`/daily-challenge/sign?user_id=${user.id}`));
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
      const res = await fetch(apiUrl('/daily-challenge/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, sign: dailySign }),
      });
      if (res.ok) {
        const data = await res.json();
        setDailyCompleted(true);
        setDailyStreak(data.streak);
        setDailyReward(0);
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
    const data = await fetchLessonsApi();
    setLessons(data);
  };

  const fetchProgress = async () => {
    const data = await fetchUserProgress(user?.id || 1);
    setProgress(data);
  };

  const getProgressForLesson = (signId: number) => {
    return progress.find(p => p.sign_id === signId);
  };

  const getDifficultyColor = (level: string) => {
    const key = `badge${level.charAt(0).toUpperCase() + level.slice(1)}` as keyof typeof palette;
    return palette[key] || '';
  };

  const filteredLessons =
    filter === 'all' ? lessons : lessons.filter(l => l.difficulty.toLowerCase() === filter.toLowerCase());

  // Loading state
  if (loading) {
    return <PageState type="loading" message="Loading lessons..." />;
  }

  // Error state (có nút Retry)
  if (error) {
    return (
      <PageState
        type="error"
        message={error}
        onAction={loadAllData}
        actionLabel="Retry"
      />
    );
  }

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav active="lessons" />
      <main className={spacing.container}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>Sign Language Lessons</h1>
            <p className={`${palette.textMuted} mt-2`}>Structured practice sessions with measurable progress tracking.</p>
          </div>
        </div>

        {/* Daily Challenge Section */}
        {user && (
          <div className={`mb-10 ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} p-6 sm:p-8`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h2 className={`${typography.heading.sectionTitle} flex items-center gap-2 ${palette.textPrimary}`}>
                  <Calendar size={28} className={palette.textPrimary} />
                  Daily Challenge
                </h2>
                <p className={`${palette.textMuted} mt-1`}>Complete today's sign to maintain your streak</p>
              </div>
              <div className="flex gap-4 items-center">
                <div className={`${borderRadius.button} border ${palette.cardBorder} px-4 py-3 text-center`}>
                  <p className={`${typography.body.small} ${palette.textMuted}`}>Streak</p>
                  <p className={`text-2xl font-bold ${palette.textPrimary}`}>{dailyStreak} days</p>
                </div>
                <div className={`${borderRadius.button} border ${palette.cardBorder} px-4 py-3 text-center`}>
                  <p className={`${typography.body.small} ${palette.textMuted}`}>Reward</p>
                  <p className={`text-2xl font-bold ${palette.textPrimary}`}>+{dailyReward} XP</p>
                </div>
              </div>
            </div>
            <div className={`mt-6 ${borderRadius.card} border ${palette.cardBorder} p-6 flex flex-col items-center`}>
              <p className={`${typography.body.small} ${palette.textMuted} mb-3`}>Today's Sign</p>
              <p className={`text-5xl sm:text-6xl font-bold ${palette.textPrimary}`}>{dailySign}</p>
              {!dailyCompleted ? (
                <div className="flex flex-col items-center gap-3">
                  {!dailyCanComplete ? (
                    <>
                      <p className={`text-sm ${palette.textMuted}`}>
                        Practice <strong className={palette.textPrimary}>{dailySign}</strong> in a lesson first, then come back!
                      </p>
                      <Button
                        variant="primary"
                        href={`/practice/${lessons.find(l => l.reference_sign === dailySign)?.id || 1}`}
                        className="mt-6 gap-2"
                      >
                        Practice {dailySign}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleDailyComplete}
                      className="mt-6 gap-2"
                    >
                      <Trophy size={18} /> Mark as Complete
                    </Button>
                  )}
                </div>
              ) : (
                <div className={`mt-6 font-semibold flex items-center gap-2 ${palette.textPrimary}`}>
                  <Trophy size={18} className={palette.textPrimary} /> Completed! Come back tomorrow.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz Section */}
        <div className={`mb-10 ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4`}>
          <div>
            <h2 className={`${typography.heading.sectionTitle} flex items-center gap-2 ${palette.textPrimary}`}>
              <Target size={28} className={palette.textPrimary} />
              Quiz Challenge
            </h2>
            <p className={`${palette.textMuted} mt-1`}>Test your knowledge and earn XP</p>
          </div>
          <Button variant="primary" href="/quiz" className="gap-2">
            Start Quiz <ArrowRight size={18} />
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8">
          <div className={`inline-flex ${borderRadius.tabGroup} border ${palette.tabGroupBorder} ${palette.tabGroupBg} p-1`}>
            {['all', 'beginner', 'intermediate', 'advanced'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center ${borderRadius.badge} ${spacing.tabPadding} text-sm font-medium ${effects.transition} ${
                  filter === f
                    ? `${palette.tabActiveBg} ${palette.tabActiveText}`
                    : `${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText}`
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Lesson Cards */}
        {filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredLessons.map((lesson) => {
              const lessonProgress = getProgressForLesson(lesson.sign_id);
              return (
                <div
                  key={lesson.id}
                  className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} transition`}
                >
                  <div className="flex justify-between items-start mb-5">
                    <h3 className={`${typography.heading.cardTitle} ${palette.textPrimary}`}>{lesson.title}</h3>
                    <span className={`${borderRadius.badge} px-3 py-1 text-xs font-medium border ${getDifficultyColor(lesson.difficulty)}`}>
                      {lesson.difficulty}
                    </span>
                  </div>
                  <p className={`${typography.body.normal} ${palette.textMuted} mb-5`}>{lesson.description}</p>
                  {lessonProgress && (
                    <div className="mb-5">
                      <div className={`flex justify-between ${typography.body.small} ${palette.textMuted} mb-2`}>
                        <span>Best Score</span>
                        <span className={palette.textPrimary}>{lessonProgress.best_score.toFixed(0)}%</span>
                      </div>
                      <div className={`h-2 ${borderRadius.progress} ${palette.progressTrackBg} overflow-hidden`}>
                        <div
                          className={`h-full ${borderRadius.progress} ${palette.progressFillBg}`}
                          style={{ width: `${lessonProgress.best_score}%` }}
                        />
                      </div>
                      <div className={`mt-2 ${typography.body.small} ${palette.textMuted}`}>
                        {lessonProgress.attempts_count} attempts {lessonProgress.completed ? '• completed' : ''}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="primary"
                    href={`/practice/${lesson.id}`}
                    className="w-full justify-center"
                  >
                    {lessonProgress?.completed ? 'Review Lesson' : 'Start Lesson'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
            <div className = {`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} p-12 text-center`}>
              <p className={`text-lg ${palette.textMuted}`}>No lessons available for this filter.</p>
              <p className={`text-sm ${palette.textMuted} mt-2`}>Try selecting a different difficulty level.</p>
            </div>
        )}
      </main>
    </div>
  );
};

const LessonsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <LessonsContent />
    </ProtectedRoute>
  );
};

export default LessonsPage;