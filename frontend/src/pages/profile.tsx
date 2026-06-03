// pages/profile.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import TopNav from '../components/layout/TopNav';

export default function Profile() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('profile');

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="mb-4">Please log in first</p>
          <Link href="/auth/login" className="text-white underline underline-offset-4 hover:text-white/80">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await updateProfile(user.avatar_url || '', username);
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-8">Profile</h1>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 space-y-8">
          {/* Account info */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Account</h2>
            <div className="space-y-3">
              <div>
                <p className="text-white/60 text-sm">Email</p>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Verified</p>
                <p className="text-white font-medium">{user.email_verified ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/60 text-sm">Level</p>
                <p className="text-2xl font-bold text-white">{user.level}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/60 text-sm">XP</p>
                <p className="text-2xl font-bold text-white">{user.xp}</p>
              </div>
            </div>
          </section>

          {/* Tabs: Edit / Password */}
          <section>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => { setTab('profile'); setError(''); setSuccess(''); }}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                  tab === 'profile'
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Edit Profile
              </button>
              <button
                onClick={() => { setTab('password'); setError(''); setSuccess(''); }}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                  tab === 'password'
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Password
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-300">
                {success}
              </div>
            )}

            {tab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                    placeholder="Enter your username"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
              </form>
            )}

            {tab === 'password' && (
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            )}
          </section>

          <button
            onClick={logout}
            className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 font-semibold hover:bg-red-500/20 transition"
          >
            Logout
          </button>
        </div>
      </main>
    </div>
  );
}