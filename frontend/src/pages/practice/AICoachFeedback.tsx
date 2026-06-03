import { useState, useEffect } from 'react';

interface FeedbackData {
  overall_score: number;
  hand_feedback: ComponentFeedback;
  motion_feedback: ComponentFeedback;
  body_feedback: ComponentFeedback;
  weak_signs: string[];
  practice_plan: PracticePlan[];
  xp_earned: number;
  encouragement: string;
}

interface ComponentFeedback {
  name: string;
  score: number;
  issues: string[];
  recommendations: string[];
}

interface PracticePlan {
  sign: string;
  times: number;
  reason: string;
}

interface Props {
  userId: number;
  score: number;
  handSimilarity: number;
  motionScore: number;
  bodyScore: number;
  sign: string;
  fingerDetails?: any;
}

export default function AICoachFeedback({ userId, score, handSimilarity, motionScore, bodyScore, sign, fingerDetails }: Props) {
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, [score]);

  const fetchFeedback = async () => {
    if (score < 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai-coach/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          sign,
          score: score,
          hand_similarity: handSimilarity,
          motion_score: motionScore,
          body_score: bodyScore,
          finger_details: fingerDetails,
        }),
      });
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      console.error('AI Coach fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 p-4 text-center text-white/60">
        Getting AI feedback...
      </div>
    );
  }
  if (!feedback) return null;

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-6 space-y-6">
      <h3 className="text-xl font-semibold">AI Coach Feedback</h3>

      <div className="text-center">
        <p className="text-5xl font-bold text-white">{feedback.overall_score.toFixed(0)}%</p>
        <p className="text-green-400 text-lg mt-2">+{feedback.xp_earned} XP</p>
        <p className="text-white/50 text-sm mt-1">{feedback.encouragement}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[feedback.hand_feedback, feedback.motion_feedback, feedback.body_feedback].map((comp) => (
          <div key={comp.name} className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-white font-semibold mb-2">{comp.name}</p>
            <p className="text-3xl font-bold text-white">{comp.score.toFixed(0)}%</p>
            {comp.issues.length > 0 && (
              <div className="mt-3">
                <p className="text-white/60 text-sm mb-1">Issues:</p>
                {comp.issues.map((issue, i) => (
                  <p key={i} className="text-red-400 text-xs leading-relaxed">• {issue}</p>
                ))}
              </div>
            )}
            {comp.recommendations.length > 0 && (
              <div className="mt-3">
                <p className="text-white/60 text-sm mb-1">Tips:</p>
                {comp.recommendations.map((rec, i) => (
                  <p key={i} className="text-blue-300 text-xs leading-relaxed">• {rec}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {feedback.weak_signs.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-white font-semibold mb-3">Weak Signs to Practice</p>
          <div className="space-y-2">
            {feedback.practice_plan.map((plan) => (
              <div key={plan.sign} className="flex justify-between items-center">
                <span className="text-white">{plan.sign}</span>
                <span className="text-white/60 text-sm">{plan.times}x – {plan.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}