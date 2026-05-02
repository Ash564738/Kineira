import Link from "next/link";

interface TopNavProps {
  active: "practice" | "lessons" | "progress";
}

export default function TopNav({ active }: TopNavProps) {
  return (
    <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
        <div className="text-2xl font-semibold tracking-wide">Kineira</div>
        <nav className="flex gap-6 text-sm text-white/70">
          <Link href="/" className={active === "practice" ? "text-white" : "hover:text-white transition-colors"}>
            Practice
          </Link>
          <Link href="/lessons" className={active === "lessons" ? "text-white" : "hover:text-white transition-colors"}>
            Lessons
          </Link>
          <Link href="/progress" className={active === "progress" ? "text-white" : "hover:text-white transition-colors"}>
            Progress
          </Link>
        </nav>
      </div>
    </header>
  );
}
