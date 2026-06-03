// pages/progress.tsx
import React, { useState, useEffect } from 'react';
import TopNav from '../components/layout/TopNav';
import { fetchUserAttempts, fetchUserProgress } from '../services/api/client';
import { Attempt, Progress } from '../types/api';
import { useAuth } from '@/contexts/AuthContext';
import Leaderboard from '../components/progress/leaderboard';
import ProgressAnalytics from '../components/progress/progress-analytics';
import { LayoutDashboard, BarChart3, Trophy, BookOpen, CheckCircle, Target, TrendingUp } from 'lucide-react';

const ProgressPage: React.FC = () => {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'leaderboard'>('overview');

  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    fetchProgress();
    fetchAttempts();
  }, [user]);

  const fetchProgress = async () => {
    try {
      const data = await fetchUserProgress(user?.id || 0);
      setProgress(data.map(item => ({ ...item, completed: Boolean(item.completed) })));
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const fetchAttempts = async () => {
    try {
      const data = await fetchUserAttempts(user?.id || 0);
      setAttempts(data);
    } catch (error) {
      console.error('Failed to fetch attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalSigns: progress.length,
    completedSigns: progress.filter(p => p.completed).length,
    totalAttempts: progress.reduce((sum, p) => sum + p.attempts_count, 0),
    avgScore: progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.best_score, 0) / progress.length)
      : 0,
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="mb-4">Please log in to view progress.</p>
          <a href="/auth/login" className="text-white underline underline-offset-4">Go to login</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-8 shadow-2xl">
          <div className="text-xl font-medium text-white/70">Loading progress...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="progress" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-semibold tracking-tight">Your Progress</h2>
          <p className="mt-2 text-white/50">Performance overview, analytics, and community ranking.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-3 mb-8">
          {['overview', 'analytics', 'leaderboard'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {tab === 'overview' ? (
                <LayoutDashboard size={16} />
              ) : tab === 'analytics' ? (
                <BarChart3 size={16} />
              ) : (
                <Trophy size={16} />
              )}
              {tab === 'overview' ? 'Overview' : tab === 'analytics' ? 'Analytics' : 'Leaderboard'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
                <BookOpen size={20} className="text-white/40 mb-2" />
                <p className="text-sm text-white/50">Total Signs</p>
                <p className="mt-3 text-4xl font-semibold">{stats.totalSigns}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
                <CheckCircle size={20} className="text-green-400 mb-2" />
                <p className="text-sm text-white/50">Completed</p>
                <p className="mt-3 text-4xl font-semibold">{stats.completedSigns}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
                <Target size={20} className="text-blue-400 mb-2" />
                <p className="text-sm text-white/50">Attempts</p>
                <p className="mt-3 text-4xl font-semibold">{stats.totalAttempts}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
                <TrendingUp size={20} className="text-yellow-400 mb-2" />
                <p className="text-sm text-white/50">Average Score</p>
                <p className="mt-3 text-4xl font-semibold">{stats.avgScore}%</p>
              </div>
            </div>

            <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <h3 className="mb-6 text-2xl font-semibold">Sign Progress</h3>
              <div className="space-y-4">
                {progress.map(item => (
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
                ))}
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
                {attempts.slice(0, 10).map(attempt => (
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
                ))}
                {attempts.length === 0 && (
                  <p className="py-10 text-center text-white/40">
                    No attempts yet. Start practicing.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'analytics' && <ProgressAnalytics />}
        {activeTab === 'leaderboard' && <Leaderboard />}
      </main>
    </div>
  );
};

export default ProgressPage;