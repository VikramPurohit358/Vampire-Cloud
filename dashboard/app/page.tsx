'use client';

import { useEffect, useState } from 'react';
import { useObserver } from '@/app/hooks/useObserver';
import { Navbar } from '@/app/components/Navbar';
import { CompanyPortal } from '@/app/components/CompanyPortal';
import { WorkerPortal } from '@/app/components/WorkerPortal';
import { AdminPortal } from '@/app/components/AdminPortal';
import { LoginPage } from '@/app/components/LoginPage';
import { CyberBackground } from '@/app/components/CyberBackground';
import { getApiBaseUrl } from '@/app/components/utils';
import type { AuthSession, AdminSession, CompanySession, UserSession } from '@/app/types';

export default function DashboardPage() {
  // Authentication session state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Restore authenticated session from localStorage on initial mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token') || params.get('inviteToken');
        if (t) {
          window.location.href = `/invite?token=${encodeURIComponent(t)}`;
          return;
        }
      }
      const savedAuth = localStorage.getItem('vc_auth_session');
      if (savedAuth) {
        setSession(JSON.parse(savedAuth));
      }
    } catch {
      // ignore parse errors
    } finally {
      setAuthChecked(true);
    }
  }, []);

  // Telemetry observer connects strictly when an authenticated session exists
  const { snapshot, connection } = useObserver(!!session);

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    try {
      localStorage.setItem('vc_auth_session', JSON.stringify(newSession));
    } catch {}
  };

  const handleLogout = () => {
    setSession(null);
    try {
      localStorage.removeItem('vc_auth_session');
      sessionStorage.removeItem('vc_guest_explore');
    } catch {}
  };

  // While checking stored session, show clean dark background
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>Initializing secure environment...</span>
        </div>
      </div>
    );
  }

  // Without login, require authentication - strictly no telemetry, logs, or batch info leaked
  if (!session) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Cast role-specific sessions
  const companySession: CompanySession | null = session.role === 'company' ? (session as CompanySession) : null;
  const userSession: UserSession | null = session.role === 'user' ? (session as UserSession) : null;
  const adminSession: AdminSession | null = session.role === 'admin' ? (session as AdminSession) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased relative selection:bg-blue-600/30 selection:text-blue-200">
      {/* Background ambient cyber grid and multi-color lighting */}
      <CyberBackground />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-40 cyber-grid"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-[30%] left-[20%] w-[60vw] h-[50vh] rounded-full bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[45vw] h-[45vh] rounded-full bg-gradient-to-b from-purple-600/10 via-pink-600/5 to-transparent blur-[140px]" />
        <div className="absolute top-[80%] left-[5%] w-[35vw] h-[35vh] rounded-full bg-gradient-to-b from-emerald-600/10 to-transparent blur-[130px]" />
      </div>

      {/* Top Navbar with profile area */}
      <Navbar
        connection={connection}
        session={session}
        onLogout={handleLogout}
      />

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
        {/* CASE 1: ROOT ADMIN DASHBOARD */}
        {session.role === 'admin' && adminSession && (
          <AdminPortal
            session={adminSession}
            onLogout={handleLogout}
          />
        )}

        {/* CASE 2: ENTERPRISE CLIENT DASHBOARD */}
        {session.role === 'company' && companySession && (
          <CompanyPortal
            batches={snapshot?.batches || []}
            session={companySession}
            onLogin={(newSess) => handleLoginSuccess(newSess)}
            onLogout={handleLogout}
          />
        )}

        {/* CASE 3: COMPUTE CONTRIBUTOR / WORKER DASHBOARD */}
        {session.role === 'user' && userSession && (
          <WorkerPortal
            nodes={snapshot?.nodes || []}
            session={userSession}
            onLogin={(newSess) => handleLoginSuccess(newSess)}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Production Enterprise Footer */}
      <footer className="mt-12 border-t border-slate-800 bg-slate-950 py-5 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-3">
          <span>Vampire Cloud · Enterprise Distributed Compute Platform</span>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <a
              href={`${getApiBaseUrl()}/healthz`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              /healthz
            </a>
            <a
              href={`${getApiBaseUrl()}/api/pricing/spot`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              /pricing/spot
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
