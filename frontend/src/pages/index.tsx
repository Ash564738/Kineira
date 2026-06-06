// src/pages/index.tsx
import React from "react";
import Link from "next/link";
import TopNav from "../components/layout/TopNav";
import Button from "../components/layout/Button";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { themeColors, typography, spacing, borderRadius, effects } from "../styles/theme";
import {
  BookOpen,
  HelpCircle,
  TrendingUp,
  Database,
  Play,
  Languages,
} from "lucide-react";

/* ───────── Feature card nhỏ gọn, dùng theme tokens ───────── */
function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  const { theme } = useTheme();
  const palette = themeColors[theme];

  return (
    <Link
      href={href}
      className={`flex items-start gap-4 ${borderRadius.item} border ${palette.cardBorder} ${palette.cardBg} ${spacing.itemPadding} ${palette.cardHoverBg} ${effects.transition} hover:shadow-sm`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 flex items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText}`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h3 className={`${typography.heading.cardTitle} ${palette.textPrimary} mb-1`}>
          {title}
        </h3>
        <p className={`${typography.body.small} ${palette.textMuted}`}>{description}</p>
      </div>
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────── */

const Home: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav />
      <main className={`${spacing.container} !pt-6`}>
        {/* Welcome section */}
        <div className="text-center mb-16">
          <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary} mb-4`}>
            Welcome to Kineira
          </h1>
          <p className={`text-xl ${palette.textMuted} mb-8`}>
            Learn Sign Language with AI‑Powered Real‑Time Feedback
          </p>
          {!user && (
            <div className="flex gap-4 justify-center">
              <Button variant="primary" href="/auth/register">
                Get Started
              </Button>
              <Button variant="secondary" href="/auth/login">
                Sign In
              </Button>
            </div>
          )}
        </div>

        {/* User stats (only when logged in) */}
        {user && (
          <div
            className={`mb-12 ${spacing.cardPadding} ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg}`}
          >
            <h2 className={`${typography.heading.cardTitle} ${palette.textPrimary} mb-4`}>
              Your Stats
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} p-4`}
              >
                <p className={`${typography.body.small} ${palette.textMuted} mb-1`}>Level</p>
                <p className={`text-3xl font-bold ${palette.textPrimary}`}>{user.level}</p>
              </div>
              <div
                className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} p-4`}
              >
                <p className={`${typography.body.small} ${palette.textMuted} mb-1`}>XP</p>
                <p className={`text-3xl font-bold ${palette.textPrimary}`}>{user.xp}</p>
              </div>
              <div
                className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} p-4`}
              >
                <p className={`${typography.body.small} ${palette.textMuted} mb-1`}>Streak</p>
                <p className={`text-3xl font-bold ${palette.textPrimary}`}>{user.streak} days</p>
              </div>
              <div
                className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} p-4`}
              >
                <p className={`${typography.body.small} ${palette.textMuted} mb-1`}>Email</p>
                <p className={`text-sm font-semibold ${palette.textPrimary}`}>
                  {user.email_verified ? "Verified" : "Not verified"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            href="/translate"
            icon={Languages}
            title="Translate"
            description="Real‑time sign language translation"
          />

          <FeatureCard
            href="/lessons"
            icon={Play}
            title="Lessons"
            description="Browse all lessons"
          />

          <FeatureCard
            href="/practice/1"
            icon={BookOpen}
            title="Practice"
            description="Learn from interactive lessons"
          />

          <FeatureCard
            href="/quiz"
            icon={HelpCircle}
            title="Quiz"
            description="Test your knowledge"
          />

          <FeatureCard
            href="/progress"
            icon={TrendingUp}
            title="Progress"
            description="Track your learning"
          />

          <FeatureCard
            href="/collect"
            icon={Database}
            title="Collect Data"
            description="Contribute to the dataset"
          />
        </div>
      </main>
    </div>
  );
};

export default Home;