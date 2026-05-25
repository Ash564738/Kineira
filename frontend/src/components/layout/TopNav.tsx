// src/components/layout/TopNav.tsx
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

interface TopNavProps {
  active?: "translate" | "lessons" | "progress" | "collect";
}

export default function TopNav({ active }: TopNavProps) {
  // Hook phải được gọi trong thân component
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
        <div className="text-2xl font-semibold tracking-wide">Kineira</div>
        <nav className="flex gap-6 text-sm text-white/70">
          <Link
            href="/"
            className={
              active === "translate"
                ? "text-white"
                : "hover:text-white transition-colors"
            }
          >
            Translate
          </Link>
          <Link
            href="/lessons"
            className={
              active === "lessons"
                ? "text-white"
                : "hover:text-white transition-colors"
            }
          >
            Lessons
          </Link>
          <Link
            href="/progress"
            className={
              active === "progress"
                ? "text-white"
                : "hover:text-white transition-colors"
            }
          >
            Progress
          </Link>
          <Link
            href="/collect"
            className={
              active === "collect"
                ? "text-white"
                : "hover:text-white transition-colors"
            }
          >
            Collect Data
          </Link>
          {user ? (
            <button onClick={logout} className="hover:text-white transition-colors">
              Logout
            </button>
          ) : (
            <Link href="/auth/login" className="hover:text-white transition-colors">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}