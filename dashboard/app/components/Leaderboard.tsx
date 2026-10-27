import { useState } from 'react';
import type { LeaderboardRow } from '@/app/types';
import { shortWallet, fmt } from './utils';

interface Props {
  rows: LeaderboardRow[];
}

export function Leaderboard({ rows }: Props) {
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  const handleCopy = (wallet: string) => {
    navigator.clipboard.writeText(wallet);
    setCopiedWallet(wallet);
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <svg className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-slate-400">No contributor rewards settled in this batch cycle.</p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-slate-800">
      {rows.map((row, i) => (
        <li
          key={row.wallet}
          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-850/50 transition-colors"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-semibold ${
                i === 0
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : i === 1
                  ? 'bg-slate-700 text-slate-200'
                  : i === 2
                  ? 'bg-amber-900/30 text-amber-500'
                  : 'text-slate-500'
              }`}
            >
              {i + 1}
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-mono text-xs font-medium text-slate-200" title={row.wallet}>
                  {shortWallet(row.wallet)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(row.wallet)}
                  className="text-slate-500 hover:text-slate-300 transition"
                  title="Copy full wallet address"
                >
                  {copiedWallet === row.wallet ? (
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mt-0.5">
                {row.tasks} tasks verified&nbsp;·&nbsp;
                <span className="text-emerald-400 font-medium">{row.activeNodes} online</span>
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right tabular-nums">
            <span className="font-mono text-sm font-semibold text-slate-100">
              {fmt(row.earnings)}
            </span>{' '}
            <span className="text-[10px] font-mono text-blue-400 font-medium">VAMP</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
