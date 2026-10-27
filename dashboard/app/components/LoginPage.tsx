'use client';

import { useState } from 'react';
import type { AuthSession } from '@/app/types';
import { getApiBaseUrl } from './utils';

interface Props {
  onLoginSuccess: (session: AuthSession) => void;
  onExploreGuest?: () => void;
}

export function LoginPage({ onLoginSuccess }: Props) {
  const [view, setView] = useState<'login' | 'register' | 'invite'>('login');
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Register form state (for compute contributors only)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regWallet, setRegWallet] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Invite redemption state (for enterprise clients)
  const [inviteToken, setInviteToken] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteConfirm, setInviteConfirm] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (data.ok && data.session) {
        onLoginSuccess(data.session);
      } else {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch {
      setError('Unable to establish secure connection with master node. Please ensure server is reachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          wallet: regWallet.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok && data.session) {
        onLoginSuccess(data.session);
      } else {
        setRegError(data.error || 'Registration failed. Please check inputs.');
      }
    } catch {
      setRegError('Failed to connect to authentication server.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    if (invitePassword !== inviteConfirm) {
      setInviteError('Passwords do not match');
      return;
    }
    if (invitePassword.length < 8) {
      setInviteError('Password must be at least 8 characters long');
      return;
    }

    setInviteLoading(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken.trim(),
          password: invitePassword,
        }),
      });
      const data = await res.json();
      if (data.ok && data.session) {
        onLoginSuccess(data.session);
      } else {
        setInviteError(data.error || 'Invalid or expired invitation token');
      }
    } catch {
      setInviteError('Could not process invitation redemption');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle 800px at 50% 15%, rgba(59, 130, 246, 0.15) 0%, transparent 70%), radial-gradient(circle 600px at 80% 85%, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 shadow-xl mb-3 text-blue-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Vampire Cloud
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Enterprise Distributed Compute & Autonomous Proof Grid
          </p>
        </div>

        {/* Authentication Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl">
          
          {/* ─── VIEW 1: SINGLE SECURE LOGIN FORM ─── */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Sign in to your account</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your credentials to access your designated command center.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 leading-relaxed flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Corporate / User Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <span className="text-[11px] text-slate-500">256-bit TLS Encrypted</span>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? 'Authenticating Identity…' : 'Sign In →'}
              </button>

              <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2 text-center text-xs">
                <button
                  type="button"
                  onClick={() => { setView('register'); setError(null); }}
                  className="text-slate-400 hover:text-blue-400 transition"
                >
                  Need to contribute compute? <strong className="text-blue-400">Join as Contributor</strong>
                </button>
                <button
                  type="button"
                  onClick={() => { setView('invite'); setError(null); }}
                  className="text-slate-500 hover:text-slate-300 transition text-[11px]"
                >
                  Have an Enterprise Invitation Token? Redeem Invitation
                </button>
              </div>
            </form>
          )}

          {/* ─── VIEW 2: CONTRIBUTOR SIGN-UP ─── */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Contribute Compute Resources</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monetize your idle hardware cycles by solving verified distributed tasks.
                </p>
              </div>

              {regError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 leading-relaxed">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Contributor Name / Handle
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. NodeOperator-01"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="operator@network.org"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account Password
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Payout Wallet Address (Optional)
                </label>
                <input
                  type="text"
                  value={regWallet}
                  onChange={(e) => setRegWallet(e.target.value)}
                  placeholder="0x... (auto-generated if left blank)"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition active:scale-[0.99] disabled:opacity-50"
              >
                {regLoading ? 'Creating Contributor Profile…' : 'Register & Launch Miner →'}
              </button>

              <div className="pt-3 border-t border-slate-800/80 text-center">
                <button
                  type="button"
                  onClick={() => { setView('login'); setRegError(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Already have an account? <span className="text-blue-400">Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* ─── VIEW 3: REDEEM ENTERPRISE INVITATION ─── */}
          {view === 'invite' && (
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Redeem Enterprise Invitation</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Activate your corporate compute portal using your invitation link token.
                </p>
              </div>

              {inviteError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 leading-relaxed">
                  {inviteError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Invitation Token
                </label>
                <input
                  type="text"
                  required
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Paste 48-character invite token"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Set Organization Master Password
                </label>
                <input
                  type="password"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={inviteConfirm}
                  onChange={(e) => setInviteConfirm(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
              >
                {inviteLoading ? 'Activating Enterprise Account…' : 'Activate & Enter Enterprise Portal →'}
              </button>

              <div className="pt-3 border-t border-slate-800/80 text-center">
                <button
                  type="button"
                  onClick={() => { setView('login'); setInviteError(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  ← Return to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Security / Compliance footer */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>TLS 1.3 Encrypted · Secure Distributed Compute Network</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
