// components/progress/progress-analytics.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarDays, CalendarRange, Calendar } from 'lucide-react';

interface DailyStats {
  date: string;
  attempts: number;
  average_score: number;
}

interface WeeklyStats {
  week: number;
  total_attempts: number;
  average_score: number;
  days_active: number;
  xp_earned: number;
}

interface MonthlyStats {
  month: number;
  year: number;
  total_attempts: number;
  average_score: number;
  days_active: number;
  xp_earned: number;
}

export default function ProgressAnalytics() {
  const { user } = useAuth();
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/daily/${user.id}?days=7`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/weekly/${user.id}?weeks=12`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/monthly/${user.id}?months=12`)
      ]);
      setDailyStats(await dailyRes.json());
      setWeeklyStats(await weeklyRes.json());
      setMonthlyStats(await monthlyRes.json());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-white/60 py-8 text-center">Loading statistics...</p>;

  const renderChart = (data: any[], type: 'daily' | 'weekly' | 'monthly') => {
    const maxScore = Math.max(...data.map(d => d.average_score || 0), 100);

    return (
      <div className="space-y-4">
        {data.map((item, idx) => {
          const barWidth = item.average_score ? (item.average_score / maxScore) * 100 : 0;
          const label = type === 'daily'
            ? item.date
            : type === 'weekly'
            ? `Week ${item.week}`
            : `${item.month}/${item.year}`;

          return (
            <div key={idx}>
              <div className="flex justify-between mb-1">
                <span className="text-white/60 text-sm">{label}</span>
                <span className="text-white text-sm">{item.average_score?.toFixed(0) || 0}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-white h-6 rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                ></div>
              </div>
              <p className="text-white/40 text-xs mt-1">
                {type === 'daily'
                  ? `${item.attempts} attempts`
                  : `${item.days_active} days · ${item.total_attempts} attempts · +${item.xp_earned} XP`}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {(['daily', 'weekly', 'monthly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-white text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {tab === 'daily' ? (
              <CalendarDays size={16} />
            ) : tab === 'weekly' ? (
              <CalendarRange size={16} />
            ) : (
              <Calendar size={16} />
            )}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-6">
        {activeTab === 'daily' && renderChart(dailyStats, 'daily')}
        {activeTab === 'weekly' && renderChart(weeklyStats, 'weekly')}
        {activeTab === 'monthly' && renderChart(monthlyStats, 'monthly')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5">
          <p className="text-white/60 text-sm mb-1">Avg Score (7d)</p>
          <p className="text-3xl font-bold text-white">
            {dailyStats.length > 0
              ? (dailyStats.reduce((s, d) => s + d.average_score, 0) / dailyStats.length).toFixed(0)
              : 0}%
          </p>
        </div>
        <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5">
          <p className="text-white/60 text-sm mb-1">Total Attempts</p>
          <p className="text-3xl font-bold text-white">
            {dailyStats.reduce((s, d) => s + d.attempts, 0)}
          </p>
        </div>
        <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5">
          <p className="text-white/60 text-sm mb-1">Current Level</p>
          <p className="text-3xl font-bold text-white">{user?.level || 0}</p>
        </div>
      </div>
    </div>
  );
}