import { fmt } from './utils';

interface Props {
  label: string;
  value?: number;
  warn?: boolean;
}

export function Stat({ label, value, warn = false }: Props) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-900/80 shadow-sm">
      <dd
        className={`text-2xl font-bold tabular-nums font-mono tracking-tight ${
          warn ? 'text-amber-400' : 'text-slate-100'
        }`}
      >
        {value === undefined ? '–' : fmt(value)}
      </dd>
      <dt className="mt-1 text-xs text-slate-400 font-sans">{label}</dt>
    </div>
  );
}
