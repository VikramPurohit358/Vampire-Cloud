'use client';

import { useEffect, useState } from 'react';
import type { Batch, CompanySession } from '@/app/types';
import { fmt, fmtDec, getApiBaseUrl } from './utils';
import { ProofsModal } from './ProofsModal';

interface Props {
  batches: Batch[];
  session: CompanySession | null;
  onLogin: (session: CompanySession) => void;
  onLogout: () => void;
  onBatchCreated?: () => void;
}

interface SpotPricing {
  spotRate: number;
  unit: string;
  networkCapacityTflops: number;
  networkDifficulty: number;
  activeNodes: number;
  queueDepth: number;
}

export function CompanyPortal({ batches, session, onLogin, onLogout, onBatchCreated }: Props) {
  // Workload payload configuration state
  const [name, setName] = useState('Distributed Genomic Sequence Alignment');
  const [category, setCategory] = useState('Bioinformatics & Genomics');
  const [dockerImage, setDockerImage] = useState('docker.io/apexquantum/genomic-aligner:latest');
  const [datasetUri, setDatasetUri] = useState('s3://datasets/genomics-seq-2026.parquet');
  const [commandArgs, setCommandArgs] = useState('--threads 8 --batch-size 256 --fp16');
  const [cpuCores, setCpuCores] = useState(8);
  const [memoryGb, setMemoryGb] = useState(16);
  const [gpuRequired, setGpuRequired] = useState(true);

  // Task volume & pricing
  const [totalTasks, setTotalTasks] = useState(50);
  const [completionTimeSeconds, setCompletionTimeSeconds] = useState(3);
  const [priorityTier, setPriorityTier] = useState<'standard' | 'spot' | 'priority'>('spot');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [activePreset, setActivePreset] = useState<'genomics' | 'llm' | 'montecarlo' | 'zkp' | null>('genomics');

  // Dynamic spot market state
  const [spotData, setSpotData] = useState<SpotPricing>({
    spotRate: 14.8,
    unit: 'VAMP/TFLOPS-hr',
    networkCapacityTflops: 48.6,
    networkDifficulty: 5,
    activeNodes: 1,
    queueDepth: 0,
  });

  // Fetch real-time spot pricing
  useEffect(() => {
    let active = true;
    const fetchSpot = async () => {
      try {
        const api = getApiBaseUrl();
        const res = await fetch(`${api}/api/pricing/spot`);
        const data = await res.json();
        if (active && data.ok) {
          setSpotData(data);
        }
      } catch {
        // ignore
      }
    };
    fetchSpot();
    const interval = setInterval(fetchSpot, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Calculate dynamic bounty per task based on spot pricing and tier multiplier
  const tierMultiplier = priorityTier === 'priority' ? 1.3 : priorityTier === 'spot' ? 1.0 : 0.85;
  const unitReward = Math.round(spotData.spotRate * tierMultiplier);
  const estimatedCost = totalTasks * unitReward;

  const handleSubmitWorkload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: session.name,
          name: name.trim(),
          category,
          dockerImage: dockerImage.trim(),
          datasetUri: datasetUri.trim(),
          commandArgs: commandArgs.trim(),
          environment: {
            cores: Number(cpuCores),
            memoryGb: Number(memoryGb),
            gpu: Boolean(gpuRequired),
            arch: 'x86_64 / AVX-512',
          },
          totalTasks: Number(totalTasks),
          completionTimeSeconds: Number(completionTimeSeconds) || 3,
          difficulty: spotData.networkDifficulty,
          rewardPerTask: unitReward,
          spotPrice: spotData.spotRate,
          workload: 'sha256_pow',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({
          type: 'success',
          msg: `Workload "${data.batch.name}" broadcasted to global worker nodes. Batch ID: ${data.batch.id}`,
        });
        if (onBatchCreated) onBatchCreated();
      } else {
        setFeedback({ type: 'error', msg: data.error || 'Failed to broadcast batch workload' });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Could not contact master orchestrator service' });
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (preset: 'genomics' | 'llm' | 'montecarlo' | 'zkp') => {
    setActivePreset(preset);
    if (preset === 'genomics') {
      setName('Genomic Sequencing & Variant Alignment');
      setCategory('Bioinformatics & Genomics');
      setDockerImage('docker.io/apexquantum/genomic-aligner:latest');
      setDatasetUri('s3://datasets/genomics-seq-2026.parquet');
      setCommandArgs('--threads 8 --batch-size 256 --fp16');
      setCpuCores(8);
      setMemoryGb(16);
      setGpuRequired(true);
      setTotalTasks(30);
      setCompletionTimeSeconds(3);
    } else if (preset === 'llm') {
      setName('Llama-3 70B Distributed LoRA Parameter Sharding');
      setCategory('AI / LLM Parameter Sharding');
      setDockerImage('docker.io/apexquantum/lora-sharder:v2.1');
      setDatasetUri('s3://ai-models/llama3-weights-partition.bin');
      setCommandArgs('--lora-rank 64 --quantization int8 --world-size 8');
      setCpuCores(16);
      setMemoryGb(32);
      setGpuRequired(true);
      setTotalTasks(40);
      setCompletionTimeSeconds(4);
    } else if (preset === 'montecarlo') {
      setName('High-Frequency Quantitative Monte Carlo Derivative Pricing');
      setCategory('Monte Carlo Risk Analysis');
      setDockerImage('docker.io/quantapex/monte-carlo:latest');
      setDatasetUri('s3://market-feeds/orderbook-tick-level.zst');
      setCommandArgs('--simulations 1000000 --confidence 0.999');
      setCpuCores(12);
      setMemoryGb(16);
      setGpuRequired(false);
      setTotalTasks(25);
      setCompletionTimeSeconds(3);
    } else {
      setName('Zero-Knowledge STARK Proof Generation & Verification');
      setCategory('Cryptographic Validation');
      setDockerImage('docker.io/zkvampire/stark-prover:latest');
      setDatasetUri('s3://zk-circuits/state-transition-circuit-104.bin');
      setCommandArgs('--prove --num-constraints 2^22 --security-bits 128');
      setCpuCores(16);
      setMemoryGb(32);
      setGpuRequired(true);
      setTotalTasks(50);
      setCompletionTimeSeconds(3);
    }
  };

  const companyBatches = batches.filter(
    (b) => b.company?.toLowerCase() === session?.name?.toLowerCase()
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Proof inspection modal */}
      {selectedBatch && (
        <ProofsModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}

      {/* Enterprise Portal Header */}
      <div className="card-glow rounded-3xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/20 via-indigo-600/20 to-purple-600/20 text-cyan-400 border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.25)] text-sm">
              <svg className="w-5 h-5 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Enterprise Workload</span>
                <span className="text-gradient-cyan">Orchestrator</span>
              </h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Authenticated Client: <strong className="text-slate-200">{session?.name}</strong> · SLA: <span className="text-cyan-400 font-semibold">{session?.serviceTier || 'Enterprise Dedicated (99.9% SLA)'}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-2xl">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Available Escrow Balance</span>
            <span className="font-mono text-lg font-extrabold text-gradient-cyan tabular-nums">
              {fmt(session?.allocatedBudget || 0)} <span className="text-xs text-slate-400 font-normal">VAMP</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-slate-700 bg-slate-800/60 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Spot Market & Network Capacity Ticker / Skeleton Loaders */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
              <div className="h-3 w-24 bg-slate-800 rounded" />
              <div className="h-6 w-32 bg-slate-700/80 rounded" />
              <div className="h-2.5 w-20 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card-glow rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-2xl p-5 hover:border-blue-500/30 transition-all duration-300 shadow-xl shadow-black/40">
            <span className="text-xs text-slate-400 block mb-1 font-medium">Dynamic Spot Price</span>
            <span className="text-2xl font-extrabold font-mono text-gradient-cyan tabular-nums tracking-tight">
              {fmtDec(spotData.spotRate)} <span className="text-xs text-slate-400 font-normal font-sans">VAMP/TF</span>
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Real-time clearing
            </span>
          </div>

          <div className="card-glow rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-2xl p-5 hover:border-indigo-500/30 transition-all duration-300 shadow-xl shadow-black/40">
            <span className="text-xs text-slate-400 block mb-1 font-medium">Active Grid Capacity</span>
            <span className="text-2xl font-extrabold font-mono text-white tabular-nums tracking-tight">
              {fmtDec(spotData.networkCapacityTflops, 1)} <span className="text-xs text-slate-400 font-normal font-sans">TFLOPS</span>
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-mono">{spotData.activeNodes} online worker nodes</span>
          </div>

          <div className="card-glow rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-2xl p-5 hover:border-purple-500/30 transition-all duration-300 shadow-xl shadow-black/40">
            <span className="text-xs text-slate-400 block mb-1 font-medium">Network Difficulty</span>
            <span className="text-2xl font-extrabold font-mono text-gradient-violet tabular-nums tracking-tight">
              Target {spotData.networkDifficulty}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-mono">256-bit SHA prefix</span>
          </div>

          <div className="card-glow rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-2xl p-5 hover:border-emerald-500/30 transition-all duration-300 shadow-xl shadow-black/40">
            <span className="text-xs text-slate-400 block mb-1 font-medium">Queue Backlog</span>
            <span className="text-2xl font-extrabold font-mono text-gradient-emerald tabular-nums tracking-tight">
              {spotData.queueDepth} <span className="text-xs text-slate-400 font-normal font-sans">blocks</span>
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Optimal throughput
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Workload Submission (Payload Config) & Active Batches */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left: Broadcast Workload Form with 2-Column Responsive Layout (7 cols) */}
        <section className="card-glow rounded-3xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-2xl p-6 shadow-xl lg:col-span-7">
          <div className="border-b border-slate-800 pb-3.5 mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Configure & Broadcast Workload</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Define the containerized payload, storage datasets, and target execution environment.
              </p>
            </div>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/30 text-cyan-400 px-2.5 py-0.5 text-[10px] font-mono uppercase font-semibold">
              OCI Spec
            </span>
          </div>

          {feedback && (
            <div
              className={`rounded-2xl p-3.5 text-xs mb-5 flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Quick Workload Presets */}
          <div className="mb-5 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                Workload Quick-Templates
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">1-click preset config</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('genomics')}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left group ${
                  activePreset === 'genomics'
                    ? 'border-cyan-500/70 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🧬</span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate group-hover:text-cyan-300">Genomics</span>
                  <span className="text-[10px] text-slate-400 font-mono block">30 partitions</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('llm')}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left group ${
                  activePreset === 'llm'
                    ? 'border-purple-500/70 bg-purple-500/15 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🤖</span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate group-hover:text-purple-300">LLM LoRA</span>
                  <span className="text-[10px] text-slate-400 font-mono block">40 partitions</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('montecarlo')}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left group ${
                  activePreset === 'montecarlo'
                    ? 'border-amber-500/70 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">⚡</span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate group-hover:text-amber-300">Monte Carlo</span>
                  <span className="text-[10px] text-slate-400 font-mono block">25 partitions</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('zkp')}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left group ${
                  activePreset === 'zkp'
                    ? 'border-emerald-500/70 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🔒</span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate group-hover:text-emerald-300">ZK STARK</span>
                  <span className="text-[10px] text-slate-400 font-mono block">50 partitions</span>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitWorkload} className="space-y-4">
            
            {/* 2-Column Responsive CSS Grid: Payload & Storage (Left) | Hardware & Tier (Right) */}
            <div className="grid md:grid-cols-2 gap-4 items-start">
              
              {/* LEFT COLUMN: Payload & Storage */}
              <div className="space-y-3 rounded-lg border border-slate-800/80 bg-slate-950/70 p-3.5">
                <div className="border-b border-slate-800/80 pb-1.5 flex items-center gap-1.5 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span>Payload & Storage</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Workload Name / Job ID
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Distributed Protein Folding Simulation"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Computational Domain
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Bioinformatics & Genomics">Bioinformatics & Genomics</option>
                    <option value="AI / LLM Parameter Sharding">AI / LLM Parameter Sharding</option>
                    <option value="Cryptographic Validation">Cryptographic Validation</option>
                    <option value="Monte Carlo Risk Analysis">Monte Carlo Risk Analysis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Container Image URI (OCI / Docker)
                  </label>
                  <input
                    type="text"
                    required
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                    placeholder="docker.io/apexquantum/biomodel:latest"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Dataset / Storage URI (S3 / GCS)
                  </label>
                  <input
                    type="text"
                    required
                    value={datasetUri}
                    onChange={(e) => setDatasetUri(e.target.value)}
                    placeholder="s3://biomodel-data/shards/*.parquet"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Runtime Execution Arguments
                  </label>
                  <input
                    type="text"
                    value={commandArgs}
                    onChange={(e) => setCommandArgs(e.target.value)}
                    placeholder="--threads 8 --batch-size 256 --fp16"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Hardware Requirements & Market Tier */}
              <div className="space-y-3 rounded-lg border border-slate-800/80 bg-slate-950/70 p-3.5">
                <div className="border-b border-slate-800/80 pb-1.5 flex items-center gap-1.5 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <span>Hardware & Market Tier</span>
                </div>

                {/* Cores & RAM Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      CPU Cores
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={64}
                      value={cpuCores}
                      onChange={(e) => setCpuCores(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      RAM Size
                    </label>
                    <select
                      value={memoryGb}
                      onChange={(e) => setMemoryGb(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                    >
                      <option value={8}>8 GB RAM</option>
                      <option value={16}>16 GB RAM</option>
                      <option value={32}>32 GB RAM</option>
                      <option value={64}>64 GB RAM</option>
                    </select>
                  </div>
                </div>

                {/* Accelerator Toggle */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Accelerator Requirement
                  </label>
                  <button
                    type="button"
                    onClick={() => setGpuRequired(!gpuRequired)}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition flex items-center justify-center gap-2 ${
                      gpuRequired
                        ? 'border-blue-500/50 bg-blue-500/15 text-blue-300'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${gpuRequired ? 'bg-blue-400' : 'bg-slate-500'}`} />
                    <span>{gpuRequired ? 'NVIDIA GPU Accelerated' : 'Standard x86-64 CPU'}</span>
                  </button>
                </div>

                {/* Market Tier Selection */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-300">Spot Market Tier</span>
                    <span className="font-mono text-blue-400 tabular-nums">{unitReward} VAMP / Task</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPriorityTier('spot')}
                      className={`rounded-lg border p-2 text-left transition ${
                        priorityTier === 'spot'
                          ? 'border-blue-500/50 bg-blue-500/15 ring-1 ring-blue-500/30'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-slate-100">Spot</span>
                      <span className="block text-[10px] text-slate-400 font-mono">1.0x Base</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPriorityTier('priority')}
                      className={`rounded-lg border p-2 text-left transition ${
                        priorityTier === 'priority'
                          ? 'border-blue-500/50 bg-blue-500/15 ring-1 ring-blue-500/30'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-blue-300">Priority</span>
                      <span className="block text-[10px] text-slate-400 font-mono">1.3x High</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPriorityTier('standard')}
                      className={`rounded-lg border p-2 text-left transition ${
                        priorityTier === 'standard'
                          ? 'border-blue-500/50 bg-blue-500/15 ring-1 ring-blue-500/30'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-slate-300">Economy</span>
                      <span className="block text-[10px] text-slate-400 font-mono">0.85x Flex</span>
                    </button>
                  </div>
                </div>

                {/* Batch Block Count & Duration & Escrow */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-slate-400 text-xs">Block Count:</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={totalTasks}
                        onChange={(e) => setTotalTasks(Math.max(1, Number(e.target.value)))}
                        className="w-16 rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-slate-400 text-xs">Task Time:</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={completionTimeSeconds}
                        onChange={(e) => setCompletionTimeSeconds(Math.max(1, Number(e.target.value)))}
                        className="w-14 rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-slate-400 text-[11px]">sec</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                    <span className="text-slate-400 text-[11px]">Estimated Escrow:</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      {fmt(estimatedCost)} VAMP
                    </span>
                  </div>
                </div>

              </div>

            </div>

            {/* Full-width Submit Broadcast Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 py-3.5 text-xs font-bold text-white shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 border border-blue-400/30"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Broadcasting Workload to Global Worker Grid…</span>
                </>
              ) : (
                <span>Broadcast Workload ({totalTasks} Partitions · {fmt(estimatedCost)} VAMP) 🚀</span>
              )}
            </button>
          </form>
        </section>

        {/* Right: Active Batches & Advanced Telemetry Tracking (5 cols) */}
        <section className="card-glow rounded-3xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-2xl p-6 shadow-xl lg:col-span-5 flex flex-col">
          <div className="border-b border-slate-800 pb-3.5 mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Active Workloads</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time progress, geographical distribution, and proof verification.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-semibold">{companyBatches.length} Jobs</span>
          </div>

          {companyBatches.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded-lg">
              <svg className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-xs text-slate-400">No active compute workloads broadcasted yet.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {companyBatches.map((b) => {
                const pct = b.totalTasks > 0 ? Math.round((b.completedTasks / b.totalTasks) * 100) : 0;
                return (
                  <div
                    key={b.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-100 truncate max-w-[200px]" title={b.name}>
                            {b.name}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                            {b.id}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {b.category || 'Genomics & Molecular Alignment'}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          b.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'completed' ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'}`} />
                        {b.status === 'completed' ? 'Completed' : 'Computing'}
                      </span>
                    </div>

                    {/* Progress Bar with Shimmer Animation */}
                    <div>
                      <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
                        <span>Verified: <strong className="text-slate-200">{b.completedTasks}</strong>/{b.totalTasks} partitions</span>
                        <span className="font-semibold text-slate-200 tabular-nums">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            b.status === 'completed'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                              : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 animate-shimmer shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                          }`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Advanced Telemetry Panel */}
                    <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-[11px] space-y-1.5 font-mono text-slate-400">
                      <div className="flex justify-between">
                        <span>Node Latency:</span>
                        <span className="text-slate-200">{b.telemetry?.avgLatencyMs || 28} ms avg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Verification Error Rate:</span>
                        <span className="text-emerald-400">{b.telemetry?.errorRatePct || 0.04}% (SLA Grade)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Geo Distribution:</span>
                        <span className="text-slate-200">NA: 42% · EU: 38% · AP: 20%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Completion:</span>
                        <span className="text-blue-400">
                          {b.status === 'completed' ? 'Verified & Closed' : `~${b.telemetry?.etaSeconds || 45}s remaining`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-xs text-slate-400 font-mono">
                        Escrow: <strong className="text-slate-200">{fmt(b.totalBounty)} VAMP</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedBatch(b)}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition"
                      >
                        Inspect Proofs →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

    </div>
  );
}
