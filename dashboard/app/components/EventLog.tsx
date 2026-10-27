import type { GridEvent } from '@/app/types';
import { clock, LEVEL_STYLE } from './utils';

interface Props {
  events: GridEvent[];
}

export function EventLog({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-slate-500">
        <div className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-center mb-2.5">
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-mono text-slate-400">No grid telemetry events recorded in current observation session.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5 font-mono text-xs leading-relaxed divide-y divide-slate-800/40 max-h-72 overflow-y-auto pr-1">
      {events.map((e, i) => (
        <li
          key={`${e.ts}-${i}`}
          className={`pt-2 pb-1.5 first:pt-0 ${LEVEL_STYLE[e.level]} flex items-start gap-2.5 hover:bg-cyan-500/5 px-2 rounded-lg transition-colors border border-transparent hover:border-cyan-500/20`}
        >
          <span className="shrink-0 text-slate-500 tabular-nums text-[11px] font-mono bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/60">
            {clock(e.ts)}
          </span>
          <span className="flex-1 break-words">{e.message}</span>
        </li>
      ))}
    </ul>
  );
}
