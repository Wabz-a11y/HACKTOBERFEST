import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../services/api';
import { Pill, ShieldCheck, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('patient@medreminder.io');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex bg-primary-600 text-white p-3.5 rounded-2xl shadow-lg mb-3">
            <Pill className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Smart Medication Reminder</h1>
          <p className="text-sm text-slate-500 mt-1">Intelligent Clinical & Medication Assistant</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="you@domain.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition shadow-md flex items-center justify-center space-x-2 text-sm"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
            Quick Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDemoAccount('patient@medreminder.io')}
              className="px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('caregiver@medreminder.io')}
              className="px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Caregiver
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('doctor@medreminder.io')}
              className="px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Doctor
            </button>
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link to="/register" className="text-xs text-primary-600 hover:text-primary-700 font-semibold">
            Need an account? Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

