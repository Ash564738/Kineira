// src/components/layout/TopNav.tsx
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  Hand,
  BookOpen,
  BarChart3,
  Database,
  LogOut,
  User,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { themeColors, typography, spacing, borderRadius, effects } from "@/styles/theme";

interface TopNavProps {
  active?: "translate" | "lessons" | "progress" | "collect";
}

export default function TopNav({ active }: TopNavProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const palette = themeColors[theme];

  const navContainerClass = `inline-flex items-center gap-1 rounded-full border ${palette.cardBorder} ${palette.tabGroupBg} p-1 shadow-sm`;

  const getNavLinkClass = (name: string) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-all ${
      active === name
        ? `${palette.tabActiveBg} ${palette.tabActiveText}`
        : `${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText}`
    }`;

  const primaryButtonClass = `px-5 py-2.5 ${borderRadius.button} font-semibold ${palette.actionButtonBg} ${palette.actionButtonText} ${palette.actionButtonHoverBg} ${palette.actionButtonHoverText} ${effects.transition} flex items-center gap-2`;

  const subtleButtonClass = `p-2 ${borderRadius.button} text-sm font-medium ${palette.tabInactiveBg} ${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText} ${effects.transition} flex items-center gap-1.5`;

  return (
    <header
      className={`${typography.fontFamily} border-b ${palette.cardBorder} backdrop-blur-xl ${palette.pageBg} sticky top-0 z-50`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between relative">
        {/* Logo */}
        <Link
          href="/"
          className={`text-2xl font-semibold tracking-wide ${palette.textPrimary} flex items-center gap-2 shrink-0`}
        >
          Kineira
        </Link>

        {/* Navigation – căn giữa tuyệt đối */}
        <nav className="absolute left-1/2 transform -translate-x-1/2">
          <div className={navContainerClass}>
            <Link href="/translate" className={getNavLinkClass("translate")}>
              <Hand size={16} />
              <span className="hidden min-[960px]:inline">Translate</span>
            </Link>
            <Link href="/lessons" className={getNavLinkClass("lessons")}>
              <BookOpen size={16} />
              <span className="hidden min-[960px]:inline">Lessons</span>
            </Link>
            <Link href="/progress" className={getNavLinkClass("progress")}>
              <BarChart3 size={16} />
              <span className="hidden min-[960px]:inline">Progress</span>
            </Link>
            {user?.is_admin && (
              <Link href="/collect" className={getNavLinkClass("collect")}>
                <Database size={16} />
                <span className="hidden min-[960px]:inline">Collect</span>
              </Link>
            )}
          </div>
        </nav>

        {/* Actions bên phải */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={toggleTheme}
            className={subtleButtonClass}
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {user ? (
            <>
              {/* User info: icon luôn hiện, text chỉ hiện từ 960px */}
              <div className="flex items-center gap-3">
                <Link
                  href="/profile"
                  className={`w-9 h-9 rounded-full ${palette.iconContainerBg} ${palette.iconContainerText} flex items-center justify-center font-bold transition-colors`}
                >
                  <User size={18} />
                </Link>
                <div className="hidden min-[960px]:flex flex-col text-right leading-tight">
                  <p className={`text-xs ${palette.textMuted}`}>Level {user.level}</p>
                  <p className={`text-sm font-medium ${palette.textPrimary}`}>
                    {user.username}
                  </p>
                </div>
              </div>

              {/* Logout: icon luôn hiện, chữ ẩn dưới 960px */}
              <button onClick={logout} className={subtleButtonClass}>
                <LogOut size={18} />
                <span className="hidden min-[960px]:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className={subtleButtonClass}>
                Login
              </Link>
              <Link href="/auth/register" className={primaryButtonClass}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}