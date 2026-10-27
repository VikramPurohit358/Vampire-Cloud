import { useState } from 'react';
import type { WorkerNode } from '@/app/types';
import { STATUS_STYLE, shortWallet } from './utils';

interface Props {
  node: WorkerNode;
  serverNow: number;
  timeoutMs: number;
}

export function NodeCard({ node, serverNow, timeoutMs }: Props) {
  const [copied, setCopied] = useState(false);
  const s = STATUS_STYLE[node.status] || STATUS_STYLE.offline;
  const elapsed = node.taskStartedAt
    ? Math.max(0, serverNow - node.taskStartedAt)
    : 0;
  const safeTimeout = timeoutMs > 0 ? timeoutMs : 30_000;
  const ratio = Math.min(1, Math.max(0, elapsed / safeTimeout));
  const nearDeadline = ratio > 0.75;

  const copyWallet = () => {
    if (!node.wallet) return;
    navigator.clipboard.writeText(node.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li
      className={[
        'glass-panel card-glow relative overflow-hidden rounded-xl border p-4 transition-all duration-300',
        node.status === 'computing'
          ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
          : 'border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/90',
        node.status === 'offline' ? 'opacity-55' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${node.status === 'computing' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/60 border-slate-700/60 text-slate-400'}`}>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="truncate font-semibold text-sm text-slate-100" title={node.name || 'Worker Node'}>
              {node.name || 'Worker Node'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <span className="font-mono text-xs text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/70" title={node.wallet || ''}>
              {shortWallet(node.wallet)}
            </span>
            {node.wallet && (
              <button
                type="button"
                onClick={copyWallet}
                className="text-slate-500 hover:text-cyan-400 transition"
                title="Copy full wallet address"
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${s.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>

      {node.status === 'computing' && node.currentTask && (
        <div className="mt-3.5 rounded-lg bg-slate-950/80 border border-emerald-500/20 p-3">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="font-mono truncate pr-2 text-slate-300">Task: {node.currentTask}</span>
            <span className={`shrink-0 tabular-nums font-mono ${nearDeadline ? 'text-amber-400' : 'text-emerald-400'}`}>
              {Math.floor(elapsed / 1000)}s / {Math.round(safeTimeout / 1000)}s
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900 border border-slate-800"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-linear shadow-sm ${
                nearDeadline ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
              }`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
        <span className="tabular-nums font-mono">
          <strong className="text-slate-100">{node.tasksCompleted || 0}</strong> tasks verified
        </span>
        {node.strikes > 0 ? (
          <span className="text-amber-400 font-mono text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {node.strikes} retry penalty
          </span>
        ) : (
          <span className="text-emerald-400 text-[11px] font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            100% Reliability
          </span>
        )}
      </div>
    </li>
  );
}
