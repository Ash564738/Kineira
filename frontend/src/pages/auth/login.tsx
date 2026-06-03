import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGoogleLogin } from '@react-oauth/google';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

const { googleLogin: googleAuthLogin } = useAuth(); // Lấy hàm googleLogin từ context

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

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">Kineira</h1>
          <p className="text-white/40 mt-3">Sign in to continue your learning journey</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white mb-8">Login</h2>

          {error && (
            <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/60 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900/80 text-white/40">or</span>
            </div>
          </div>

          <button
            onClick={() => googleLogin()}
            className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition"
          >
            Continue with Google
          </button>

          <div className="text-white/40 text-sm mt-8 space-y-2">
            <p className="text-center">
              Don't have an account?{' '}
              <Link href="/auth/register" className="text-white underline underline-offset-4 hover:text-white/80 transition">
                Create one
              </Link>
            </p>
            <p className="text-center">
              <Link href="/auth/forgot-password" className="text-white underline underline-offset-4 hover:text-white/80 transition">
                Forgot password?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
