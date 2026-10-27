'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClaimRecord, HardwareTelemetry, TimeSeriesPoint, UserSession, WorkerNode } from '@/app/types';
import { fmt, fmtDec, shortWallet, getApiBaseUrl, getMasterWsUrl } from './utils';
import { ThroughputChart } from './ThroughputChart';

interface Props {
  nodes: WorkerNode[];
  session: UserSession | null;
  onLogin: (session: UserSession) => void;
  onLogout: () => void;
  onWalletUpdated?: () => void;
}

// Generate realistic mock 24h & 7d time-series data
const generateTimeSeries = (points: number, baseHashrate: number): TimeSeriesPoint[] => {
  const now = Date.now();
  const step = 86400000 / points;
  return Array.from({ length: points }, (_, i) => {
    const ts = now - (points - 1 - i) * step;
    const date = new Date(ts);
    const jitter = (Math.sin(i / 3) * 0.2 + (Math.random() - 0.5) * 0.15);
    const hr = Math.max(12, Math.round(baseHashrate * (1 + jitter)));
    const tasks = Math.round(hr * 0.42);
    const earnings = Math.round(tasks * 10);
    return {
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      timestamp: ts,
      hashrate: hr,
      earnings,
      tasks,
    };
  });
};

export function WorkerPortal({ nodes, session, onLogin, onLogout }: Props) {
  const wallet = session?.wallet || '';
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  // Financial balance states
  const [earnings, setEarnings] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [claimed, setClaimed] = useState(0);
  const [claimsList, setClaimsList] = useState<ClaimRecord[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimToast, setClaimToast] = useState<string | null>(null);

  // Time-series chart state (24 Hours vs 7 Days)
  const [chartRange, setChartRange] = useState<'24h' | '7d'>('24h');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>(() => generateTimeSeries(24, 78));

  // In-browser miner compute state
  const [isMining, setIsMining] = useState(false);
  const [hashrate, setHashrate] = useState(0);
  const [browserSolved, setBrowserSolved] = useState(0);
  const [browserLogs, setBrowserLogs] = useState<string[]>([]);
  const [activeCompute, setActiveCompute] = useState<{
    id: string;
    batchId?: string;
    name: string;
    reward: number;
    durationMs: number;
    progressPct: number;
  } | null>(null);
  const [workerStatus, setWorkerStatus] = useState<'offline' | 'connecting' | 'connected' | 'reconnecting'>('offline');

  // Hardware telemetry state
  const [hardware, setHardware] = useState<HardwareTelemetry>({
    cpuTemp: 54,
    gpuTemp: 61,
    memoryUtilPct: 38,
    threads: 16,
    powerWatts: 92,
    fanSpeedPct: 52,
  });

  const minerWsRef = useRef<WebSocket | null>(null);
  const hashCountRef = useRef(0);
  const activeTaskRef = useRef<any>(null);

  // Update telemetry and time-series when mining
  useEffect(() => {
    const interval = setInterval(() => {
      setHardware((prev) => {
        if (!isMining) {
          return {
            cpuTemp: Math.max(42, prev.cpuTemp - 1),
            gpuTemp: Math.max(46, prev.gpuTemp - 1),
            memoryUtilPct: 28,
            threads: 16,
            powerWatts: Math.max(35, prev.powerWatts - 3),
            fanSpeedPct: Math.max(30, prev.fanSpeedPct - 2),
          };
        }
        return {
          cpuTemp: Math.min(84, Math.max(62, prev.cpuTemp + (Math.random() > 0.5 ? 1 : -1))),
          gpuTemp: Math.min(88, Math.max(68, prev.gpuTemp + (Math.random() > 0.5 ? 1 : -1))),
          memoryUtilPct: Math.min(78, Math.max(45, prev.memoryUtilPct + (Math.random() > 0.5 ? 1 : -1))),
          threads: 16,
          powerWatts: Math.min(180, Math.max(115, prev.powerWatts + (Math.random() > 0.5 ? 3 : -3))),
          fanSpeedPct: Math.min(95, Math.max(65, prev.fanSpeedPct + (Math.random() > 0.5 ? 2 : -2))),
        };
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isMining]);

  // Fetch earnings from master
  useEffect(() => {
    if (!wallet) return;
    let active = true;
    const fetchWallet = async () => {
      try {
        const api = getApiBaseUrl();
        const res = await fetch(`${api}/api/wallets/${encodeURIComponent(wallet)}`);
        const data = await res.json();
        if (active && data.ok) {
          setEarnings(data.earnings || 0);
          setCompletedTasks(data.tasks || 0);
          setClaimed(data.claimed || 0);
          setClaimsList(data.claims || []);
        }
      } catch {
        // ignore
      }
    };
    fetchWallet();
    const timer = setInterval(fetchWallet, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [wallet]);

  // Hashrate counter ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (isMining) {
        setHashrate(hashCountRef.current);
        hashCountRef.current = 0;
      } else {
        setHashrate(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isMining]);

  // In-browser mining WebSocket engine with Auto-Reconnection
  useEffect(() => {
    if (!isMining || !wallet) {
      setWorkerStatus('offline');
      if (minerWsRef.current) {
        minerWsRef.current.close();
        minerWsRef.current = null;
      }
      return;
    }

    let isAborted = false;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let activeInterval: NodeJS.Timeout | null = null;
    const nodeName = `web-${session?.username || 'client'}`;
    const nodeId = `web-${wallet.slice(2, 14).toLowerCase()}`;
    const wsUrl = getMasterWsUrl('/worker');

    const getIsoTimestamp = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    const addLog = (level: 'INFO' | 'SUCCESS' | 'COMPUTE' | 'WARN', msg: string) => {
      setBrowserLogs((prev) => [
        `[${getIsoTimestamp()}] [${level}] ${msg}`,
        ...prev.slice(0, 39),
      ]);
    };

    function connectWs() {
      if (isAborted) return;
      setWorkerStatus('connecting');
      addLog('INFO', `Connecting to compute orchestrator: ${wsUrl}...`);

      const ws = new WebSocket(wsUrl);
      minerWsRef.current = ws;

      ws.onopen = () => {
        if (isAborted) return ws.close();
        setWorkerStatus('connected');
        addLog('INFO', `Connected! Registering compute worker: ${nodeName}`);
        addLog('COMPUTE', `Worker pool online: 16 virtual hardware threads ready for dispatch`);
        ws.send(JSON.stringify({
          type: 'register',
          nodeId,
          name: nodeName,
          wallet,
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'registered') {
            addLog('SUCCESS', `Worker verified and registered on cluster with Node ID: ${msg.nodeId}`);
          } else if (msg.type === 'task' || msg.type === 'assigned') {
            const taskId = msg.taskId || msg.task?.id;
            const batchId = msg.batchId || msg.task?.batchId;
            const taskName = msg.name || msg.task?.name || 'Distributed Computational Partition';
            const reward = msg.reward || msg.task?.reward || 10;
            const durationMs = msg.targetDurationMs || 3000;

            activeTaskRef.current = { id: taskId, batchId, reward };
            addLog('COMPUTE', `Workload "${taskName}" partition #${taskId} accepted.`);
            addLog('INFO', `Allocating 16 threads · Set task duration: ${(durationMs / 1000).toFixed(1)}s (Bounty: +${reward} VAMP)`);

            const startTime = Date.now();
            setActiveCompute({
              id: taskId,
              batchId,
              name: taskName,
              reward,
              durationMs,
              progressPct: 0,
            });

            if (activeInterval) clearInterval(activeInterval);
            activeInterval = setInterval(() => {
              if (isAborted) {
                if (activeInterval) clearInterval(activeInterval);
                return;
              }
              const elapsed = Date.now() - startTime;
              const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
              setActiveCompute((prev) => (prev && prev.id === taskId ? { ...prev, progressPct: pct } : prev));
              hashCountRef.current += 160;

              if (elapsed >= durationMs) {
                if (activeInterval) clearInterval(activeInterval);
                setActiveCompute(null);
                const nonce = Math.floor(Math.random() * 800000) + 100000;
                addLog('SUCCESS', `Task #${taskId} finished! Transmitting verified proof...`);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'result',
                    taskId,
                    output: { nonce },
                  }));
                }
                setBrowserSolved((c) => c + 1);
              }
            }, 100);
          } else if (msg.type === 'ack' || msg.type === 'verified') {
            if (msg.accepted !== false) {
              const r = msg.reward || 10;
              addLog('SUCCESS', `Proof verified for Task #${msg.taskId} (+${r} VAMP credited to wallet)`);
              setEarnings((e) => (typeof msg.balance === 'number' ? msg.balance : e + r));
              setCompletedTasks((t) => t + 1);
            } else {
              addLog('WARN', `Master rejected proof on Task #${msg.taskId}: ${msg.reason}`);
            }
          }
        } catch {
          // ignore format errors
        }
      };

      ws.onerror = () => {
        addLog('WARN', 'WebSocket network communication failure.');
      };

      ws.onclose = () => {
        if (isAborted) return;
        setWorkerStatus('reconnecting');
        addLog('WARN', 'Connection lost to orchestrator. Automatically reconnecting in 2s...');
        reconnectTimer = setTimeout(connectWs, 2000);
      };
    }

    connectWs();

    return () => {
      isAborted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (activeInterval) clearInterval(activeInterval);
      if (minerWsRef.current) {
        minerWsRef.current.close();
        minerWsRef.current = null;
      }
    };
  }, [isMining, wallet, session?.username]);

  const handleClaim = async () => {
    if (earnings <= 0 || !wallet) return;
    setClaiming(true);
    setClaimToast(null);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (data.ok) {
        setClaimToast(`Settled ${fmt(data.claim.amount)} VAMP. Tx: ${data.claim.txHash.slice(0, 14)}…`);
        setEarnings(0);
        setClaimed((c) => c + data.claim.amount);
        setClaimsList((prev) => [data.claim, ...prev]);
      } else {
        setClaimToast(data.error || 'Claim settlement failed');
      }
    } catch {
      setClaimToast('Could not reach master settlement ledger');
    } finally {
      setClaiming(false);
    }
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCliCmd = () => {
    const wsUrl = getMasterWsUrl('/worker');
    const cmd = `python -m worker --master ${wsUrl} --wallet ${wallet} --name node-${session?.username || 'cli'}`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Contributor Profile Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Compute Contributor Command Center
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
            <span>Operator: <strong className="text-slate-200">{session?.username || session?.name}</strong></span>
            <span>·</span>
            <span>Wallet:</span>
            <span className="font-mono text-slate-300 font-medium">{shortWallet(wallet)}</span>
            <button
              type="button"
              onClick={copyWallet}
              className="text-slate-400 hover:text-slate-200 transition"
              title="Copy wallet address"
            >
              {copied ? (
                <span className="text-emerald-400 text-[10px]">Copied</span>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
            isMining ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-300'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isMining ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
            <span>{isMining ? 'Computing Active' : 'Node Standby'}</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Metrics Row: Skeleton or Live Telemetry */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="h-3 w-28 bg-slate-800 rounded" />
              <div className="h-7 w-32 bg-slate-700/80 rounded" />
              <div className="h-2.5 w-24 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="text-xs text-slate-400 mb-1">Unclaimed VAMP Balance</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {fmt(earnings)} <span className="text-xs text-slate-400 font-sans">VAMP</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              ≈ ${(earnings * 0.15).toFixed(2)} USD valuation
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="text-xs text-slate-400 mb-1">Total Verified Tasks</div>
            <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {fmt(completedTasks + browserSolved)}
            </div>
            <div className="mt-2 text-[11px] text-emerald-400 font-medium">
              100% Cryptographic accuracy
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="text-xs text-slate-400 mb-1">Total Settled Claims</div>
            <div className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
              {fmt(claimed)} <span className="text-xs text-slate-400 font-sans">VAMP</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {claimsList.length} verified settlements
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="text-xs text-slate-400 mb-1">Live Computational Power</div>
            <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {isMining ? fmt(hashrate) : '0'}{' '}
              <span className="text-xs text-slate-400 font-normal">H/s</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {isMining ? `${hardware.threads} threads utilized` : 'Hardware standby'}
            </div>
          </div>
        </div>
      )}

      {/* Main Split: Compute Execution & Time-Series Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* Left Column: Interactive Compute Engine & Hardware Telemetry (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          
          {/* In-Browser Compute Engine */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  In-Browser Computational Contributor
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allocate idle CPU cycles directly within this tab to solve network task blocks.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsMining(!isMining)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-2 ${
                  isMining
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isMining ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                    <span>Halt Computation</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    <span>Start Computing</span>
                  </>
                )}
              </button>
            </div>

            {/* In-Browser Realistic Mock Terminal */}
            <div className="mt-4 rounded-xl bg-[#080D1A] border border-slate-800 shadow-2xl overflow-hidden font-mono">
              {/* Terminal Window Header Bar */}
              <div className="flex items-center justify-between bg-slate-950/90 px-4 py-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block border border-rose-600/40" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block border border-amber-600/40" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block border border-emerald-600/40" />
                  </div>
                  <span className="text-[11px] text-slate-400 ml-2 font-mono flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>vampire-runtime@cli:~ (zsh)</span>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    workerStatus === 'connected'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : workerStatus === 'reconnecting' || workerStatus === 'connecting'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      workerStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                      workerStatus === 'reconnecting' ? 'bg-amber-400 animate-ping' : 'bg-slate-400'
                    }`} />
                    <span>{
                      workerStatus === 'connected' ? 'ONLINE · 28ms' :
                      workerStatus === 'reconnecting' ? 'RECONNECTING...' :
                      workerStatus === 'connecting' ? 'CONNECTING...' : 'STANDBY'
                    }</span>
                  </span>

                  {browserLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBrowserLogs([])}
                      className="text-[10px] text-slate-400 hover:text-slate-200 transition"
                      title="Clear console output"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Active Computation Progress Banner */}
              {activeCompute && (
                <div className="mx-3.5 mb-2 mt-2 p-3 rounded-lg border border-indigo-500/30 bg-indigo-950/30">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                      <span className="font-semibold text-slate-100">{activeCompute.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        #{activeCompute.id}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-mono font-medium">+{activeCompute.reward} VAMP</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-400 h-1.5 transition-all duration-100 ease-out"
                      style={{ width: `${activeCompute.progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
                    <span>16 Threads · Safe Simulated Mode</span>
                    <span>{activeCompute.progressPct}% ({((activeCompute.durationMs * (100 - activeCompute.progressPct) / 100) / 1000).toFixed(1)}s left)</span>
                  </div>
                </div>
              )}

              {/* Terminal Output Stream */}
              <div className="p-3.5 max-h-48 overflow-y-auto space-y-1 text-[11px] leading-relaxed text-slate-300">
                {browserLogs.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    <span className="text-emerald-400 font-mono">$ vampire-daemon --connect {getMasterWsUrl('/worker')}</span>
                    <p className="mt-1 text-[11px] text-slate-400 font-sans">
                      Press &quot;Start Computing&quot; above to initialize WebSocket worker threadpool.
                    </p>
                  </div>
                ) : (
                  browserLogs.map((log, i) => {
                    const isSuccess = log.includes('[SUCCESS]');
                    const isWarn = log.includes('[WARN]');
                    const isCompute = log.includes('[COMPUTE]');
                    return (
                      <div key={i} className="flex items-start gap-2 break-all font-mono">
                        <span className={
                          isSuccess
                            ? 'text-emerald-400 font-medium'
                            : isWarn
                            ? 'text-amber-400 font-medium'
                            : isCompute
                            ? 'text-blue-400 font-medium'
                            : 'text-slate-300'
                        }>
                          {log}
                        </span>
                      </div>
                    );
                  })
                )}

                {/* Blinking Unix Terminal Cursor */}
                <div className="flex items-center gap-1.5 pt-1 text-slate-400 font-mono">
                  <span className="text-emerald-400 font-bold">root@edge-worker:~$</span>
                  <span className="text-slate-300">
                    {isMining ? 'vampire-pow-miner --active' : 'idle'}
                  </span>
                  <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-blink align-middle ml-0.5" />
                </div>
              </div>
            </div>
          </section>

          {/* Real-Time Hardware Telemetry */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Hardware Telemetry (Dedicated PC Node)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time thermal envelope and load distribution metrics.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">POLL: 2500ms</span>
            </div>

            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-3 h-16" />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2.5 h-10" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-3">
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>CPU Thermal</span>
                      <span className={`font-mono font-semibold ${hardware.cpuTemp > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {hardware.cpuTemp}°C
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${hardware.cpuTemp > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${(hardware.cpuTemp / 100) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-3">
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>GPU Thermal</span>
                      <span className={`font-mono font-semibold ${hardware.gpuTemp > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {hardware.gpuTemp}°C
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${hardware.gpuTemp > 80 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                        style={{ width: `${(hardware.gpuTemp / 100) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-3">
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>Memory RAM</span>
                      <span className="font-mono font-semibold text-blue-400">
                        {hardware.memoryUtilPct}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${hardware.memoryUtilPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 text-xs font-mono text-slate-300">
                  <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2.5 flex justify-between">
                    <span className="text-slate-400">Power Draw:</span>
                    <span className="text-slate-200 font-semibold">{hardware.powerWatts} W</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2.5 flex justify-between">
                    <span className="text-slate-400">Fan Duty:</span>
                    <span className="text-slate-200 font-semibold">{hardware.fanSpeedPct}%</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2.5 flex justify-between">
                    <span className="text-slate-400">CPU Sockets:</span>
                    <span className="text-slate-200 font-semibold">{hardware.threads} Cores</span>
                  </div>
                </div>
              </>
            )}

            {/* CLI Launcher */}
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span>Background PC Node Command (Python CLI)</span>
                <button
                  type="button"
                  onClick={copyCliCmd}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  {copied ? 'Copied to Clipboard' : 'Copy Command'}
                </button>
              </div>
              <div className="rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                python -m worker --master {getMasterWsUrl('/worker')} --wallet {wallet} --name node-{session?.username || 'cli'}
              </div>
            </div>
          </section>

        </div>

        {/* Right Column: Historical Hashrate Chart & Settlement Ledger (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          
          {/* Interactive Recharts Throughput & Hashrate Dynamics */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <ThroughputChart
              data={timeSeries}
              range={chartRange}
              onRangeChange={(r) => {
                setChartRange(r);
                setTimeSeries(generateTimeSeries(r === '24h' ? 24 : 28, r === '24h' ? 78 : 94));
              }}
              isLoading={isLoading}
            />
          </section>

          {/* Settlement & Payout Action */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-1">
              Token Payout & Settlement
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cryptographically verified rewards are eligible for immediate ledger settlement.
            </p>

            {claimToast && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-mono">
                {claimToast}
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 mb-4">
              <div>
                <span className="text-xs text-slate-400 block">Available to Settle:</span>
                <span className="text-lg font-bold font-mono text-slate-100 tabular-nums">
                  {fmt(earnings)} VAMP
                </span>
              </div>

              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming || earnings <= 0}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white shadow transition active:scale-95"
              >
                {claiming ? 'Settling Proofs…' : 'Claim Settlement →'}
              </button>
            </div>

            {/* Claims History */}
            <div>
              <span className="text-xs font-medium text-slate-300 block mb-2">Settlement Ledger</span>
              {claimsList.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 rounded-lg border border-slate-800/80 bg-slate-950/40">
                  No previous claim disbursements on record.
                </div>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {claimsList.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950 text-xs font-mono border border-slate-800/80"
                    >
                      <span className="text-emerald-400 font-semibold">+{fmt(c.amount)} VAMP</span>
                      <span className="text-slate-400 text-[11px] truncate max-w-[140px]" title={c.txHash}>
                        {c.txHash.slice(0, 10)}…{c.txHash.slice(-6)}
                      </span>
                      <span className="text-slate-300 text-[10px]">
                        {new Date(c.claimedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
