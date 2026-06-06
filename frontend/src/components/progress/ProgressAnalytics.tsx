// src/components/progress/ProgressAnalytics.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  CalendarDays,
  CalendarRange,
  Calendar,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  themeColors,
  typography,
  spacing,
  borderRadius,
  effects,
} from '../../styles/theme';

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

interface YearlyStats {
  year: number;
  total_attempts: number;
  average_score: number;
  days_active: number;
  xp_earned: number;
}

const CustomTooltip = ({ active, payload, label, type }: any) => {
  const { theme } = useTheme();
  const palette = themeColors[theme];

  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className={`${borderRadius.button} border ${palette.tooltipBorder} ${palette.tooltipBg} p-4 shadow-xl`}>
      <p className={`mb-2 ${typography.body.small} font-semibold ${palette.textPrimary}`}>{label}</p>
      <div className={`space-y-1 ${typography.body.small} ${palette.textMuted}`}>
        <p>
          Avg Score: <span className={`font-semibold ${palette.textPrimary}`}>{data.average_score?.toFixed(0)}%</span>
        </p>
        {type === 'daily' && <p>Attempts: {data.attempts}</p>}
        {(type === 'weekly' || type === 'monthly' || type === 'yearly') && (
          <>
            <p>Attempts: {data.total_attempts}</p>
            <p>Days Active: {data.days_active}</p>
            <p className={`font-semibold ${palette.highlightText}`}>+{data.xp_earned} XP</p>
          </>
        )}
      </div>
    </div>
  );
};

export default function ProgressAnalytics() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];

  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const [dailyRes, weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/daily/${user.id}?days=7`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/weekly/${user.id}?weeks=12`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/monthly/${user.id}?months=12`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/yearly/${user.id}?years=5`),
      ]);
      setDailyStats(await dailyRes.json());
      setWeeklyStats(await weeklyRes.json());
      setMonthlyStats(await monthlyRes.json());
      setYearlyStats(await yearlyRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <p className={`py-10 text-center ${typography.body.normal} ${palette.textMuted}`}>
        Loading statistics…
      </p>
    );
  }

  const renderChart = (data: any[], type: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    if (!data || data.length === 0) {
      return (
        <div
          className={`${borderRadius.item} border border-dashed ${palette.cardBorder} p-12 text-center ${palette.textMuted}`}
        >
          No data available.
        </div>
      );
    }

    const chartData = data.map((item) => ({
      ...item,
      label:
        type === 'daily'
          ? item.date
          : type === 'weekly'
          ? `W${item.week}`
          : type === 'monthly'
          ? `${item.month}/${item.year}`
          : `${item.year}`,
    }));

    return (
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={palette.lineColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={palette.lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.gridColor} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: palette.tickColor }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: palette.tickColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip content={<CustomTooltip type={type} />} />
            <Area
              type="monotone"
              dataKey="average_score"
              stroke={palette.lineColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#scoreGradient)"
              name="Avg Score"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const summaryCards = [
    {
      label: 'Avg Score (7d)',
      value: dailyStats.length
        ? (dailyStats.reduce((s, d) => s + d.average_score, 0) / dailyStats.length).toFixed(0)
        : 0,
      suffix: '%',
      icon: TrendingUp,
    },
    {
      label: 'Total Attempts',
      value: dailyStats.reduce((s, d) => s + d.attempts, 0),
      suffix: '',
      icon: BarChart3,
    },
    {
      label: 'Current Level',
      value: user?.level || 0,
      suffix: '',
      icon: Calendar,
    },
  ];

  return (
    <div className={`space-y-6 ${typography.fontFamily}`}>
      {/* Summary cards */}
      <div className={`grid grid-cols-1 ${spacing.itemGap} md:grid-cols-3`}>
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} flex items-center gap-4`}
            >
              <div
                className={`flex ${spacing.iconContainer} items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText} shrink-0`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${typography.stat.label} ${palette.textMuted}`}>{card.label}</p>
                <p className={`mt-1 ${typography.stat.value} ${palette.textPrimary}`}>
                  {card.value}{card.suffix}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart card */}
      <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className={`${typography.heading.sectionTitle} ${palette.textPrimary}`}>
              {activeTab === 'daily'
                ? 'Daily'
                : activeTab === 'weekly'
                ? 'Weekly'
                : activeTab === 'monthly'
                ? 'Monthly'
                : 'Yearly'}{' '}
              performance
            </h3>
            <p className={`mt-1 ${typography.body.small} ${palette.textMuted}`}>
              Consistent chart language, color system, and spacing.
            </p>
          </div>

          {/* Segmented control */}
          <div
            className={`inline-flex ${borderRadius.tabGroup} border ${palette.tabGroupBorder} ${palette.tabGroupBg} p-1`}
          >
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex items-center gap-1.5 ${borderRadius.badge} ${spacing.tabPadding} text-sm font-medium ${effects.transition} ${
                    active
                      ? `${palette.tabActiveBg} ${palette.tabActiveText} shadow-sm`
                      : `${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText}`
                  }`}
                >
                  {tab === 'daily' ? (
                    <CalendarDays className="h-4 w-4" />
                  ) : tab === 'weekly' ? (
                    <CalendarRange className="h-4 w-4" />
                  ) : tab === 'monthly' ? (
                    <Calendar className="h-4 w-4" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'daily' && renderChart(dailyStats, 'daily')}
        {activeTab === 'weekly' && renderChart(weeklyStats, 'weekly')}
        {activeTab === 'monthly' && renderChart(monthlyStats, 'monthly')}
        {activeTab === 'yearly' && renderChart(yearlyStats, 'yearly')}
      </div>
    </div>
  );
}