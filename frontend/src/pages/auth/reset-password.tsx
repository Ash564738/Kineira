// src/pages/auth/reset-password.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import Button from '../../components/layout/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius } from '../../styles/theme';

export default function ResetPassword() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const palette = themeColors[theme];

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const token = router.query.token as string;
      await resetPassword(token, password);
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  // Input field class using theme tokens
  const inputClasses = `w-full px-4 py-3 rounded-xl bg-white dark:bg-black border ${palette.cardBorder} ${palette.textPrimary} placeholder:${palette.textMuted} placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-black focus:ring-black dark:focus:ring-[#BBE1FA] transition`;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily} flex items-center justify-center px-4`}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary} tracking-tight`}>
            Kineira
          </h1>
          <p className={`${palette.textMuted} mt-3`}>Set your new password</p>
        </div>

        <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} shadow-2xl`}>
          <h2 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-8`}>Reset Password</h2>

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
              <label htmlFor="password" className={`block text-sm font-medium ${palette.textMuted} mb-2`}>
                New Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-medium ${palette.textMuted} mb-2`}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>

          <p className={`${palette.textMuted} text-sm mt-8 text-center`}>
            <Link href="/auth/login" className={`${palette.textPrimary} underline underline-offset-4 hover:opacity-80 transition`}>
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}