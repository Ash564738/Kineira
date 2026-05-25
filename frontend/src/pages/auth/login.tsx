// src/pages/auth/login.tsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl text-white mb-4">Login</h2>
        {error && <p className="text-red-400 mb-2">{error}</p>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-slate-800 text-white"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-slate-800 text-white"
          required
        />
        <button type="submit" className="w-full py-2 bg-white text-black rounded font-semibold">
          Login
        </button>
        <p className="text-gray-400 mt-4 text-center">
          Don't have an account? <Link href="/auth/register" className="text-white underline">Register</Link>
        </p>
      </form>
    </div>
  );
}