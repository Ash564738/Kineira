// src/pages/auth/forgot-password.tsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import Button from '../../components/layout/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius } from '../../styles/theme';

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const palette = themeColors[theme];

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await forgotPassword(email);
      setSuccess('Password reset link sent to your email');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  // Input class with theme tokens
  const inputClasses = `w-full px-4 py-3 rounded-xl bg-white dark:bg-black border ${palette.cardBorder} ${palette.textPrimary} placeholder:${palette.textMuted} placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-black focus:ring-black dark:focus:ring-[#BBE1FA] transition`;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily} flex items-center justify-center px-4`}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary} tracking-tight`}>
            Kineira
          </h1>
          <p className={`${palette.textMuted} mt-3`}>Reset your password</p>
        </div>

        <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} shadow-2xl`}>
          <h2 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-8`}>Forgot Password</h2>

          {error && (
            <div className={`mb-6 ${borderRadius.smallBox} border ${palette.cardBorder} bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm ${palette.errorText} dark:text-red-300`}>
              {error}
            </div>
          )}

          {success && (
            <div className={`mb-6 ${borderRadius.smallBox} border ${palette.cardBorder} bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-300`}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${palette.textMuted} mb-2`}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <p className={`${palette.textMuted} text-sm mt-8 text-center`}>
            Remember your password?{' '}
            <Link href="/auth/login" className={`${palette.textPrimary} underline underline-offset-4 hover:opacity-80 transition`}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}