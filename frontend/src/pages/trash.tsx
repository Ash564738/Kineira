import React, { useState } from "react";
import TopNav from '../components/layout/TopNav';
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";

const Home: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Welcome to Kineira</h1>
          <p className="text-xl text-white/60 mb-8">Learn Sign Language with AI-Powered Real-Time Feedback</p>
          {!user && (
            <div className="flex gap-4 justify-center">
              <Link href="/auth/register" className="px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition">
                Get Started
              </Link>
              <Link href="/auth/login" className="px-8 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition">
                Sign In
              </Link>
            </div>
          )}
        </div>

        {user && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <p className="text-white/60 text-sm mb-2">Level</p>
              <p className="text-4xl font-bold text-white">{user.level}</p>
            </div>
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <p className="text-white/60 text-sm mb-2">XP</p>
              <p className="text-4xl font-bold text-white">{user.xp}</p>
            </div>
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <p className="text-white/60 text-sm mb-2">Streak</p>
              <p className="text-4xl font-bold text-white">{user.streak} days</p>
            </div>
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <p className="text-white/60 text-sm mb-2">Email</p>
              <p className="text-sm font-semibold text-white">{user.email_verified ? "Verified" : "Not verified"}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/practice/1" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">books</div>
            <h3 className="text-xl font-semibold text-white mb-2">Practice</h3>
            <p className="text-white/60">Learn from lessons</p>
          </Link>

          <Link href="/quiz" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">help</div>
            <h3 className="text-xl font-semibold text-white mb-2">Quiz</h3>
            <p className="text-white/60">Test your knowledge</p>
          </Link>

          <Link href="/leaderboard" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">podium</div>
            <h3 className="text-xl font-semibold text-white mb-2">Leaderboard</h3>
            <p className="text-white/60">Check rankings</p>
          </Link>

          <Link href="/scenarios" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">world</div>
            <h3 className="text-xl font-semibold text-white mb-2">Scenarios</h3>
            <p className="text-white/60">Real-life practice</p>
          </Link>

          <Link href="/daily-challenge" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">fire</div>
            <h3 className="text-xl font-semibold text-white mb-2">Daily Challenge</h3>
            <p className="text-white/60">Build your streak</p>
          </Link>

          <Link href="/progress-analytics" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">chart_with_upwards_trend</div>
            <h3 className="text-xl font-semibold text-white mb-2">Analytics</h3>
            <p className="text-white/60">Detailed stats</p>
          </Link>

          <Link href="/collect" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">video_camera</div>
            <h3 className="text-xl font-semibold text-white mb-2">Collect Data</h3>
            <p className="text-white/60">Contribute</p>
          </Link>

          <Link href="/progress" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">bar_chart</div>
            <h3 className="text-xl font-semibold text-white mb-2">Progress</h3>
            <p className="text-white/60">Track learning</p>
          </Link>

          <Link href="/lessons" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition">
            <div className="text-4xl mb-4">video_play</div>
            <h3 className="text-xl font-semibold text-white mb-2">Lessons</h3>
            <p className="text-white/60">All lessons</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
