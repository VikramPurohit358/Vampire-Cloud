'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConnectionState, AuthSession } from '@/app/types';
import { ConnectionPill } from './ConnectionPill';
import { fmt, shortWallet } from './utils';

interface Props {
  connection: ConnectionState;
  session: AuthSession | null;
  onLogout: () => void;
  onOpenLoginModal?: () => void;
}

export function Navbar({
  connection,
  session,
  onLogout,
  onOpenLoginModal,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = () => {
    if (!session) return null;
    if (session.role === 'admin') {
      return (
        <span className="rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          Root Admin
        </span>
      );
    }
    if (session.role === 'company') {
      return (
        <span className="rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          Enterprise Client
        </span>
      );
    }
    return (
      <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
        Compute Contributor
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
              Vampire Cloud
            </span>
            {getRoleBadge()}
          </div>
        </div>

        {/* Right side Profile Area & Connection Pill */}
        <div className="flex items-center gap-3">
          <ConnectionPill connection={connection} />

          {session ? (
            /* Profile Dropdown Area */
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 hover:border-slate-700 transition focus:outline-none"
              >
                {/* Avatar Icon */}
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-200">
                  {(session.name || session.email || 'U')[0].toUpperCase()}
                </div>

                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                    {session.name || session.email || (session as any).wallet}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    {session.role}
                  </span>
                </div>

                <svg className="w-3.5 h-3.5 text-slate-500 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-2xl z-50 animate-slide-down-fade ring-1 ring-white/5">
                  <div className="border-b border-slate-800 pb-3 mb-3">
                    <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Signed in as</p>
                    <p className="font-semibold text-sm text-slate-100 truncate mt-0.5">
                      {session.name || 'Contributor'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      {session.email || shortWallet((session as any).wallet)}
                    </p>
                  </div>

                  {/* Role-specific interactive detail rows */}
                  <div className="space-y-1.5 mb-4 text-xs font-mono">
                    <div className="flex items-center justify-between p-2 rounded-lg transition-colors hover:bg-slate-800/60 text-slate-300 font-sans">
                      <span className="text-slate-400">Authority Tier:</span>
                      <span className="font-mono uppercase font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                        {session.role}
                      </span>
                    </div>

                    {session.role === 'company' && 'allocatedBudget' in session && (
                      <div className="flex items-center justify-between p-2 rounded-lg transition-colors hover:bg-slate-800/60 text-slate-300 font-sans">
                        <span className="text-slate-400">Compute Credits:</span>
                        <span className="font-mono text-blue-400 font-semibold tabular-nums">
                          {fmt((session as any).allocatedBudget)} VAMP
                        </span>
                      </div>
                    )}

                    {session.role === 'user' && 'wallet' in session && (
                      <div className="p-2 rounded-lg transition-colors hover:bg-slate-800/60 font-sans">
                        <span className="text-slate-400 block mb-1 text-[11px]">Settlement Wallet:</span>
                        <span className="font-mono text-[11px] text-emerald-400 break-all block bg-slate-950 p-2 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                          {(session as any).wallet}
                        </span>
                      </div>
                    )}

                    {session.role === 'admin' && (
                      <div className="rounded-lg bg-purple-500/10 border border-purple-500/25 p-2.5 text-[11px] text-purple-300 font-sans transition-colors hover:bg-purple-500/15">
                        Root administrator authority over global grid, client onboarding, and ledger.
                      </div>
                    )}
                  </div>

                  {/* Sign out button */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full rounded-lg bg-slate-800/80 hover:bg-rose-500/15 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 py-2.5 text-xs font-semibold text-slate-200 transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition"
            >
              Sign In →
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
