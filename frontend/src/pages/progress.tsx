import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Progress {
  sign_id: number;
  best_score: number;
  attempts_count: number;
  completed: boolean;
}

interface Attempt {
  id: number;
  lesson_id: number;
  sign_id: number;
  score: number;
  feedback: string;
  created_at: string;
}

const ProgressPage: React.FC = () => {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    fetchAttempts();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await fetch('http://localhost:8001/users/1/progress');
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const fetchAttempts = async () => {
    try {
      const response = await fetch('http://localhost:8001/users/1/attempts');
      if (response.ok) {
        const data = await response.json();
        setAttempts(data);
      }
    } catch (error) {
      console.error('Failed to fetch attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStats = () => {
    const totalSigns = progress.length;
    const completedSigns = progress.filter(p => p.completed).length;
    const totalAttempts = progress.reduce((sum, p) => sum + p.attempts_count, 0);
    const avgScore = progress.length > 0
      ? progress.reduce((sum, p) => sum + p.best_score, 0) / progress.length
      : 0;

    return {
      totalSigns,
      completedSigns,
      totalAttempts,
      avgScore: Math.round(avgScore)
    };
  };

  const stats = getOverallStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading progress...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Your Progress</h1>
          <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Back to Practice
          </Link>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-600">Total Signs</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalSigns}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-600">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{stats.completedSigns}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-600">Total Attempts</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.totalAttempts}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-600">Average Score</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.avgScore}%</p>
          </div>
        </div>

        {/* Progress by Sign */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Sign Progress</h2>
          <div className="space-y-4">
            {progress.map((item) => (
              <div key={item.sign_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Sign {item.sign_id}</span>
                    <span className="text-sm text-gray-500">
                      {item.attempts_count} attempts
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${item.best_score}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="font-bold text-lg">{item.best_score}%</span>
                    {item.completed && (
                      <span className="ml-2 text-green-600">✓</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Attempts */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">Recent Attempts</h2>
          <div className="space-y-4">
            {attempts.slice(0, 10).map((attempt) => (
              <div key={attempt.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Lesson {attempt.lesson_id} - Sign {attempt.sign_id}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(attempt.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-lg ${
                    attempt.score >= 80 ? 'text-green-600' :
                    attempt.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {attempt.score}%
                  </div>
                  <div className="text-sm text-gray-600">{attempt.feedback}</div>
                </div>
              </div>
            ))}
          </div>
          {attempts.length === 0 && (
            <p className="text-gray-500 text-center py-8">No attempts yet. Start practicing!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressPage;