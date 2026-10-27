'use client';

import { useEffect, useState } from 'react';
import type { Batch, BatchTaskResult } from '@/app/types';
import { fmt, getApiBaseUrl } from './utils';

interface Props {
  batch: Batch;
  onClose: () => void;
}

export function ProofsModal({ batch, onClose }: Props) {
  const [tasks, setTasks] = useState<BatchTaskResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchResults = async () => {
      try {
        const api = getApiBaseUrl();
        const res = await fetch(`${api}/api/batches/${encodeURIComponent(batch.id)}/results`);
        const data = await res.json();
        if (active && data.ok) {
          setTasks(data.results || []);
        }
      } catch {
        // Fallback or retry
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchResults();
    const interval = setInterval(fetchResults, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [batch.id]);

  const copyDigest = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const completed = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl animate-fade-in">
      <div className="card-glow relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-700/80 bg-slate-900/95 shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-cyan-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] text-xs">
                <svg className="w-4 h-4 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{batch.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    VERIFIED ON-CHAIN
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Client: <strong className="text-slate-200">{batch.company}</strong> · {completed.length}/{batch.totalTasks} cryptographic nonces verified
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-3">
              <span className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              <span>Verifying and streaming cryptographic proof ledger…</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400">
              No tasks registered for this batch.
            </div>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              <div className="grid grid-cols-12 gap-2 text-slate-400 border-b border-slate-800 pb-2.5 px-3 font-sans font-semibold uppercase tracking-wider text-[11px]">
                <span className="col-span-3">Task ID</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-3">Nonce</span>
                <span className="col-span-4">Verified SHA-256 Digest</span>
              </div>
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-12 gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 items-center hover:border-slate-700 hover:bg-slate-950/90 transition shadow-sm"
                >
                  <span className="col-span-3 truncate text-slate-200 font-bold">{t.id}</span>
                  <span className="col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                          : t.status === 'assigned'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-400 animate-pulse' : t.status === 'assigned' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                      {t.status.toUpperCase()}
                    </span>
                  </span>
                  <span className="col-span-3 truncate text-slate-300 font-mono text-xs">
                    {t.nonce !== null ? (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">{fmt(t.nonce)}</span>
                    ) : '–'}
                  </span>
                  <div className="col-span-4 flex items-center justify-between gap-1">
                    <span className="truncate text-cyan-300 font-mono text-[11px] bg-cyan-950/40 px-2 py-0.5 rounded-lg border border-cyan-500/20" title={t.hash || 'Pending verification'}>
                      {t.hash ? `${t.hash.slice(0, 12)}…${t.hash.slice(-8)}` : 'Pending'}
                    </span>
                    {t.hash && (
                      <button
                        type="button"
                        onClick={() => copyDigest(t.hash!)}
                        className="text-slate-400 hover:text-white shrink-0 p-1 rounded-lg hover:bg-slate-800 transition"
                        title="Copy proof hash"
                      >
                        {copiedHash === t.hash ? (
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/80 bg-slate-950/80 px-6 py-3.5 flex items-center justify-between text-xs text-slate-400">
          <span>Total Workload Escrow: <strong className="text-white font-mono">{fmt(batch.totalBounty)} VAMP</strong> ({batch.rewardPerTask} VAMP / partition)</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-white transition font-semibold active:scale-95 border border-slate-700"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
