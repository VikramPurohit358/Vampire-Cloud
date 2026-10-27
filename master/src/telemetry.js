'use strict';

const { CONFIG } = require('./config');
const { logEvent: _log, getEvents } = require('./logger');
const state = require('./state');
const { isOpen } = require('./utils');

const observers = new Set();

function buildState() {
  const t = Date.now();
  const tasks = state.getTasks();
  const counters = state.getCounters();
  const wallets = state.getWallets();
  const nodes = state.getNodes();

  let completed = 0, assigned = 0, pending = 0;
  for (const task of tasks.values()) {
    if (task.status === 'completed') completed++;
    else if (task.status === 'assigned') assigned++;
    else pending++;
  }

  const order = { computing: 0, idle: 1, offline: 2 };
  const nodeList = [...nodes.values()]
    .map((n) => {
      const task = n.currentTask ? tasks.get(n.currentTask) : null;
      return {
        id: n.id, name: n.name, wallet: n.wallet, status: n.status,
        currentTask: n.currentTask,
        taskStartedAt: task ? task.assignedAt : null,
        tasksCompleted: n.completed,
        strikes: n.strikes,
        lastSeen: n.lastSeen,
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  const activeByWallet = new Map();
  for (const n of nodeList) {
    if (n.status !== 'offline') activeByWallet.set(n.wallet, (activeByWallet.get(n.wallet) || 0) + 1);
  }

  const leaderboard = [...wallets.entries()]
    .map(([wallet, w]) => ({ wallet, earnings: w.earnings, tasks: w.tasks, activeNodes: activeByWallet.get(wallet) || 0 }))
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 25);

  const batchList = [...state.getBatches().values()]
    .map((b) => ({
      id: b.id,
      name: b.name,
      company: b.company,
      totalTasks: b.totalTasks,
      completedTasks: b.completedTasks || 0,
      rewardPerTask: b.rewardPerTask,
      totalBounty: b.totalBounty,
      difficulty: b.difficulty,
      workload: b.workload,
      status: b.status,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    type: 'state',
    ts: t,
    config: { taskTimeoutMs: CONFIG.taskTimeoutMs, rewardPerTask: CONFIG.rewardPerTask, difficulty: CONFIG.difficulty },
    stats: {
      batch: counters.batch,
      totalTasks: tasks.size,
      completedTasks: completed,
      assignedTasks: assigned,
      pendingTasks: pending,
      connectedNodes: nodeList.filter((n) => n.status !== 'offline').length,
      computingNodes: nodeList.filter((n) => n.status === 'computing').length,
      requeued: counters.requeued,
      timeouts: counters.timeouts,
      rejectedProofs: counters.rejected,
      totalMinted: counters.minted,
    },
    nodes: nodeList,
    batches: batchList,
    leaderboard,
    events: getEvents(25),
  };
}

function broadcastState() {
  if (observers.size === 0) return;
  const payload = JSON.stringify(buildState());
  for (const ws of observers) {
    if (!isOpen(ws) || ws.bufferedAmount > 1_000_000) continue;
    try { ws.send(payload); } catch { /* closed mid-send */ }
  }
}

function onObserverConnect(ws) {
  observers.add(ws);
  try { ws.send(JSON.stringify(buildState())); } catch { /* ignore */ }
}

function onObserverClose(ws) {
  observers.delete(ws);
}

function pruneOfflineNodes() {
  const cutoff = Date.now() - CONFIG.offlineRetentionMs;
  for (const [id, n] of state.getNodes()) {
    if (n.status === 'offline' && n.disconnectedAt && n.disconnectedAt < cutoff) {
      state.getNodes().delete(id);
    }
  }
}

module.exports = { observers, buildState, broadcastState, onObserverConnect, onObserverClose, pruneOfflineNodes };
