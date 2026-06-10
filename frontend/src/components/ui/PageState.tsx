import React from 'react';
import { AlertTriangle, Lock, Loader2, SearchX } from 'lucide-react';
import Button from '../layout/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { borderRadius, spacing, themeColors, typography } from '../../styles/theme';

type PageStateType = 'loading' | 'error' | 'empty' | 'unauthorized' | 'forbidden';

interface PageStateProps {
  type?: PageStateType;
  title?: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  showNavSpace?: boolean;
}

const defaultCopy: Record<PageStateType, { title: string; message: string }> = {
  loading: {
    title: 'Loading',
    message: 'Please wait while we prepare this page.',
  },
  error: {
    title: 'Something went wrong',
    message: 'We could not load this data. Please try again.',
  },
  empty: {
    title: 'No data yet',
    message: 'There is nothing to show here right now.',
  },
  unauthorized: {
    title: 'Sign in required',
    message: 'Please log in to continue.',
  },
  forbidden: {
    title: 'Admin access required',
    message: 'This area is reserved for administrators.',
  },
};

export default function PageState({
  type = 'loading',
  title,
  message,
  actionHref,
  actionLabel,
  onAction,
  showNavSpace = false,
}: PageStateProps) {
  const { theme } = useTheme();
  const palette = themeColors[theme];
  const copy = defaultCopy[type];

  const Icon =
    type === 'loading'
      ? Loader2
      : type === 'error'
      ? AlertTriangle
      : type === 'forbidden' || type === 'unauthorized'
      ? Lock
      : SearchX;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      {showNavSpace && <div className="h-16" />}
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div
          className={`w-full max-w-md ${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} text-center`}
        >
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center ${borderRadius.iconContainer} ${palette.iconContainerBg} ${palette.iconContainerText}`}
          >
            <Icon className={`h-7 w-7 ${type === 'loading' ? 'animate-spin' : ''}`} />
          </div>
          <h1 className={`${typography.heading.sectionTitle} ${palette.textPrimary}`}>
            {title || copy.title}
          </h1>
          <p className={`mt-2 ${typography.body.normal} ${palette.textMuted}`}>
            {message || copy.message}
          </p>
          {(actionHref || onAction) && actionLabel && (
            <div className="mt-6">
              <Button variant="primary" href={actionHref} onClick={onAction}>
                {actionLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
