// src/components/progress/LeaderBoard.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Crown, Medal, Award, Flame, Trophy, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius, effects } from '../../styles/theme';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  level: number;
  xp: number;
  avg_score: number;
  streak: number;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leaderboard/top?limit=20`);
      const data = await res.json();
      setEntries(data);
      if (user) {
        const rankRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leaderboard/user/${user.id}`);
        setUserRank(await rankRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <p className={`py-10 text-center ${typography.body.normal} ${palette.textMuted}`}>
        Loading leaderboard…
      </p>
    );
  }

  // Icon rank sử dụng theme tokens
  const getRankIcon = (rank: number) => {
    const iconClasses = 'h-5 w-5';
    const containerClasses = `flex items-center justify-center ${spacing.rankCircle} ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText}`;
    
    if (rank === 1)
      return (
        <div className={containerClasses}>
          <Crown className={iconClasses} />
        </div>
      );
    if (rank === 2)
      return (
        <div className={containerClasses}>
          <Medal className={iconClasses} />
        </div>
      );
    if (rank === 3)
      return (
        <div className={containerClasses}>
          <Award className={iconClasses} />
        </div>
      );
    return (
      <div className={containerClasses}>
        <span className={`text-sm font-bold`}>#{rank}</span>
      </div>
    );
  };

  return (
    <div className={`space-y-5 ${typography.fontFamily}`}>
      {/* Your rank card */}
      {user && userRank && (
        <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className={`mb-3 inline-flex items-center gap-2 ${palette.textPrimary} ${typography.accent}`}>
                Your rank
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex ${spacing.iconContainer} items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText}`}>
                  <Trophy className="h-5 w-5" />
                </div>
                <p className={`${typography.stat.value} ${palette.textPrimary}`}>#{userRank.rank}</p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className={`${typography.heading.cardTitle} ${palette.textPrimary}`}>{userRank.username}</p>
              <p className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                Level {userRank.level} · {userRank.xp} XP
              </p>
              <p className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                Avg Score: {userRank.avg_score.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard entries */}
      <div className="space-y-3">
        {entries.map((entry) => {
          const isCurrentUser = user?.id === entry.user_id;
          return (
            <div
              key={entry.user_id}
              className={`${borderRadius.item} border p-4 ${effects.transition} ${
                isCurrentUser
                  ? `${palette.highlightBg} ${palette.highlightBorder}`
                  : `${palette.cardBg} ${palette.cardBorder}`
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {/* Rank icon */}
                  {getRankIcon(entry.rank)}

                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${palette.textPrimary}`}>{entry.username}</p>
                    <p className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
                      Level {entry.level} · {entry.xp} XP · Avg {entry.avg_score.toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Streak badge */}
                <div className={`flex items-center gap-2 ${borderRadius.badge} ${spacing.badgePadding} text-sm font-medium ${palette.badgeBg} ${palette.badgeText}`}>
                  <Flame className={`h-4 w-4 ${palette.badgeStreakColor}`} />
                  {entry.streak} day streak
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}