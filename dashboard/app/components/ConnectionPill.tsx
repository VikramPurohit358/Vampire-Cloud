import type { ConnectionState } from '@/app/types';

const MAP: Record<ConnectionState, { text: string; dot: string; style: string }> = {
  live: {
    text: 'Grid Master Online',
    dot: 'bg-emerald-400',
    style: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  },
  connecting: {
    text: 'Connecting to Master…',
    dot: 'bg-amber-400 animate-pulse',
    style: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
  },
  reconnecting: {
    text: 'Reconnecting to Grid…',
    dot: 'bg-rose-400 animate-pulse',
    style: 'border-rose-500/20 bg-rose-500/5 text-rose-300',
  },
  disconnected: {
    text: 'Orchestrator Standby',
    dot: 'bg-slate-400',
    style: 'border-slate-700 bg-slate-800/40 text-slate-400',
  },
};

export function ConnectionPill({ connection }: { connection: ConnectionState }) {
  const { text, dot, style } = MAP[connection];
  const isPulsing = connection === 'live' || connection === 'connecting' || connection === 'reconnecting';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-all duration-300 ${style}`}
    >
      <span className="relative flex h-2 w-2">
        {isPulsing && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dot.split(' ')[0]}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot.split(' ')[0]}`} />
      </span>
      <span className="font-sans tracking-tight">{text}</span>
    </div>
  );
}
