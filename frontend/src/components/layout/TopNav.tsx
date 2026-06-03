// src/components/layout/TopNav.tsx
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

interface TopNavProps {
  active?: "translate" | "lessons" | "progress" | "collect";
}

export default function TopNav({ active }: TopNavProps) {
  const { user, logout } = useAuth();

  const linkClass = (name: string) =>
    `relative px-3 py-2 text-sm font-medium transition-colors ${
      active === name
        ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-white"
        : "text-white/60 hover:text-white"
    }`;

  return (
    <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
        {/* Logo */}
        <Link href="/" className="text-2xl font-semibold tracking-wide text-white">
          Kineira
        </Link>

        {/* Navigation – centered */}
        <nav className="flex-1 flex justify-center gap-1">
          <Link href="/" className={linkClass("translate")}>
            Translate
          </Link>
          <Link href="/lessons" className={linkClass("lessons")}>
            Lessons
          </Link>
          <Link href="/progress" className={linkClass("progress")}>
            Progress
          </Link>
          <Link href="/collect" className={linkClass("collect")}>
            Collect Data
          </Link>
        </nav>

        {/* User area */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-white/50">Level {user.level}</p>
                  <p className="text-sm font-medium text-white">{user.username}</p>
                </div>
                <Link
                  href="/profile"
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white hover:bg-white/20 transition"
                >
                  {user.username?.charAt(0).toUpperCase()}
                </Link>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 text-sm rounded-lg bg-white text-black font-semibold hover:bg-gray-100 transition"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}