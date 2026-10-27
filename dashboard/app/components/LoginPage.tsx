'use client';

import { useState } from 'react';
import type { AuthSession } from '@/app/types';
import { getApiBaseUrl } from './utils';
import { CyberBackground } from './CyberBackground';

interface Props {
  onLoginSuccess: (session: AuthSession) => void;
  onExploreGuest?: () => void;
}

export function LoginPage({ onLoginSuccess }: Props) {
  const [view, setView] = useState<'login' | 'register' | 'invite'>('login');
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'company' | 'user' | null>(null);
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

  const fillDemoRole = (role: 'admin' | 'company' | 'user') => {
    setView('login');
    setError(null);
    setSelectedRole(role);
    if (role === 'admin') {
      setEmail('admin@vampirecloud.network');
      setPassword('admin123');
    } else if (role === 'company') {
      setEmail('company@apexquantum.ai');
      setPassword('company123');
    } else {
      setEmail('user@vampirecloud.network');
      setPassword('user123');
    }
  };

  const quickLaunchRole = async (role: 'admin' | 'company' | 'user', e: React.MouseEvent) => {
    e.stopPropagation();
    let targetEmail = 'admin@vampirecloud.network';
    let targetPass = 'admin123';
    if (role === 'company') {
      targetEmail = 'company@apexquantum.ai';
      targetPass = 'company123';
    } else if (role === 'user') {
      targetEmail = 'user@vampirecloud.network';
      targetPass = 'user123';
    }
    setEmail(targetEmail);
    setPassword(targetPass);
    setSelectedRole(role);
    setView('login');
    setError(null);
    setLoading(true);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      });
      const data = await res.json();
      if (data.ok && data.session) {
        onLoginSuccess(data.session);
      } else {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch {
      setError('Unable to establish secure connection with master node.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden cyber-grid selection:bg-blue-600/30 selection:text-blue-200">
      {/* Interactive Constellation Cyber Canvas Background */}
      <CyberBackground />

      {/* Ambient gradient lighting pools */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] rounded-full bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-purple-600/10 blur-[140px] opacity-75" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute top-10 -right-20 w-80 h-80 rounded-full bg-cyan-600/10 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand header with animated concentric orbital rings */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center mb-5">
            {/* Outer orbit ring */}
            <div className="absolute w-28 h-28 rounded-full border border-dashed border-blue-500/25 animate-orbit pointer-events-none" />
            {/* Inner counter-orbit ring */}
            <div className="absolute w-24 h-24 rounded-full border border-dotted border-purple-500/25 animate-orbit-reverse pointer-events-none" />
            {/* Glow aura */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 blur-xl opacity-60 animate-pulse-glow" />
            
            {/* Center Emblem Core */}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-blue-400/40 shadow-[0_0_30px_rgba(59,130,246,0.35)] text-blue-400">
              <svg className="w-8 h-8 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Vampire</span>
            <span className="text-gradient-cyan">Cloud</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto font-sans leading-relaxed">
            Enterprise Distributed Compute Grid · High-Performance Cryptographic Ledger
          </p>

          {/* Live Network Health Status Ticker */}
          <div className="mt-3.5 inline-flex items-center gap-2.5 rounded-full border border-slate-800/80 bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-mono text-slate-300 shadow-lg shadow-black/50 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Cluster Status: <strong className="text-emerald-400 font-semibold">100% Operational</strong></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">Latency: <span className="text-cyan-400 font-medium">~18ms</span></span>
          </div>
        </div>

        {/* Authentication Card with Glassmorphic Elevation */}
        <div className="card-glow rounded-3xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/90 ring-1 ring-white/10">
          
          {/* Quick-Access Demo Profile Switcher */}
          <div className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                Quick Test Access
              </span>
              <span className="text-[10px] font-normal text-slate-500 font-mono">1-click direct login</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {/* Admin Card */}
              <div
                onClick={() => fillDemoRole('admin')}
                className={`group cursor-pointer flex flex-col justify-between p-2.5 rounded-xl border transition-all text-center relative ${
                  selectedRole === 'admin'
                    ? 'border-purple-500/60 bg-purple-500/15 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/15 hover:border-purple-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-semibold text-purple-300">👑 Admin</span>
                  </div>
                  <span className="text-[10px] text-purple-400/80 font-mono block mt-0.5">Root Console</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => quickLaunchRole('admin', e)}
                  disabled={loading}
                  className="mt-2 w-full py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 text-[10px] font-semibold transition active:scale-95 border border-purple-500/30"
                  title="Direct 1-click login as Admin"
                >
                  Launch ⚡
                </button>
              </div>

              {/* Enterprise Card */}
              <div
                onClick={() => fillDemoRole('company')}
                className={`group cursor-pointer flex flex-col justify-between p-2.5 rounded-xl border transition-all text-center relative ${
                  selectedRole === 'company'
                    ? 'border-blue-500/60 bg-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    : 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-semibold text-cyan-300">🏢 Enterprise</span>
                  </div>
                  <span className="text-[10px] text-cyan-400/80 font-mono block mt-0.5">Workloads</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => quickLaunchRole('company', e)}
                  disabled={loading}
                  className="mt-2 w-full py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-cyan-200 text-[10px] font-semibold transition active:scale-95 border border-blue-500/30"
                  title="Direct 1-click login as Enterprise"
                >
                  Launch ⚡
                </button>
              </div>

              {/* Worker Card */}
              <div
                onClick={() => fillDemoRole('user')}
                className={`group cursor-pointer flex flex-col justify-between p-2.5 rounded-xl border transition-all text-center relative ${
                  selectedRole === 'user'
                    ? 'border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-semibold text-emerald-300">⚡ Worker</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 font-mono block mt-0.5">Miner Pool</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => quickLaunchRole('user', e)}
                  disabled={loading}
                  className="mt-2 w-full py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 text-[10px] font-semibold transition active:scale-95 border border-emerald-500/30"
                  title="Direct 1-click login as Worker"
                >
                  Launch ⚡
                </button>
              </div>
            </div>
          </div>

          {/* Segmented Tab Bar */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setView('login'); setError(null); }}
              className={`rounded-lg py-1.5 transition-all duration-200 ${
                view === 'login'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setView('register'); setRegError(null); }}
              className={`rounded-lg py-1.5 transition-all duration-200 ${
                view === 'register'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Contributor Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setView('invite'); setInviteError(null); }}
              className={`rounded-lg py-1.5 transition-all duration-200 ${
                view === 'invite'
                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Redeem Invite
            </button>
          </div>

          {/* ─── VIEW 1: SINGLE SECURE LOGIN FORM ─── */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 leading-relaxed flex items-start gap-2.5">
                  <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Corporate / Contributor Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 font-mono transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">TLS 1.3 Encrypted</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 font-mono transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 py-3 text-xs font-semibold text-white shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 border border-blue-400/30"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Cryptographic Credentials…</span>
                  </>
                ) : (
                  <span>Access Command Center →</span>
                )}
              </button>
            </form>
          )}

          {/* ─── VIEW 2: CONTRIBUTOR SIGN-UP ─── */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Contribute Compute Resources</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monetize your idle hardware cycles by solving verified distributed tasks.
                </p>
              </div>

              {regError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 leading-relaxed flex items-start gap-2.5">
                  <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{regError}</span>
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
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 transition"
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
                  placeholder="operator@network.io"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Payout Wallet Address <span className="text-slate-500 font-normal">(Optional, can be added later)</span>
                </label>
                <input
                  type="text"
                  value={regWallet}
                  onChange={(e) => setRegWallet(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-mono transition"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 text-xs font-semibold text-white shadow-xl shadow-emerald-600/30 transition-all active:scale-[0.99] disabled:opacity-50 border border-emerald-400/30"
              >
                {regLoading ? 'Registering Compute Node…' : 'Complete Contributor Registration →'}
              </button>
            </form>
          )}

          {/* ─── VIEW 3: REDEEM ENTERPRISE INVITATION ─── */}
          {view === 'invite' && (
            <form onSubmit={handleAcceptInvite} className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Redeem Enterprise Invitation</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Activate corporate compute allocation using your cryptographically signed onboarding token.
                </p>
              </div>

              {inviteError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 leading-relaxed flex items-start gap-2.5">
                  <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{inviteError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Cryptographic Invitation Token
                </label>
                <input
                  type="text"
                  required
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Paste invitation token (e.g. inv_...)"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Set Organization Password
                </label>
                <input
                  type="password"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 font-mono transition"
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
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 font-mono transition"
                />
              </div>

              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-3 text-xs font-semibold text-white shadow-xl shadow-purple-600/30 transition-all active:scale-[0.99] disabled:opacity-50 border border-purple-400/30"
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

          {/* 3 Cyberpunk Value Proposition Badges */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] font-semibold text-slate-300 block">🛡️ SHA-256</span>
              <span className="text-[9px] text-slate-500 font-mono">Proof Verification</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] font-semibold text-slate-300 block">⚡ Micro-Settled</span>
              <span className="text-[9px] text-slate-500 font-mono">VAMP Token Ledger</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] font-semibold text-slate-300 block">🌐 OCI Sandboxed</span>
              <span className="text-[9px] text-slate-500 font-mono">Zero-Trust Compute</span>
            </div>
          </div>

          {/* Security / Compliance footer */}
          <div className="mt-4 pt-3 text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>TLS 1.3 Encrypted · Decentralized Fault-Tolerant Mesh</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
