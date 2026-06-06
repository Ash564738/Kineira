// src/pages/progress.tsx
import React, { useState, useEffect } from 'react';
import TopNav from '../components/layout/TopNav';
import Button from '../components/layout/Button';
import { fetchUserAttempts, fetchUserProgress } from '../services/api/client';
import { Attempt, Progress } from '../types/api';
import { useAuth } from '@/contexts/AuthContext';
import Leaderboard from '../components/progress/LeaderBoard';
import ProgressAnalytics from '../components/progress/ProgressAnalytics';
import {
  LayoutDashboard,
  BarChart3,
  Trophy,
  BookOpen,
  CheckCircle,
  Target,
  TrendingUp,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius, effects } from '../styles/theme';

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
] as const;

const ProgressPage: React.FC = () => {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'leaderboard'>('overview');
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [progressData, attemptData] = await Promise.all([
          fetchUserProgress(user.id),
          fetchUserAttempts(user.id),
        ]);
        setProgress(progressData.map(item => ({ ...item, completed: Boolean(item.completed) })));
        setAttempts(attemptData);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const stats = {
    totalSigns: progress.length,
    completedSigns: progress.filter(p => p.completed).length,
    totalAttempts: progress.reduce((sum, p) => sum + p.attempts_count, 0),
    avgScore:
      progress.length > 0
        ? Math.round(progress.reduce((sum, p) => sum + p.best_score, 0) / progress.length)
        : 0,
  };

  // --- Trạng thái: chưa đăng nhập ---
  if (!user) {
    return (
      <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div
            className={`w-full max-w-md ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} text-center`}
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${palette.emptyStateIconBg}`}
            >
              <Sparkles className={`h-7 w-7 ${palette.emptyStateIconColor}`} />
            </div>
            <h1 className={`${typography.heading.sectionTitle} ${palette.textPrimary}`}>
              Sign in required
            </h1>
            <p className={`mt-2 ${typography.body.normal} ${palette.textMuted}`}>
              Please log in to view your progress dashboard.
            </p>
            <Button variant="primary" href="/auth/login" className="mt-6 gap-2">
              Go to login
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
        <div className="flex min-h-screen items-center justify-center">
          <div
            className={`flex items-center gap-3 ${borderRadius.button} border ${palette.cardBorder} ${palette.cardBg} px-5 py-4 text-sm`}
          >
            <div
              className={`h-4 w-4 animate-spin rounded-full border-2 ${palette.spinnerBorder} ${palette.spinnerBorderTop}`}
            />
            Loading progress…
          </div>
        </div>
      </div>
    );
  }

  // --- Card helper (sử dụng theme tokens) ---
  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div
      className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} ${className}`}
    >
      {children}
    </div>
  );

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav active="progress" />
      <main className={`relative ${spacing.container}`}>
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5">
          <div>
            <h2 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>Your Progress</h2>
            <p
              className={`mt-3 max-w-2xl ${typography.body.normal} ${palette.textMuted} sm:${typography.body.large}`}
            >
              Performance overview, analytics, and community ranking in one consistent interface.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div
            className={`inline-flex ${borderRadius.tabGroup} border ${palette.tabGroupBorder} ${palette.tabGroupBg} p-1`}
          >
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 ${borderRadius.badge} ${spacing.tabPadding} text-sm font-medium ${effects.transition} ${
                    active
                      ? `${palette.tabActiveBg} ${palette.tabActiveText}`
                      : `${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText}`
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className={spacing.sectionGap}>
            {/* Stats cards */}
            <div className={`grid grid-cols-1 ${spacing.itemGap} md:grid-cols-2 xl:grid-cols-4`}>
              <Card className="flex items-center gap-4">
                <div
                  className={`flex ${spacing.iconContainer} items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText} shrink-0`}
                >
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${typography.stat.label} ${palette.textMuted}`}>Total Signs</p>
                  <p className={`mt-1 ${typography.stat.value} ${palette.textPrimary}`}>
                    {stats.totalSigns}
                  </p>
                </div>
              </Card>

              <Card className="flex items-center gap-4">
                <div
                  className={`flex ${spacing.iconContainer} items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText} shrink-0`}
                >
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${typography.stat.label} ${palette.textMuted}`}>Completed</p>
                  <p className={`mt-1 ${typography.stat.value} ${palette.textPrimary}`}>
                    {stats.completedSigns}
                  </p>
                </div>
              </Card>

              <Card className="flex items-center gap-4">
                <div
                  className={`flex ${spacing.iconContainer} items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText} shrink-0`}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${typography.stat.label} ${palette.textMuted}`}>Attempts</p>
                  <p className={`mt-1 ${typography.stat.value} ${palette.textPrimary}`}>
                    {stats.totalAttempts}
                  </p>
                </div>
              </Card>

              <Card className="flex items-center gap-4">
                <div
                  className={`flex ${spacing.iconContainer} items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText} shrink-0`}
                >
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${typography.stat.label} ${palette.textMuted}`}>Average Score</p>
                  <p className={`mt-1 ${typography.stat.value} ${palette.textPrimary}`}>
                    {stats.avgScore}%
                  </p>
                </div>
              </Card>
            </div>

            {/* Sign progress */}
            <Card>
              <div className="mb-6">
                <h3 className={`${typography.heading.sectionTitle} ${palette.textPrimary}`}>
                  Sign progress
                </h3>
                <p className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                  Completion and best score by sign.
                </p>
              </div>
              <div className={spacing.sectionGap}>
                {progress.map(item => {
                  const score = Math.max(0, Math.min(100, item.best_score));
                  return (
                    <div
                      key={item.sign_id}
                      className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} ${spacing.itemPadding}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className={`font-semibold ${palette.textPrimary}`}>
                          Sign {item.sign_id}
                        </span>
                        <span className={`${typography.body.small} ${palette.textMuted}`}>
                          {item.attempts_count} attempts
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Progress track sử dụng theme */}
                        <div
                          className={`h-3 flex-1 overflow-hidden ${borderRadius.progress} ${palette.progressTrackBg}`}
                        >
                          <div
                            className={`h-full ${borderRadius.progress} ${palette.progressFillBg}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span
                          className={`w-20 text-right text-lg font-semibold ${palette.textPrimary}`}
                        >
                          {score.toFixed(0)}%
                        </span>
                        {item.completed && (
                          <span
                            className={`${borderRadius.badge} ${palette.badgeBg} px-3 py-1 text-xs font-semibold ${palette.badgeText}`}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {progress.length === 0 && (
                  <div
                    className={`${borderRadius.item} border ${palette.emptyStateBorder} ${palette.emptyStateBg} ${spacing.emptyStatePadding} text-center ${palette.textMuted}`}
                  >
                    No progress yet. Start practicing.
                  </div>
                )}
              </div>
            </Card>

            {/* Recent attempts */}
            <Card>
              <div className="mb-6">
                <h3 className={`${typography.heading.sectionTitle} ${palette.textPrimary}`}>
                  Recent attempts
                </h3>
                <p className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                  The latest submissions and feedback.
                </p>
              </div>
              <div className={spacing.sectionGap}>
                {attempts.slice(0, 10).map(attempt => (
                  <div
                    key={attempt.id}
                    className={`flex flex-col gap-4 ${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} ${spacing.itemPadding} sm:flex-row sm:items-center sm:justify-between`}
                  >
                    <div>
                      <div className={`font-semibold ${palette.textPrimary}`}>
                        Lesson {attempt.lesson_id} · Sign {attempt.sign_id}
                      </div>
                      <div className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                        {attempt.created_at
                          ? new Date(attempt.created_at).toLocaleDateString()
                          : 'Just now'}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div className={`text-2xl font-semibold tracking-tight ${palette.textPrimary}`}>
                        {attempt.score.toFixed(0)}%
                      </div>
                      <div className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                        {attempt.feedback}
                      </div>
                    </div>
                  </div>
                ))}
                {attempts.length === 0 && (
                  <div
                    className={`${borderRadius.item} border ${palette.emptyStateBorder} ${palette.emptyStateBg} ${spacing.emptyStatePadding} text-center ${palette.textMuted}`}
                  >
                    No attempts yet. Start practicing.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'analytics' && <ProgressAnalytics />}
        {activeTab === 'leaderboard' && <Leaderboard />}
      </main>
    </div>
  );
};

export default ProgressPage;