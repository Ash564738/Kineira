import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { borderRadius, themeColors, typography } from '../../styles/theme';

type ToastType = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { theme } = useTheme();
  const palette = themeColors[theme];

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => removeToast(id), 3500);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-20 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon =
            toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={toast.id}
              className={`${borderRadius.smallBox} border ${palette.cardBorder} ${palette.cardBg} ${palette.textPrimary} flex items-start gap-3 px-4 py-3 shadow-lg`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className={`${typography.body.normal} flex-1`}>{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className={`${palette.textMuted} ${palette.tabHoverText}`}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
