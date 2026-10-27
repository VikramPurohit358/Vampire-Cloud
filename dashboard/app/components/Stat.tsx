import { fmt } from './utils';

interface Props {
  label: string;
  value?: number;
  warn?: boolean;
}

export function Stat({ label, value, warn = false }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 transition-colors">
      <dd
        className={`text-2xl font-semibold tabular-nums font-mono ${
          warn ? 'text-amber-400' : 'text-slate-100'
        }`}
      >
        {value === undefined ? '–' : fmt(value)}
      </dd>
      <dt className="mt-1 text-xs text-slate-400">{label}</dt>
    </div>
  );
}
