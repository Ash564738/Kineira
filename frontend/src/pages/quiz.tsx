import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import TopNav from '../components/layout/TopNav';

interface QuizQuestion {
  id: number;
  video_url: string | null;
  options: string[];
}

export default function Quiz() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz/questions?count=5`);
      const data = await res.json();
      setQuestions(data);
      setCurrentQuestion(0);
      setScore(0);
      setAnswered(false);
      setIsCorrect(null);
      setCorrectAnswer(null);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setAnswered(true);

    const question = questions[currentQuestion];
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          user_answer: answer,
          user_id: user?.id || 0,
        }),
      });
      const result = await res.json();
      setIsCorrect(result.correct);
      setCorrectAnswer(result.correct_answer);
      if (result.correct) {
          setScore(prev => prev + 1);
          setTotalXpEarned(prev => prev + result.xp_earned);
      }
    } catch (err) {
      console.error('Submit failed:', err);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-white">Loading quiz...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950">
        <TopNav />
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-white">
            <p className="mb-4">Please log in to play quiz</p>
            <Link href="/auth/login" className="text-white underline underline-offset-4">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950">
        <TopNav />
        <div className="flex items-center justify-center py-20">
          <p className="text-white">No quiz questions available.</p>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const allAnswered = currentQuestion === questions.length - 1 && answered;

  const getOptionClass = (option: string) => {
    if (!answered) return 'bg-white/5 border border-white/10 text-white hover:bg-white/10';
    if (option === correctAnswer) return 'bg-green-500/20 border border-green-500 text-green-300';
    if (option === selectedAnswer && !isCorrect) return 'bg-red-500/20 border border-red-500 text-red-300';
    return 'bg-white/5 border border-white/10 text-white/40';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-slate-900/80 rounded-3xl border border-white/10 p-8">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-white">Quiz Mode</h1>
              <div className="text-right">
                <p className="text-white/60">Question {currentQuestion + 1}/{questions.length}</p>
                <p className="text-2xl font-bold text-white">Score: {score}</p>
              </div>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-white/60 text-lg mb-4">What sign is this?</p>
              {currentQ.video_url ? (
                <video
                  src={`http://localhost:8000${currentQ.video_url}`}
                  autoPlay
                  loop
                  muted
                  className="w-full rounded-xl border border-white/10"
                  controls
                />
              ) : (
                <div className="bg-white/5 rounded-2xl p-12 border border-white/10 flex items-center justify-center">
                  <p className="text-white/40">No video available for this sign</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {currentQ.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={answered}
                  className={`w-full p-4 rounded-xl font-semibold transition ${getOptionClass(option)}`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              {answered && currentQuestion < questions.length - 1 && (
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition"
                >
                  Next Question
                </button>
              )}
              {allAnswered && (
                <div className="w-full space-y-4">
                  <div className="bg-white/10 rounded-xl p-6 text-center">
                      <p className="text-white/60 text-lg mb-2">Quiz Complete!</p>
                      <p className="text-4xl font-bold text-white">
                          {score}/{questions.length}
                      </p>
                      <p className="text-white/60 mt-2">
                          {((score / questions.length) * 100).toFixed(0)}% Correct
                      </p>
                      <p className="text-yellow-400 font-bold mt-3">+{totalXpEarned} XP earned!</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}