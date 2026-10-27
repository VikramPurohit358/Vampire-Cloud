'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');
const { logEvent } = require('./logger');
const { isOpen } = require('./utils');
const { saveBatchAndTasks, updateTaskCompletion, creditWalletDb, recordClaimDb } = require('./db');

const tasks    = new Map();
const wallets  = new Map();
const nodes    = new Map();
const batches  = new Map();
const timers   = new Map();
const claims   = new Map();
const counters = { batch: 1, requeued: 0, timeouts: 0, disconnects: 0, rejected: 0, minted: 0 };

let queue           = [];
let dirty           = false;
let refillScheduled = false;

const getTasks    = () => tasks;
const getWallets  = () => wallets;
const getNodes    = () => nodes;
const getBatches  = () => batches;
const getClaims   = () => claims;
const getCounters = () => counters;
const getQueue    = () => queue;
const setQueue    = (q) => { queue = Array.isArray(q) ? q : []; };
const isDirty     = () => dirty;
const setDirty    = (v) => { dirty = Boolean(v); };
const isRefillScheduled  = () => refillScheduled;
const setRefillScheduled = (v) => { refillScheduled = Boolean(v); };

function createBatch() {
  const batchId = `system-b${counters.batch}`;
  const total = Math.max(1, Math.min(100_000, CONFIG.totalTasks));

  batches.set(batchId, {
    id: batchId,
    name: `Vampire Grid Batch #${counters.batch}`,
    company: 'Vampire Cloud Foundation',
    totalTasks: total,
    completedTasks: 0,
    difficulty: CONFIG.difficulty,
    rewardPerTask: CONFIG.rewardPerTask,
    totalBounty: total * CONFIG.rewardPerTask,
    workload: 'sha256_pow',
    status: 'active',
    createdAt: Date.now(),
    completedAt: null,
  });

  for (let i = 1; i <= total; i++) {
    const id = `b${counters.batch}-t${String(i).padStart(3, '0')}`;
    tasks.set(id, {
      id,
      batchId,
      workload: 'sha256_pow',
      data: `vampire:${id}:${crypto.randomBytes(12).toString('hex')}`,
      difficulty: CONFIG.difficulty,
      reward: CONFIG.rewardPerTask,
      status: 'pending',
      attempts: 0,
      assignedTo: null,
      assignedAt: null,
      deadline: null,
      excluded: new Set(),
      completedBy: null,
      completedAt: null,
      nonce: null,
      hash: null,
    });
    queue.push(id);
  }
  dirty = true;
}

function createCompanyBatch({
  company,
  name,
  category,
  dockerImage,
  datasetUri,
  commandArgs,
  environment,
  totalTasks,
  difficulty,
  rewardPerTask,
  spotPrice,
  workload,
  completionTimeSeconds,
}) {
  const batchNum = counters.batch++;
  const batchId = `corp-b${batchNum}-${crypto.randomBytes(4).toString('hex')}`;
  const count = Math.max(1, Math.min(5000, Number(totalTasks) || 20));
  const diff = Math.max(1, Math.min(8, Number(difficulty) || CONFIG.difficulty));
  const reward = Math.max(1, Math.min(1000, Number(rewardPerTask) || CONFIG.rewardPerTask));
  const wl = workload || 'sha256_pow';
  const durationSec = Math.max(2, Math.min(20, Number(completionTimeSeconds) || 4));
  const targetDurationMs = durationSec * 1000;

  const batchObj = {
    id: batchId,
    company: String(company || 'Anonymous Enterprise').trim().slice(0, 48),
    name: String(name || 'Custom Workload').trim().slice(0, 64),
    category: category || 'Genomic Hash Sequencing',
    dockerImage: dockerImage || 'docker.io/apexquantum/genomic-aligner:latest',
    datasetUri: datasetUri || 's3://compute-data-us-east/genomic-batch-102.parquet',
    commandArgs: commandArgs || '--threads 8 --batch-size 256 --fp16',
    environment: environment || { cores: 8, memoryGb: 16, gpu: true, arch: 'x86_64 / AVX-512' },
    totalTasks: count,
    completedTasks: 0,
    difficulty: diff,
    rewardPerTask: reward,
    completionTimeSeconds: durationSec,
    totalBounty: count * reward,
    spotPrice: Number(spotPrice) || 14.8,
    workload: wl,
    status: 'active',
    createdAt: Date.now(),
    completedAt: null,
    telemetry: {
      geoDistribution: {
        'North America': 42,
        'Europe / Frankfurt': 34,
        'Asia-Pacific': 18,
        'Other': 6,
      },
      avgLatencyMs: 24 + Math.floor(Math.random() * 8),
      errorRatePct: 0.04,
      throughputMhs: 84.5 + Math.floor(Math.random() * 15),
      etaSeconds: Math.round((count * durationSec)),
    },
  };
  batches.set(batchId, batchObj);

  const newTasksList = [];
  for (let i = 1; i <= count; i++) {
    const id = `${batchId}-t${String(i).padStart(3, '0')}`;
    const taskObj = {
      id,
      batchId,
      name: batchObj.name,
      category: batchObj.category,
      workload: wl,
      targetDurationMs,
      data: `${batchObj.company.toLowerCase().replace(/[^a-z0-9]/g, '')}:${id}:${crypto.randomBytes(12).toString('hex')}`,
      difficulty: diff,
      reward,
      status: 'pending',
      attempts: 0,
      assignedTo: null,
      assignedAt: null,
      deadline: null,
      excluded: new Set(),
      completedBy: null,
      completedAt: null,
      nonce: null,
      hash: null,
    };
    tasks.set(id, taskObj);
    queue.push(id);
    newTasksList.push(taskObj);
  }
  dirty = true;
  saveBatchAndTasks(batchObj, newTasksList).catch(() => {});
  logEvent('info', `🏢 ${batchObj.company} assigned batch "${batchObj.name}" (${count} tasks, bounty ${batchObj.totalBounty} VAMP)`);
  return batchObj;
}

function onTaskCompleted(task, node) {
  if (task.batchId) {
    const b = batches.get(task.batchId);
    if (b) {
      // Derive completedTasks from actual task statuses to prevent double-counting
      let done = 0;
      for (const t of tasks.values()) {
        if (t.batchId === task.batchId && t.status === 'completed') done++;
      }
      b.completedTasks = done;
      if (done >= b.totalTasks && b.status !== 'completed') {
        b.status = 'completed';
        b.completedAt = Date.now();
        logEvent('info', `🎉 Batch completed: "${b.name}" for ${b.company} (${b.totalTasks}/${b.totalTasks} tasks verified)`);
      }
    }
  }
  updateTaskCompletion(task.id, task.batchId, node.id, task.nonce, task.hash, task.reward).catch(() => {});
}

function clearTaskTimer(taskId) {
  const t = timers.get(taskId);
  if (t) {
    clearTimeout(t);
    timers.delete(taskId);
  }
}

function requeueTask(task, reason) {
  if (!task || typeof task !== 'object') return;
  clearTaskTimer(task.id);
  if (task.status === 'completed') return;
  task.status = 'pending';
  task.assignedTo = null;
  task.assignedAt = null;
  task.deadline = null;
  if (!queue.includes(task.id)) queue.unshift(task.id);
  counters.requeued++;
  dirty = true;
  logEvent('warn', `Task ${task.id} requeued (${reason}); attempts: ${task.attempts}`);
}

function abandonCurrentTask(node, reason) {
  if (!node || !node.currentTask) return;
  const task = tasks.get(node.currentTask);
  node.currentTask = null;
  if (task && task.status === 'assigned' && task.assignedTo === node.id) {
    requeueTask(task, reason);
  }
}

function releaseIfCurrent(node, taskId) {
  if (!node) return;
  if (node.currentTask === taskId) {
    node.currentTask = null;
    node.status = isOpen(node.ws) ? 'idle' : 'offline';
  }
}

function creditWallet(wallet, amount) {
  if (!wallet || typeof wallet !== 'string') return 0;
  const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const w = wallets.get(wallet) || { earnings: 0, tasks: 0, claimed: 0 };
  w.earnings += validAmount;
  w.tasks++;
  wallets.set(wallet, w);
  counters.minted += validAmount;
  creditWalletDb(wallet, validAmount).catch(() => {});
  return w.earnings;
}

function claimWallet(wallet) {
  if (!wallet || typeof wallet !== 'string') {
    throw new Error('Invalid wallet address');
  }
  const w = wallets.get(wallet);
  if (!w || w.earnings <= 0) {
    throw new Error('No earnings available to claim');
  }
  const claimedAmount = w.earnings;
  w.claimed = (w.claimed || 0) + claimedAmount;
  w.earnings = 0;
  wallets.set(wallet, w);

  const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
  const claimRecord = {
    wallet,
    amount: claimedAmount,
    txHash,
    claimedAt: Date.now(),
  };
  const list = claims.get(wallet) || [];
  list.unshift(claimRecord);
  claims.set(wallet, list.slice(0, 50));
  recordClaimDb(wallet, claimRecord).catch(() => {});

  dirty = true;
  logEvent('info', `💰 Wallet ${wallet} claimed ${claimedAmount} VAMP (tx: ${txHash.slice(0, 10)}…)`);
  return claimRecord;
}

function saveState() {
  if (!dirty) return;
  dirty = false;
  const snapshot = {
    counters,
    wallets: [...wallets.entries()],
    batches: [...batches.entries()],
    claims: [...claims.entries()],
    tasks: [...tasks.values()].map((t) => ({ ...t, excluded: [...(t.excluded || [])] })),
  };
  const tmp = `${CONFIG.statePath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(CONFIG.statePath), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
    try {
      fs.renameSync(tmp, CONFIG.statePath);
    } catch {
      fs.copyFileSync(tmp, CONFIG.statePath);
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  } catch (err) {
    dirty = true;
    console.error('Failed to persist ledger:', err.message);
  }
}

function loadState() {
  try {
    if (!fs.existsSync(CONFIG.statePath)) return false;
    const raw = fs.readFileSync(CONFIG.statePath, 'utf8');
    if (!raw.trim()) return false;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== 'object') return false;

    if (snap.counters && typeof snap.counters === 'object') {
      Object.assign(counters, snap.counters);
    }
    if (Array.isArray(snap.wallets)) {
      for (const [w, v] of snap.wallets) {
        if (typeof w === 'string' && v && typeof v === 'object') {
          wallets.set(w, {
            earnings: Number(v.earnings) || 0,
            tasks: Number(v.tasks) || 0,
            claimed: Number(v.claimed) || 0,
          });
        }
      }
    }
    if (Array.isArray(snap.batches)) {
      for (const [bId, bObj] of snap.batches) {
        if (typeof bId === 'string' && bObj && typeof bObj === 'object') {
          batches.set(bId, bObj);
        }
      }
    }
    if (Array.isArray(snap.claims)) {
      for (const [w, list] of snap.claims) {
        if (typeof w === 'string' && Array.isArray(list)) {
          claims.set(w, list);
        }
      }
    }
    if (Array.isArray(snap.tasks)) {
      for (const t of snap.tasks) {
        if (!t || typeof t !== 'object' || !t.id) continue;
        tasks.set(t.id, {
          ...t,
          status: t.status === 'assigned' ? 'pending' : (t.status || 'pending'),
          assignedTo: null,
          assignedAt: null,
          deadline: null,
          excluded: new Set(),
        });
      }
    }
    queue = [...tasks.values()].filter((t) => t.status === 'pending').map((t) => t.id);
    return tasks.size > 0;
  } catch (err) {
    console.warn('Could not load ledger:', err.message);
    try {
      const backup = `${CONFIG.statePath}.corrupt.${Date.now()}`;
      fs.renameSync(CONFIG.statePath, backup);
      console.warn(`Moved corrupted ledger to ${backup}`);
    } catch { /* ignore */ }
    return false;
  }
}

module.exports = {
  getTasks, getWallets, getNodes, getBatches, getClaims, getCounters,
  getQueue, setQueue, isDirty, setDirty,
  isRefillScheduled, setRefillScheduled,
  timers,
  createBatch, createCompanyBatch, onTaskCompleted,
  clearTaskTimer, requeueTask,
  abandonCurrentTask, releaseIfCurrent,
  creditWallet, claimWallet, saveState, loadState,
};
