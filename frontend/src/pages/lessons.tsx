// src/pages/lessons.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import TopNav from '../components/layout/TopNav';
import { fetchLessons as fetchLessonsApi, fetchUserProgress } from '../services/api/client';
import { Lesson, Progress } from '../types/api';

console.log('[Lessons] Module loaded');

const Lessons: React.FC = () => {
  console.log('[Lessons] Component render started at:', new Date().toISOString());

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  console.log('[Lessons] Current component state snapshot:', {
    lessonsCount: lessons.length,
    progressCount: progress.length,
    loading,
    filter
  });

  useEffect(() => {
    console.log('[Lessons] useEffect initialization triggered');
    try {
      fetchLessons();
      fetchProgress();
    } catch (effectError) {
      console.error('[Lessons] useEffect initialization failure:', effectError);
    }
  }, []);

  const fetchLessons = async () => {
    console.log('[Lessons] fetchLessons invoked');
    try {
      const data = await fetchLessonsApi();
      setLessons(data);
    } catch (error) {
      console.error('[Lessons] Failed to fetch lessons:', error);
    }
  };

  const fetchProgress = async () => {
    console.log('[Lessons] fetchProgress invoked');
    try {
      const data = await fetchUserProgress(1);
      setProgress(data);
    } catch (error) {
      console.error('[Lessons] Failed to fetch progress:', error);
    } finally {
      console.log('[Lessons] fetchProgress completed and loading state will be disabled');
      setLoading(false);
    }
  };

  const getProgressForLesson = (signId: number) => {
    console.log('[Lessons] getProgressForLesson called with signId:', signId);
    try {
      const matchedProgress = progress.find(p => p.sign_id === signId);
      console.log('[Lessons] Matched progress result:', matchedProgress);
      return matchedProgress;
    } catch (error) {
      console.error('[Lessons] getProgressForLesson error:', error);
      return undefined;
    }
  };

  const getDifficultyColor = (level: string) => {
    console.log('[Lessons] getDifficultyColor evaluating level:', level);
    try {
      switch (level.toLowerCase()) {
        case 'beginner':
          return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
        case 'intermediate':
          return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
        case 'advanced':
          return 'bg-orange-500/10 text-orange-300 border border-orange-500/20';
        case 'expert':
          return 'bg-rose-500/10 text-rose-300 border border-rose-500/20';
        default:
          return 'bg-slate-500/10 text-slate-300 border border-slate-500/20';
      }
    } catch (error) {
      console.error('[Lessons] getDifficultyColor error:', error);
      return 'bg-slate-500/10 text-slate-300 border border-slate-500/20';
    }
  };

  const filteredLessons =
    filter === 'all'
      ? lessons
      : lessons.filter(l => l.difficulty.toLowerCase() === filter.toLowerCase());

  console.log('[Lessons] Filtered lessons count after applying filter:', filteredLessons.length);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-8 shadow-2xl">
          <div className="text-lg font-medium text-white/70">Loading lessons...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="lessons" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-semibold">Sign Language Lessons</h1>
            <p className="text-white/50 mt-2">Structured practice sessions with measurable progress tracking.</p>
          </div>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10 transition"
          >
            Back to Practice
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {['all', 'beginner', 'intermediate', 'advanced'].map((f) => (
            <button
              key={f}
              onClick={() => {
                console.log('[Lessons] Filter changed to value:', f);
                setFilter(f);
              }}
              className={`rounded-2xl px-5 py-2 text-sm font-medium transition ${
                filter === f
                  ? 'bg-white text-slate-950'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => {
            console.log('[Lessons] Rendering lesson card for lesson id:', lesson.id);

            const lessonProgress = getProgressForLesson(lesson.sign_id);

            return (
              <div
                key={lesson.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl hover:bg-white/[0.07] transition"
              >
                <div className="flex justify-between items-start mb-5">
                  <h3 className="text-xl font-semibold">{lesson.title}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getDifficultyColor(lesson.difficulty)}`}>
                    {lesson.difficulty}
                  </span>
                </div>

                <p className="text-sm leading-6 text-white/55 mb-5">{lesson.description}</p>

                {lessonProgress && (
                  <div className="mb-5">
                    <div className="flex justify-between text-sm text-white/50 mb-2">
                      <span>Best Score</span>
                      <span className="text-white">{lessonProgress.best_score.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: `${lessonProgress.best_score}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-white/35">
                      {lessonProgress.attempts_count} attempts {lessonProgress.completed ? '• completed' : ''}
                    </div>
                  </div>
                )}

                <Link
                  href={`/practice/${lesson.id}`}
                  className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm font-medium hover:bg-black/30 transition"
                >
                  {lessonProgress?.completed ? 'Review Lesson' : 'Start Lesson'}
                </Link>
              </div>
            );
          })}
        </div>

        {filteredLessons.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center mt-10">
            <p className="text-lg text-white/45">No lessons available for this filter.</p>
            <p className="text-sm text-white/25 mt-2">Try selecting a different difficulty level.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Lessons;