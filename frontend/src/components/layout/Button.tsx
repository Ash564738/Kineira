// components/layout/Button.tsx
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, borderRadius } from '../../styles/theme';

type ButtonVariant = 'primary' | 'secondary' | 'option' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  href?: string;
  className?: string;
}

const baseClasses = `
  inline-flex items-center justify-center font-semibold
  transition-all duration-200 rounded-2xl
  focus:outline-none focus:ring-2 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export default function Button({
  variant = 'primary',
  href,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const { theme } = useTheme();
  const palette = themeColors[theme];

  // Ánh xạ variant -> class từ palette
  const variantClasses: Record<ButtonVariant, string> = {
    primary: `
      ${palette.actionButtonBg} ${palette.actionButtonText}
      ${palette.actionButtonHoverBg} ${palette.actionButtonHoverText}
      px-5 py-3
    `,
    secondary: `
      bg-gray-200 text-black hover:bg-gray-300
      dark:bg-[#BBE1FA]/10 dark:text-[#BBE1FA] dark:hover:bg-[#BBE1FA]/20
      px-5 py-3
    `,
    option: `
      w-full p-4 rounded-xl font-semibold
      ${palette.quizOptionBg} ${palette.quizOptionBorder} ${palette.quizOptionText}
      ${palette.quizOptionHoverBg} ${palette.quizOptionHoverText}
      border
    `,
    danger: `
      bg-red-50 border border-red-200 text-red-700
      hover:bg-red-100
      dark:bg-red-900/20 dark:border-[#BBE1FA]/30 dark:text-red-300
      dark:hover:bg-red-900/30
      px-5 py-3
    `,
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (href) {
    return <a href={href} className={classes}>{children}</a>;
  }
  return <button className={classes} {...props}>{children}</button>;
}