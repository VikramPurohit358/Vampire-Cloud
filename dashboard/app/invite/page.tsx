'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiBaseUrl, fmt } from '@/app/components/utils';

interface InviteData {
  companyName: string;
  email: string;
  contactPerson?: string;
  serviceTier?: string;
  allocatedCredits?: number;
  status?: string;
}

function InviteActivationContent() {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [tokenValidating, setTokenValidating] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Extract token from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') || '';
      if (urlToken) {
        setToken(urlToken.trim());
        validateToken(urlToken.trim());
      }
    }
  }, []);

  const validateToken = async (tokenToVerify: string) => {
    if (!tokenToVerify) return;
    setTokenValidating(true);
    setValidationError(null);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/auth/invite/${encodeURIComponent(tokenToVerify)}`);
      const data = await res.json();
      if (data.ok && data.invite) {
        setInviteData(data.invite);
      } else {
        setValidationError(data.error || 'This invitation link is invalid or has expired.');
      }
    } catch {
      setValidationError('Unable to connect to orchestrator to verify invitation token.');
    } finally {
      setTokenValidating(false);
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      validateToken(token.trim());
    }
  };

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (data.ok && data.session) {
        setSuccess(true);
        try {
          localStorage.setItem('vc_auth_session', JSON.stringify(data.session));
        } catch {}
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      } else {
        setSubmitError(data.error || 'Failed to activate account. The invitation may already be redeemed.');
      }
    } catch {
      setSubmitError('Failed to communicate with master orchestrator. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-lg">
      {/* Brand header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 shadow-xl mb-3 text-blue-400 hover:border-blue-500/40 transition">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Vampire Cloud
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Enterprise Distributed Compute Onboarding
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* State 1: Success message */}
        {success ? (
          <div className="text-center py-6 space-y-4 animate-fade-in">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Enterprise Account Activated!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Allocating initial compute credits and loading your Enterprise Portal…
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : tokenValidating ? (
          /* State 2: Validating invitation token */
          <div className="text-center py-10 space-y-3">
            <div className="mx-auto w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-400">
              Verifying cryptographic enterprise invitation token…
            </p>
          </div>
        ) : inviteData ? (
          /* State 3: Valid invite details verified - password setup */
          <form onSubmit={handleActivation} className="space-y-4">
            {/* Enterprise badge banner */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Verified Enterprise Client
                </span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono">
                  {inviteData.serviceTier || 'Enterprise Dedicated'}
                </span>
              </div>
              <div className="text-lg font-bold text-slate-100">
                {inviteData.companyName}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 font-mono pt-1 border-t border-blue-500/20">
                <span>{inviteData.email}</span>
                <span className="text-emerald-400 font-semibold">
                  +{fmt(inviteData.allocatedCredits || 50000)} VAMP Credits
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Set Your Organization Master Password
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Establish the master credentials used to sign in and broadcast workloads.
              </p>
            </div>

            {submitError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{submitError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Master Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm Master Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-3 text-xs font-semibold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? 'Activating Enterprise Account…' : 'Activate & Enter Enterprise Portal →'}
            </button>
          </form>
        ) : (
          /* State 4: Token missing or invalid - allow manual entry */
          <form onSubmit={handleManualTokenSubmit} className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Redeem Enterprise Invitation
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste your enterprise invitation token to activate your computational organization account.
              </p>
            </div>

            {validationError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{validationError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Invitation Token
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token (e.g. 2e8dfa41c617...)"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={tokenValidating || !token.trim()}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
            >
              Verify Invitation Token →
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-slate-800/80 text-center">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            ← Return to Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden antialiased">
      {/* Background ambient gradient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle 800px at 50% 15%, rgba(59, 130, 246, 0.15) 0%, transparent 70%), radial-gradient(circle 600px at 80% 85%, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
        }}
      />
      <Suspense fallback={
        <div className="text-center text-xs font-mono text-slate-400">
          Loading onboarding gateway…
        </div>
      }>
        <InviteActivationContent />
      </Suspense>
    </div>
  );
}
