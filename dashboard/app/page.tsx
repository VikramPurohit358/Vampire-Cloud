'use client';

import { useEffect, useState } from 'react';
import { useObserver } from '@/app/hooks/useObserver';
import { Navbar } from '@/app/components/Navbar';
import { CompanyPortal } from '@/app/components/CompanyPortal';
import { WorkerPortal } from '@/app/components/WorkerPortal';
import { AdminPortal } from '@/app/components/AdminPortal';
import { LoginPage } from '@/app/components/LoginPage';
import { getApiBaseUrl } from '@/app/components/utils';
import type { AuthSession, AdminSession, CompanySession, UserSession } from '@/app/types';

export default function DashboardPage() {
  // Authentication session state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Restore authenticated session from localStorage on initial mount
  useEffect(() => {
    try {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.25) 0%, transparent 60%)',
        }}
      />

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
