import type { NodeStatus } from '@/app/types';

export const shortWallet = (w?: string | null): string => {
  if (!w || typeof w !== 'string') return '–';
  return w.length > 14 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
};

export const fmt = (n?: number | null): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
};

export const fmtDec = (n?: number | null, decimals = 2): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const clock = (ts?: number | null): string => {
  if (!ts || typeof ts !== 'number' || !Number.isFinite(ts)) return '--:--:--';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return '--:--:--';
  }
};

export const STATUS_STYLE: Record<NodeStatus, { label: string; dot: string; text: string; badge: string }> = {
  computing: {
    label: 'Computing',
    dot: 'bg-emerald-400 animate-pulse',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  idle: {
    label: 'Online / Idle',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-slate-600',
    text: 'text-slate-400',
    badge: 'bg-slate-800 text-slate-400 border border-slate-700',
  },
};

export const LEVEL_STYLE: Record<'info' | 'warn' | 'error', string> = {
  info: 'text-slate-300',
  warn: 'text-amber-400',
  error: 'text-rose-400',
};

export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_MASTER_API_URL) {
    return process.env.NEXT_PUBLIC_MASTER_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const wsUrl = process.env.NEXT_PUBLIC_MASTER_WS_URL;
    if (wsUrl && !wsUrl.includes('localhost') && !wsUrl.includes('127.0.0.1')) {
      try {
        const u = new URL(wsUrl);
        const protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
        return `${protocol}//${u.host}`;
      } catch {
        // fallback
      }
    }
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return 'http://localhost:8080';
};

export const getMasterWsUrl = (path = '/worker'): string => {
  if (process.env.NEXT_PUBLIC_MASTER_WS_URL) {
    const base = process.env.NEXT_PUBLIC_MASTER_WS_URL.replace(/\/observer$/, '').replace(/\/$/, '');
    return `${base}${path}`;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.hostname}:8080${path}`;
  }
  return `ws://localhost:8080${path}`;
};
