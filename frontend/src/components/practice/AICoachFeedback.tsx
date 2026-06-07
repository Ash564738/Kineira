// src/components/practice/AICoachFeedback.tsx
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius } from '../../styles/theme';

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
  resetKey: number;
  onAiResponse: () => void;
}

export default function AICoachFeedback({
  userId, score, handSimilarity, motionScore, bodyScore,
  sign, fingerDetails, resetKey, onAiResponse
}: Props) {
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const palette = themeColors[theme];

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const fetchFeedback = async () => {
      if (score < 0) { onAiResponse(); setLoading(false); return; }
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai-coach/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, sign, score, hand_similarity: handSimilarity, motion_score: motionScore, body_score: bodyScore, finger_details: fingerDetails }),
          signal: controller.signal,
        });
        const data = await res.json();
        setFeedback(data);
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err);
      } finally {
        setLoading(false);
        timeoutId = setTimeout(() => {
          onAiResponse();
        }, 4000);
      }
    };

    fetchFeedback();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [resetKey]);

  if (loading) {
    return (
      <div className={`mt-6 p-4 text-center ${palette.textMuted}`}>
        Getting AI feedback...
      </div>
    );
  }
  if (!feedback) return null;

  return (
    <div className={`mt-6 ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} space-y-6`}>
      <h3 className={`${typography.heading.sectionTitle} ${palette.textPrimary}`}>AI Coach Feedback</h3>

      <div className="text-center">
        <p className={`text-5xl font-bold ${palette.textPrimary}`}>{feedback.overall_score.toFixed(0)}%</p>
        <p className="text-green-600 text-lg mt-2">+{feedback.xp_earned} XP</p>
        <p className={`${palette.textMuted} text-sm mt-1`}>{feedback.encouragement}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[feedback.hand_feedback, feedback.motion_feedback, feedback.body_feedback].map((comp) => (
          <div key={comp.name} className={`${palette.cardBg} border ${palette.cardBorder} ${borderRadius.innerCard} p-4`}>
            <p className={`${palette.textPrimary} font-semibold mb-2`}>{comp.name}</p>
            <p className={`text-3xl font-bold ${palette.textPrimary}`}>{comp.score.toFixed(0)}%</p>
            {comp.issues.length > 0 && (
              <div className="mt-3">
                <p className={`${palette.textMuted} text-sm mb-1`}>Issues:</p>
                {comp.issues.map((issue, i) => (
                  <p key={i} className="text-red-600 text-xs leading-relaxed">• {issue}</p>
                ))}
              </div>
            )}
            {comp.recommendations.length > 0 && (
              <div className="mt-3">
                <p className={`${palette.textMuted} text-sm mb-1`}>Tips:</p>
                {comp.recommendations.map((rec, i) => (
                  <p key={i} className="text-blue-600 text-xs leading-relaxed">• {rec}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {feedback.weak_signs.length > 0 && (
        <div className={`${palette.cardBg} border ${palette.cardBorder} ${borderRadius.innerCard} p-4`}>
          <p className={`${palette.textPrimary} font-semibold mb-3`}>Weak Signs to Practice</p>
          <div className="space-y-2">
            {feedback.practice_plan.map((plan) => (
              <div key={plan.sign} className="flex justify-between items-center">
                <span className={palette.textPrimary}>{plan.sign}</span>
                <span className={`${palette.textMuted} text-sm`}>{plan.times}x – {plan.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}