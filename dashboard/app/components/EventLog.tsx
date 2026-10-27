import type { GridEvent } from '@/app/types';
import { clock, LEVEL_STYLE } from './utils';

interface Props {
  events: GridEvent[];
}

export function EventLog({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
        <svg className="w-8 h-8 text-slate-700 mb-2 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No grid telemetry events recorded in current observation session.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5 font-mono text-xs leading-relaxed divide-y divide-slate-800/40">
      {events.map((e, i) => (
        <li
          key={`${e.ts}-${i}`}
          className={`pt-1.5 first:pt-0 ${LEVEL_STYLE[e.level]} flex items-start gap-2.5`}
        >
          <span className="shrink-0 text-slate-500 tabular-nums">[{clock(e.ts)}]</span>
          <span className="flex-1 break-words">{e.message}</span>
        </li>
      ))}
    </ul>
  );
}
