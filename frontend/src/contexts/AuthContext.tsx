import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface User {
  id: number;
  email: string;
  username: string;
  avatar_url: string | null;
  email_verified: boolean;
  xp: number;
  level: number;
  streak: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (avatar_url?: string, username?: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);
  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };
  const refreshUser = async () => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      await fetchCurrentUser(savedToken);
    }
  };
  const login = async (email: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('auth_token', data.access_token);
    router.push('/');
  };

  const register = async (email: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Registration failed');
    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('auth_token', data.access_token);
    router.push('/');
  };

  const googleLogin = async (googleToken: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken }),
    });
    if (!res.ok) throw new Error('Google login failed');
    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('auth_token', data.access_token);
    router.push('/');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    router.push('/auth/login');
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Failed to send reset email');
  };

  const resetPassword = async (resetToken: string, newPassword: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, new_password: newPassword }),
    });
    if (!res.ok) throw new Error('Password reset failed');
  };

  const updateProfile = async (avatar_url?: string, username?: string) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/profile?avatar_url=${avatar_url || ''}&username=${username || ''}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );
    if (!res.ok) throw new Error('Profile update failed');
    const updatedUser = await res.json();
    setUser(updatedUser);
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/change-password?old_password=${oldPassword}&new_password=${newPassword}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );
    if (!res.ok) throw new Error('Password change failed');
  };

  const verifyEmail = async (verifyToken: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
    if (!res.ok) throw new Error('Email verification failed');
    if (user) {
      setUser({ ...user, email_verified: true });
    }
  };

  const resendVerification = async () => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to resend verification');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        googleLogin,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        changePassword,
        verifyEmail,
        resendVerification,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}