// src/pages/profile.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TopNav from '../components/layout/TopNav';
import Button from '../components/layout/Button';
import { useTheme } from '../contexts/ThemeContext';
import { themeColors, typography, spacing, borderRadius, effects } from '../styles/theme';
import ProtectedRoute from '../components/ProtectedRoute';
import { useToast } from '../components/ui/ToastProvider';   // thêm import

const ProfileContent: React.FC = () => {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const { theme } = useTheme();
  const palette = themeColors[theme];
  const { showToast } = useToast();   // lấy hàm hiển thị toast

  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('profile');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(user?.avatar_url || '', username);
      showToast('Profile updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl ${palette.cardBg} ${palette.cardBorder} border ${palette.textPrimary} placeholder-gray-400 dark:placeholder-[#BBE1FA]/40 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-black focus:ring-[#BBE1FA] transition`;

  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav />
      <main className={`${spacing.container} !pt-6`}>
        <div className="mb-10">
          <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>Profile</h1>
          <p className={`${palette.textMuted} mt-2`}>Manage your account settings and security.</p>
        </div>

        <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding} space-y-8`}>
          {/* Account info */}
          <section>
            <h2 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-4`}>Account</h2>
            <div className="space-y-3">
              <div>
                <p className={`${typography.body.small} ${palette.textMuted}`}>Email</p>
                <p className={`${typography.body.normal} font-medium ${palette.textPrimary}`}>{user!.email}</p>
              </div>
              <div>
                <p className={`${typography.body.small} ${palette.textMuted}`}>Verified</p>
                <p className={`${typography.body.normal} font-medium ${palette.textPrimary}`}>
                  {user!.email_verified ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section>
            <h2 className={`${typography.heading.sectionTitle} ${palette.textPrimary} mb-4`}>Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} p-4`}>
                <p className={`${typography.body.small} ${palette.textMuted}`}>Level</p>
                <p className={`text-2xl font-bold ${palette.textPrimary}`}>{user!.level}</p>
              </div>
              <div className={`${borderRadius.item} border ${palette.cardBorder} ${palette.highlightBg} p-4`}>
                <p className={`${typography.body.small} ${palette.textMuted}`}>XP</p>
                <p className={`text-2xl font-bold ${palette.textPrimary}`}>{user!.xp}</p>
              </div>
            </div>
          </section>

          {/* Tabs & Forms */}
          <section>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setTab('profile')}
                className={`px-5 py-2 rounded-xl text-sm font-medium ${effects.transition} ${
                  tab === 'profile'
                    ? `${palette.tabActiveBg} ${palette.tabActiveText}`
                    : `${palette.tabInactiveBg} ${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText}`
                }`}
              >
                Edit Profile
              </button>
              <button
                onClick={() => setTab('password')}
                className={`px-5 py-2 rounded-xl text-sm font-medium ${effects.transition} ${
                  tab === 'password'
                    ? `${palette.tabActiveBg} ${palette.tabActiveText}`
                    : `${palette.tabInactiveBg} ${palette.tabInactiveText} ${palette.tabHoverBg} ${palette.tabHoverText}`
                }`}
              >
                Password
              </button>
            </div>

            {/* Profile form */}
            {tab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium ${palette.textPrimary} mb-2`}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClasses}
                    placeholder="Enter your username"
                  />
                </div>
                <Button type="submit" variant="primary" disabled={loading} className="w-full">
                  {loading ? 'Updating...' : 'Update Profile'}
                </Button>
              </form>
            )}

            {/* Password form */}
            {tab === 'password' && (
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium ${palette.textPrimary} mb-2`}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${palette.textPrimary} mb-2`}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${palette.textPrimary} mb-2`}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClasses}
                    required
                  />
                </div>
                <Button type="submit" variant="primary" disabled={loading} className="w-full">
                  {loading ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            )}
          </section>

          {/* Logout */}
          <Button variant="danger" onClick={logout} className="w-full">
            Logout
          </Button>
        </div>
      </main>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
};

export default ProfilePage;