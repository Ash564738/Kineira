import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import TopNav from '../components/layout/TopNav';
import { fetchUserAttempts, fetchUserProgress } from '../services/api/client';
import { Attempt, Progress } from '../types/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

const ProgressPage: React.FC = () => {
  console.log('[ProgressPage] component render started');

  const [progress, setProgress] = useState<Progress[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading]);

  console.log('[ProgressPage] current state snapshot:', {
    progressLength: progress.length,
    attemptsLength: attempts.length,
    loading
  });

  useEffect(() => {
    console.log('[ProgressPage] useEffect mount triggered, starting fetchProgress and fetchAttempts');
    try {
      fetchProgress();
      fetchAttempts();
    } catch (error) {
      console.error('[ProgressPage] unexpected error inside mount effect:', error);
    }
  }, []);

  const fetchProgress = async () => {
    console.log('[ProgressPage] fetchProgress started');
    try {
      const data = await fetchUserProgress(1);
      console.log('[ProgressPage] fetchProgress raw response data:', data);

      const normalizedData = data.map((item) => ({
        ...item,
        completed: Boolean(item.completed)
      }));

      console.log('[ProgressPage] fetchProgress normalized data:', normalizedData);
      setProgress(normalizedData);
    } catch (error) {
      console.error('[ProgressPage] Failed to fetch progress:', error);
    }
  };

  const fetchAttempts = async () => {
    console.log('[ProgressPage] fetchAttempts started');
    try {
      const data = await fetchUserAttempts(1);
      console.log('[ProgressPage] fetchAttempts raw response data:', data);
      setAttempts(data);
    } catch (error) {
      console.error('[ProgressPage] Failed to fetch attempts:', error);
    } finally {
      console.log('[ProgressPage] fetchAttempts finished, setting loading to false');
      setLoading(false);
    }
  };

  const getOverallStats = () => {
    console.log('[ProgressPage] getOverallStats calculating with progress:', progress);

    try {
      const totalSigns = progress.length;
      const completedSigns = progress.filter((p) => p.completed).length;
      const totalAttempts = progress.reduce((sum, p) => sum + p.attempts_count, 0);
      const avgScore =
        progress.length > 0
          ? progress.reduce((sum, p) => sum + p.best_score, 0) / progress.length
          : 0;

      const calculatedStats = {
        totalSigns,
        completedSigns,
        totalAttempts,
        avgScore: Math.round(avgScore)
      };

      console.log('[ProgressPage] getOverallStats result:', calculatedStats);
      return calculatedStats;
    } catch (error) {
      console.error('[ProgressPage] getOverallStats failed:', error);
      return {
        totalSigns: 0,
        completedSigns: 0,
        totalAttempts: 0,
        avgScore: 0
      };
    }
  };

  const stats = getOverallStats();

  if (loading) {
    console.log('[ProgressPage] rendering loading screen');
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-8 shadow-2xl backdrop-blur-xl">
          <div className="text-xl font-medium text-white/70">Loading progress...</div>
        </div>
      </div>
    );
  }

  console.log('[ProgressPage] rendering main UI');

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="progress" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight">Your Progress</h2>
            <p className="mt-2 text-white/50">Detailed performance across your recent practice sessions.</p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            Back to Practice
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <p className="text-sm text-white/50">Total Signs</p>
            <p className="mt-3 text-4xl font-semibold">{stats.totalSigns}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <p className="text-sm text-white/50">Completed</p>
            <p className="mt-3 text-4xl font-semibold">{stats.completedSigns}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <p className="text-sm text-white/50">Attempts</p>
            <p className="mt-3 text-4xl font-semibold">{stats.totalAttempts}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <p className="text-sm text-white/50">Average Score</p>
            <p className="mt-3 text-4xl font-semibold">{stats.avgScore}%</p>
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <h3 className="mb-6 text-2xl font-semibold">Sign Progress</h3>

          <div className="space-y-4">
            {progress.map((item) => {
              console.log('[ProgressPage] rendering progress row:', item);

              return (
                <div
                  key={item.sign_id}
                  className="rounded-2xl border border-white/5 bg-black/20 p-5 transition hover:bg-black/30"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium">Sign {item.sign_id}</span>
                    <span className="text-sm text-white/45">{item.attempts_count} attempts</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="h-3 flex-1 rounded-full bg-white/10">
                      <div
                        className="h-3 rounded-full bg-white"
                        style={{ width: `${item.best_score}%` }}
                      ></div>
                    </div>

                    <span className="w-20 text-right text-lg font-semibold">
                      {item.best_score.toFixed(0)}%
                    </span>

                    {item.completed && <span className="text-sm text-white/60">Completed</span>}
                  </div>
                </div>
              );
            })}

            {progress.length === 0 && (
              <p className="py-10 text-center text-white/40">
                No progress yet. Start practicing to populate this dashboard.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <h3 className="mb-6 text-2xl font-semibold">Recent Attempts</h3>

          <div className="space-y-4">
            {attempts.slice(0, 10).map((attempt) => {
              console.log('[ProgressPage] rendering attempt row:', attempt);

              return (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-5 transition hover:bg-black/30"
                >
                  <div>
                    <div className="font-medium">
                      Lesson {attempt.lesson_id} - Sign {attempt.sign_id}
                    </div>
                    <div className="mt-1 text-sm text-white/40">
                      {attempt.created_at
                        ? new Date(attempt.created_at).toLocaleDateString()
                        : 'Just now'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-semibold">{attempt.score.toFixed(0)}%</div>
                    <div className="mt-1 text-sm text-white/50">{attempt.feedback}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {attempts.length === 0 && (
            <p className="py-10 text-center text-white/40">
              No attempts yet. Start practicing.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProgressPage;