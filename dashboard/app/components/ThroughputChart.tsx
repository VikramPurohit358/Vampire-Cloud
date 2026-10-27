'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { TimeSeriesPoint } from '@/app/types';

interface Props {
  data: TimeSeriesPoint[];
  range: '24h' | '7d';
  onRangeChange: (r: '24h' | '7d') => void;
  isLoading?: boolean;
}

// Custom high-contrast tooltip for Recharts
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const p: TimeSeriesPoint = payload[0].payload;
    const formattedDate = new Date(p.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return (
      <div className="rounded-xl border border-slate-700/90 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 text-xs font-mono space-y-1.5 min-w-[210px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-sans font-semibold text-slate-200">
            {formattedDate} · {p.time}
          </span>
          <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[10px] text-blue-300 font-sans">
            Verified Block
          </span>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-slate-400 font-sans">Grid Throughput:</span>
          <span className="font-bold text-blue-400 tabular-nums">{p.hashrate} H/s</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-sans">Tasks Solved:</span>
          <span className="font-bold text-emerald-400 tabular-nums">+{p.tasks} blocks</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-sans">Accrued Settlement:</span>
          <span className="font-bold text-slate-100 tabular-nums">+{p.earnings} VAMP</span>
        </div>

        <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-sans">
          <span>Worker Node SLA:</span>
          <span className="text-emerald-400 font-mono font-semibold">99.98% OK</span>
        </div>
      </div>
    );
  }
  return null;
}

export function ThroughputChart({ data, range, onRangeChange, isLoading }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="h-56 w-full rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-4 w-32 bg-slate-800 rounded" />
          <div className="h-6 w-20 bg-slate-800 rounded-lg" />
        </div>
        <div className="h-32 w-full bg-slate-900/80 rounded-lg flex items-center justify-center text-xs text-slate-400 font-mono">
          Loading telemetry stream & data points…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chart Header & Range Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Throughput & Hashrate Dynamics
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive real-time computational performance curve.
          </p>
        </div>

        <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
          <button
            type="button"
            onClick={() => onRangeChange('24h')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              range === '24h'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            24H
          </button>
          <button
            type="button"
            onClick={() => onRangeChange('7d')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              range === '7d'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            7D
          </button>
        </div>
      </div>

      {/* Chart Canvas with Recharts */}
      <div className="card-glow rounded-2xl border border-slate-800/80 bg-slate-950/85 p-4 pt-5 shadow-2xl backdrop-blur-xl">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="throughputAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#1E1B4B" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="throughputStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="50%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#334155"
                strokeDasharray="3 3"
                strokeOpacity={0.3}
                vertical={false}
              />

              <XAxis
                dataKey="time"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                interval={range === '24h' ? 3 : 4}
              />

              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v} H/s`}
                domain={['auto', 'auto']}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: '#60A5FA',
                  strokeWidth: 1.5,
                  strokeDasharray: '4 4',
                }}
              />

              <Area
                type="monotone"
                dataKey="hashrate"
                stroke="url(#throughputStrokeGradient)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#throughputAreaGradient)"
                activeDot={{
                  r: 5,
                  fill: '#38BDF8',
                  stroke: '#0B0F19',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 px-1">
          <span>Active Nodes Online: <strong className="text-slate-200 font-mono">1 Dedicated</strong></span>
          <span className="text-slate-400">Hover scrub along timeline to inspect metrics</span>
        </div>
      </div>
    </div>
  );
}
