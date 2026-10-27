'use client';

import { useEffect, useState } from 'react';
import { useObserver } from '@/app/hooks/useObserver';
import { useTick } from '@/app/hooks/useTick';
import { Navbar } from '@/app/components/Navbar';
import { Stat } from '@/app/components/Stat';
import { NodeCard } from '@/app/components/NodeCard';
import { Leaderboard } from '@/app/components/Leaderboard';
import { EventLog } from '@/app/components/EventLog';
import { CompanyPortal } from '@/app/components/CompanyPortal';
import { WorkerPortal } from '@/app/components/WorkerPortal';
import { AdminPortal } from '@/app/components/AdminPortal';
import { LoginPage } from '@/app/components/LoginPage';
import { fmt, getApiBaseUrl } from '@/app/components/utils';
import type { AuthSession, AdminSession, CompanySession, UserSession } from '@/app/types';

export default function DashboardPage() {
  const { snapshot, connection, clockSkew } = useObserver();

  // Authentication session state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  // Restore authenticated session from localStorage on initial mount
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('vc_auth_session');
      if (savedAuth) {
        setSession(JSON.parse(savedAuth));
      }
      const savedGuest = sessionStorage.getItem('vc_guest_explore');
      if (savedGuest) {
        setGuestMode(true);
      }
    } catch {
      // ignore parse errors
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setShowLoginModal(false);
    setGuestMode(false);
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
    setGuestMode(false);
  };

  useTick(1000);

  const stats = snapshot?.stats;
  const safeTotal = stats?.totalTasks && stats.totalTasks > 0 ? stats.totalTasks : 0;
  const safeCompleted = stats?.completedTasks && stats.completedTasks > 0 ? stats.completedTasks : 0;
  const pct = safeTotal > 0 ? Math.min(100, Math.max(0, (safeCompleted / safeTotal) * 100)) : 0;
  const inFlightPct =
    safeTotal > 0 && stats?.assignedTasks && stats.assignedTasks > 0
      ? Math.min(100 - pct, Math.max(0, (stats.assignedTasks / safeTotal) * 100))
      : 0;

  const serverNow = Date.now() + clockSkew;
  const timeoutMs = snapshot?.config?.taskTimeoutMs ?? 30_000;

  // If not authenticated and not in guest observer mode, show the secure login page
  if (authChecked && !session && !guestMode) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onExploreGuest={() => {
          sessionStorage.setItem('vc_guest_explore', 'true');
          setGuestMode(true);
        }}
      />
    );
  }

  // Cast role-specific sessions
  const companySession: CompanySession | null = session?.role === 'company' ? (session as CompanySession) : null;
  const userSession: UserSession | null = session?.role === 'user' ? (session as UserSession) : null;
  const adminSession: AdminSession | null = session?.role === 'admin' ? (session as AdminSession) : null;

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
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {/* Login Modal overlay if requested */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md">
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white p-2"
              title="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onExploreGuest={() => setShowLoginModal(false)}
            />
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
        
        {/* ── CASE 1: ROOT ADMIN DASHBOARD ── */}
        {session?.role === 'admin' && adminSession && (
          <AdminPortal
            session={adminSession}
            onLogout={handleLogout}
          />
        )}

        {/* ── CASE 2: ENTERPRISE CLIENT DASHBOARD ── */}
        {session?.role === 'company' && companySession && (
          <CompanyPortal
            batches={snapshot?.batches || []}
            session={companySession}
            onLogin={(newSess) => handleLoginSuccess(newSess)}
            onLogout={handleLogout}
          />
        )}

        {/* ── CASE 3: COMPUTE CONTRIBUTOR / WORKER DASHBOARD ── */}
        {session?.role === 'user' && userSession && (
          <WorkerPortal
            nodes={snapshot?.nodes || []}
            session={userSession}
            onLogin={(newSess) => handleLoginSuccess(newSess)}
            onLogout={handleLogout}
          />
        )}

        {/* ── CASE 4: GUEST OBSERVER VIEW (GLOBAL TELEMETRY) ── */}
        {!session && (
          <div className="space-y-6 animate-fade-in">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
                  Global Distributed Compute Grid
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Decentralized computational power executing verified cryptographic workloads.
                  {stats ? (
                    <span className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-mono border border-slate-700">
                      Batch #{stats.batch}
                    </span>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition"
              >
                Sign In to Command Center →
              </button>
            </div>

            {/* Global progress vial */}
            <section
              aria-label="Overall progress"
              className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold tabular-nums font-mono text-slate-100 sm:text-6xl">
                    {pct.toFixed(pct === 100 || pct === 0 ? 0 : 1)}
                    <span className="text-2xl text-slate-500 sm:text-3xl">%</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Workload Verified</span>
                </div>
                <span className="text-xs tabular-nums text-slate-400 font-mono">
                  {stats
                    ? `${fmt(stats.completedTasks)} of ${fmt(stats.totalTasks)} tasks verified`
                    : 'Connecting to master orchestrator…'}
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                className="relative mt-5 h-4 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
                {inFlightPct > 0 && (
                  <div
                    className="absolute top-0 h-full bg-blue-400/20 transition-[left,width] duration-700"
                    style={{
                      left: `${pct}%`,
                      width: `${inFlightPct}%`,
                    }}
                    title="Workload currently in-flight"
                  />
                )}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Nodes Online" value={stats?.connectedNodes} />
                <Stat label="Active Computing" value={stats?.computingNodes} />
                <Stat label="Queue Depth" value={stats?.pendingTasks} />
                <Stat
                  label="Retry Penalties"
                  value={stats?.requeued}
                  warn={!!stats && stats.requeued > 0}
                />
                <Stat
                  label="Timeouts"
                  value={stats?.timeouts}
                  warn={!!stats && stats.timeouts > 0}
                />
                <Stat label="VAMP Minted" value={stats?.totalMinted} />
              </dl>
            </section>

            {/* Node grid + Leaderboard */}
            <div className="grid gap-6 lg:grid-cols-12">
              <section aria-label="Worker nodes" className="lg:col-span-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-slate-100">
                    Active Compute Nodes{' '}
                    <span className="text-xs font-normal text-slate-400">
                      ({snapshot?.nodes?.length ?? 0} connected)
                    </span>
                  </h2>
                </div>

                {!snapshot || !snapshot.nodes || snapshot.nodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 p-10 text-center text-xs text-slate-400 bg-slate-900/40">
                    <svg className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="font-medium text-slate-200">No external hardware nodes connected yet</p>
                    <p className="mt-1 text-slate-500">Launch a worker node to start monetizing idle compute.</p>
                  </div>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {snapshot.nodes.map((n) => (
                      <NodeCard
                        key={n.id}
                        node={n}
                        serverNow={serverNow}
                        timeoutMs={timeoutMs}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Earnings leaderboard" className="lg:col-span-4">
                <h2 className="text-base font-semibold text-slate-100 mb-3">
                  Contributor Leaderboard
                </h2>
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  <Leaderboard rows={snapshot?.leaderboard ?? []} />
                </div>
              </section>
            </div>

            {/* Grid events log */}
            <section aria-label="Grid events">
              <h2 className="text-base font-semibold text-slate-100 mb-3">
                Live Audit & Telemetry Log
              </h2>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
                <EventLog events={snapshot?.events ?? []} />
              </div>
            </section>
          </div>
        )}

      </main>

      {/* Enterprise Footer */}
      <footer className="mt-12 border-t border-slate-800 bg-slate-950 py-5 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-3">
          <span>Vampire Cloud v2.0-enterprise · Autonomous Distributed Grid</span>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <a
              href={`${getApiBaseUrl()}/metrics`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              /metrics
            </a>
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
