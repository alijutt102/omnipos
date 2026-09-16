import React, { useState } from 'react';
import { api } from '../../services/api.ts';
import { User } from '../../types.ts';
import { ArrowRight, Store, Lock } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const e = email.trim();
    const p = password;
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(e, p);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 antialiased font-sans text-slate-800 relative">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-3 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Computer Store POS</h1>
            <p className="text-xs text-slate-500">Retail Sales, Inventory & Repair Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>System Online</span>
        </div>
      </header>

      {/* Center Cards Container */}
      <div className="w-full max-w-5xl mx-auto my-auto py-8">
        <div className="text-center max-w-lg mx-auto mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to your workstation</h2>
          <p className="text-sm text-slate-600 mt-1">Sign in with your email and password.</p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Custom Sign In</h4>
                <p className="text-xs text-slate-500">Sign in with email and password</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  placeholder="staff@mycomputerstore.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In to System</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
              Multi-branch database & cashier terminals connected.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center py-3 text-xs text-slate-400">
        OmniPOS Computer Store System • All core retail modules active
      </footer>
    </div>
  );
};
