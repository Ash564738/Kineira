// src/pages/quiz.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TopNav from '../components/layout/TopNav';
import Button from '../components/layout/Button';
import { useTheme } from '../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius } from '../styles/theme';
import { HelpCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { apiUrl } from '../services/api/config';
import ProtectedRoute from '../components/ProtectedRoute';
import PageState from '@/components/ui/PageState';

interface QuizQuestion {
  id: number;
  video_url: string | null;
  options: string[];
}

const QuizContent: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/quiz/questions?count=5'));
      if (!res.ok) throw new Error('Failed to load quiz');
      const data = await res.json();
      setQuestions(data);
      setCurrentQuestion(0);
      setScore(0);
      setAnswered(false);
      setIsCorrect(null);
      setCorrectAnswer(null);
      setTotalXpEarned(0);
    } catch (err: any) {
      setError(err.message || 'Failed to load quiz. Please try again.');
      console.error('Quiz fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAnswer = async (answer: string) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setAnswered(true);
    const question = questions[currentQuestion];
    try {
      const res = await fetch(apiUrl('/quiz/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          user_answer: answer,
          user_id: user!.id,
        }),
      });
      if (!res.ok) throw new Error('Submit failed');
      const result = await res.json();
      setIsCorrect(result.correct);
      setCorrectAnswer(result.correct_answer);
      if (result.correct) {
        setScore(prev => prev + 1);
        setTotalXpEarned(prev => prev + result.xp_earned);
      }
    } catch (err) {
      console.error('Submit error:', err);
      // vẫn tiếp tục, không chặn quiz
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer('');
      setAnswered(false);
      setIsCorrect(null);
      setCorrectAnswer(null);
    }
  };

  const handleReset = () => {
    fetchQuestions();
  };

  // --- Trạng thái Loading ---
  if (loading) {
    return <PageState type="loading" message="Loading quiz..." />;
  }

  // --- Trạng thái Error ---
  if (error) {
    return (
      <PageState
        type="error"
        message={error}
        onAction={fetchQuestions}
        actionLabel="Retry"
      />
    );
  }

  // --- Trạng thái Empty (không có câu hỏi) ---
  if (questions.length === 0) {
    return (
      <PageState
        type="empty"
        title="No quiz questions"
        message="There are no questions available yet."
      />
    );
  }

  const currentQ = questions[currentQuestion];
  const allAnswered = currentQuestion === questions.length - 1 && answered;

  const getOptionOverrideClass = (option: string) => {
    if (!answered) return '';
    if (option === correctAnswer) {
      return '!bg-green-50 !border-green-300 !text-green-800 dark:!bg-green-900/30 dark:!border-green-600 dark:!text-green-300';
    }
    if (option === selectedAnswer && !isCorrect) {
      return '!bg-red-50 !border-red-300 !text-red-800 dark:!bg-red-900/30 dark:!border-red-600 dark:!text-red-300';
    }
    return '!bg-gray-50 !border-gray-200 !text-gray-400 dark:!bg-gray-800/50 dark:!border-[#BBE1FA]/20 dark:!text-[#BBE1FA]/40';
  };

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav />
      <main className={`${spacing.container} !pt-6`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>Quiz Mode</h1>
            <p className={`${palette.textMuted} mt-2`}>
              Test your sign language recognition. Watch the video and choose the correct sign.
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full border ${palette.highlightBorder} ${palette.highlightBg}`}>
            <span className={`${typography.body.small} ${palette.textMuted}`}>Score</span>
            <span className={`ml-2 text-lg font-bold ${palette.textPrimary}`}>{score}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái */}
          <div className="lg:col-span-7 space-y-5">
            <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`${typography.heading.cardTitle} ${palette.textPrimary} flex items-center gap-2`}>
                  Question {currentQuestion + 1}/{questions.length}
                </h2>
                <div className="flex items-center gap-2">
                  {answered ? (
                    isCorrect ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-red-500" />
                    )
                  ) : (
                    <Loader2 size={16} className={`animate-spin ${palette.textMuted}`} />
                  )}
                  <span className={`text-sm ${palette.textMuted}`}>
                    {answered ? (isCorrect ? 'Correct' : 'Incorrect') : 'Waiting...'}
                  </span>
                </div>
              </div>

              {currentQ.video_url ? (
                <video
                  src={apiUrl(currentQ.video_url)}
                  autoPlay loop muted
                  className={`w-full ${borderRadius.button} border ${palette.cardBorder}`}
                  controls
                />
              ) : (
                <div className={`w-full ${borderRadius.button} border ${palette.cardBorder} ${palette.emptyStateBg} p-12 flex items-center justify-center`}>
                  <p className={palette.textMuted}>No video available for this sign</p>
                </div>
              )}

              <div className="mt-5">
                <div className={`w-full ${palette.progressTrackBg} rounded-full h-2`}>
                  <div
                    className={`${palette.progressFillBg} h-2 rounded-full transition-all`}
                    style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 ${palette.textMuted}`}>
                  {((currentQuestion + 1) / questions.length * 100).toFixed(0)}% complete
                </p>
              </div>
            </div>
          </div>

          {/* Cột phải */}
          <div className="lg:col-span-5">
            <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle size={18} className={palette.textMuted} />
                <span className={`${typography.body.small} uppercase tracking-wider ${palette.textMuted}`}>
                  What sign is this?
                </span>
              </div>

              {!allAnswered ? (
                <div className="space-y-3 mt-4">
                  {currentQ.options.map((option) => (
                    <Button
                      key={option}
                      variant="option"
                      onClick={() => handleAnswer(option)}
                      disabled={answered}
                      className={getOptionOverrideClass(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              ) : (
                /* Quiz complete */
                <div className="text-center mt-4">
                  <CheckCircle2 size={48} className="mx-auto text-green-500" />
                  <p className={`${typography.heading.cardTitle} ${palette.textPrimary} mt-4`}>
                    Quiz Complete!
                  </p>
                  <p className={`text-4xl font-bold ${palette.textPrimary} mt-2`}>
                    {score}/{questions.length}
                  </p>
                  <p className={`${palette.textMuted} mt-1`}>
                    {((score / questions.length) * 100).toFixed(0)}% Correct
                  </p>
                  <p className={`${palette.textPrimary} font-bold mt-3`}>
                    +{totalXpEarned} XP earned!
                  </p>
                  <div className="mt-6">
                    <Button variant="primary" onClick={handleReset} className="w-full">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {answered && !allAnswered && (
                <div className="mt-6">
                  <Button variant="primary" onClick={handleNext} className="w-full">
                    Next Question
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const QuizPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <QuizContent />
    </ProtectedRoute>
  );
};

export default QuizPage;