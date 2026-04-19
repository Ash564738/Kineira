import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Lesson {
  id: number;
  title: string;
  description: string;
  sign_id: number;
  difficulty: string;
}

interface Progress {
  sign_id: number;
  best_score: number;
  attempts_count: number;
  completed: boolean;
}

const Lessons: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLessons();
    fetchProgress();
  }, []);

  const fetchLessons = async () => {
    try {
      const response = await fetch('http://localhost:8001/lessons');
      if (response.ok) {
        const data = await response.json();
        setLessons(data);
      }
    } catch (error) {
      console.error('Failed to fetch lessons:', error);
    }
  };

  const fetchProgress = async () => {
    try {
      // For demo, using user_id = 1
      const response = await fetch('http://localhost:8001/users/1/progress');
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressForLesson = (signId: number) => {
    return progress.find(p => p.sign_id === signId);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading lessons...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Sign Language Lessons</h1>
          <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Back to Practice
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.map((lesson) => {
            const lessonProgress = getProgressForLesson(lesson.sign_id);

            return (
              <div key={lesson.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold">{lesson.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor('intermediate')}`}>
                    Intermediate
                  </span>
                </div>

                <p className="text-gray-600 mb-4">{lesson.description}</p>

                {lessonProgress && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{lessonProgress.best_score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${lessonProgress.best_score}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {lessonProgress.attempts_count} attempts
                      {lessonProgress.completed && ' ✓ Completed'}
                    </div>
                  </div>
                )}

                <Link
                  href={`/practice/${lesson.id}`}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors inline-block text-center"
                >
                  {lessonProgress?.completed ? 'Review' : 'Start Lesson'}
                </Link>
              </div>
            );
          })}
        </div>

        {lessons.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No lessons available yet.</p>
            <p className="text-gray-400">Check back later for new content!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lessons;