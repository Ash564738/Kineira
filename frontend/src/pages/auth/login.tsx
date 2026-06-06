// src/pages/auth/login.tsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGoogleLogin } from '@react-oauth/google';
import Button from '../../components/layout/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius, effects } from '../../styles/theme';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const palette = themeColors[theme];

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const { googleLogin: googleAuthLogin } = useAuth();

  const googleLogin = useGoogleLogin({
    onSuccess: async (credentialResponse) => {
      try {
        await googleAuthLogin(credentialResponse.access_token);
      } catch (err: any) {
        setError(err.message || 'Google login failed');
      }
    },
    flow: 'implicit',
  });

  // Input class dùng theme tokens
  const inputClasses = `w-full px-4 py-3 rounded-xl bg-white dark:bg-black border ${palette.cardBorder} ${palette.textPrimary} placeholder:${palette.textMuted} placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-black focus:ring-black dark:focus:ring-[#BBE1FA] transition`;

  // Google button class (tận dụng palette, không thêm token mới)
  const googleButtonClass = `w-full py-3 ${borderRadius.button} font-semibold bg-gray-100 dark:bg-white/10 border ${palette.cardBorder} ${palette.textPrimary} hover:bg-gray-200 dark:hover:bg-white/20 ${effects.transition} flex items-center justify-center gap-2`;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily} flex items-center justify-center px-4`}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary} tracking-tight`}>
            Kineira
          </h1>
          <p className={`${palette.textMuted} mt-3`}>Sign in to continue your learning journey</p>
        </div>

        <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} shadow-2xl`}>
          <h2 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-8`}>Login</h2>

          {error && (
            <div className={`mb-6 ${borderRadius.smallBox} border ${palette.cardBorder} bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm ${palette.errorText} dark:text-red-300`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${palette.textMuted} mb-2`}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${palette.textMuted} mb-2`}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Login'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${palette.cardBorder}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${palette.cardBg} ${palette.textMuted}`}>or</span>
            </div>
          </div>

          <button
            onClick={() => googleLogin()}
            className={googleButtonClass}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className={`${palette.textMuted} text-sm mt-8 space-y-2`}>
            <p className="text-center">
              Don't have an account?{' '}
              <Link href="/auth/register" className={`${palette.textPrimary} underline underline-offset-4 hover:opacity-80 transition`}>
                Create one
              </Link>
            </p>
            <p className="text-center">
              <Link href="/auth/forgot-password" className={`${palette.textPrimary} underline underline-offset-4 hover:opacity-80 transition`}>
                Forgot password?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}