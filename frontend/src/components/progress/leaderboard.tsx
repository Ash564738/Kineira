// components/progress/leaderboard.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Crown, Medal, Award, Flame, Trophy } from 'lucide-react';

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
        const rankData = await rankRes.json();
        setUserRank(rankData);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={20} className="text-yellow-400" />;
    if (rank === 2) return <Medal size={20} className="text-gray-300" />;
    if (rank === 3) return <Award size={20} className="text-amber-600" />;
    return <span className="text-white font-bold text-sm">#{rank}</span>;
  };

  if (loading) return <p className="text-white/60 py-8 text-center">Loading leaderboard...</p>;
  return (
    <div className="space-y-4">
      {user && userRank && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Your Rank</p>
              <div className="flex items-baseline gap-2">
                <Trophy size={24} className="text-yellow-400" />
                <p className="text-4xl font-bold text-white">#{userRank.rank}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold text-lg">{userRank.username}</p>
              <p className="text-white/60">Level {userRank.level} · {userRank.xp} XP</p>
              <p className="text-white/60">Avg Score: {userRank.avg_score.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.user_id}
          className={`rounded-2xl p-4 flex items-center justify-between border transition ${
            user?.id === entry.user_id
              ? 'bg-white/10 border-white/30'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10">
              {getRankIcon(entry.rank)}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold">{entry.username}</p>
              <p className="text-white/60 text-sm">
                Level {entry.level} · {entry.xp} XP · Avg: {entry.avg_score.toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-1">
            <Flame size={14} className="text-orange-400" />
            <p className="text-white/60 text-sm">{entry.streak} day streak</p>
          </div>
        </div>
      ))}
    </div>
  );
}