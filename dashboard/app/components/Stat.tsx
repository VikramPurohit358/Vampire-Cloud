import { fmt } from './utils';

interface Props {
  label: string;
  value?: number;
  warn?: boolean;
}

export function Stat({ label, value, warn = false }: Props) {
  return (
    <div className="glass-panel card-glow relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:border-cyan-500/30 hover:scale-[1.01] group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none rounded-tr-xl" />
      <dd
        className={`text-2xl font-bold tabular-nums font-mono tracking-tight ${
          warn ? 'text-amber-400' : 'text-slate-100 group-hover:text-cyan-300 transition-colors'
        }`}
      >
        {value === undefined ? '–' : fmt(value)}
      </dd>
      <dt className="mt-1 text-xs text-slate-400 font-sans tracking-wide uppercase font-medium">{label}</dt>
    </div>
  );
}

