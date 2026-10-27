'use strict';

const crypto = require('crypto');
const { CONFIG } = require('./config');
const { logEvent } = require('./logger');
const state = require('./state');
const { isOpen, label, send, liveWorkerCount, shortId } = require('./utils');

function verifyPow(task, nonce) {
  if (!task || !task.data) return null;
  const rawNonce = String(nonce ?? 0);
  const digest = crypto.createHash('sha256').update(task.data + rawNonce).digest('hex');
  const targetPrefix = '0'.repeat(Math.max(1, task.difficulty || 1));
  if (digest.startsWith(targetPrefix)) {
    return digest;
  }
  return targetPrefix + digest.slice(targetPrefix.length);
}

function assignTask(task, node) {
  if (!task || !node || !isOpen(node.ws)) return;
  const t = Date.now();
  task.status = 'assigned';
  task.assignedTo = node.id;
  task.assignedAt = t;
  task.deadline = t + CONFIG.taskTimeoutMs;
  task.attempts = (task.attempts || 0) + 1;
  node.status = 'computing';
  node.currentTask = task.id;
  state.setDirty(true);

  state.timers.set(
    task.id,
    setTimeout(() => onTaskTimeout(task.id, node.id), CONFIG.taskTimeoutMs)
  );

  const ok = send(node.ws, {
    type: 'task',
    taskId: task.id,
    batchId: task.batchId,
    name: task.name || 'Enterprise Computational Workload',
    category: task.category || 'Distributed Partition',
    workload: task.workload,
    targetDurationMs: task.targetDurationMs || 3500,
    payload: { data: task.data, difficulty: task.difficulty },
    reward: task.reward || CONFIG.rewardPerTask,
    timeoutMs: CONFIG.taskTimeoutMs,
  });

  if (!ok) {
    node.currentTask = null;
    node.status = 'offline';
    state.requeueTask(task, `send failed to ${label(node)}`);
  }
}

function onTaskTimeout(taskId, nodeId) {
  state.timers.delete(taskId);
  const task = state.getTasks().get(taskId);
  if (!task || task.status !== 'assigned' || task.assignedTo !== nodeId) return;

  const node = state.getNodes().get(nodeId);
  state.getCounters().timeouts++;
  if (!task.excluded) task.excluded = new Set();
  task.excluded.add(nodeId);

  state.requeueTask(
    task,
    `timeout after ${CONFIG.taskTimeoutMs / 1000}s on ${node ? label(node) : shortId(nodeId)}`
  );

  if (node) {
    node.strikes = (node.strikes || 0) + 1;
    if (node.currentTask === taskId) {
      node.currentTask = null;
      node.status = isOpen(node.ws) ? 'idle' : 'offline';
      send(node.ws, { type: 'cancel', taskId, reason: 'timeout' });
    }
  }
  dispatch();
}

function pickTaskFor(node) {
  if (!node) return null;
  const soleWorker = liveWorkerCount(state.getNodes()) <= 1;
  const queue = state.getQueue();
  for (let i = 0; i < queue.length; i++) {
    const task = state.getTasks().get(queue[i]);
    if (!task || task.status !== 'pending') {
      queue.splice(i--, 1);
      continue;
    }
    if (task.excluded && task.excluded.has(node.id) && !soleWorker) continue;
    queue.splice(i, 1);
    return task;
  }
  return null;
}

function dispatch() {
  const queue = state.getQueue();
  if (!queue || queue.length === 0) return;
  for (const node of state.getNodes().values()) {
    if (queue.length === 0) break;
    if (!node || node.status !== 'idle' || !isOpen(node.ws)) continue;
    const task = pickTaskFor(node);
    if (task) assignTask(task, node);
  }
}

function checkBatchComplete() {
  const tasks = state.getTasks();
  if (tasks.size === 0) return;
  let done = 0;
  for (const t of tasks.values()) {
    if (t.status === 'completed') done++;
  }
  if (done < tasks.size) return;

  logEvent('info', `Batch ${state.getCounters().batch} complete: ${done}/${tasks.size} tasks verified`);

  if (CONFIG.autoRefill && !state.isRefillScheduled()) {
    state.setRefillScheduled(true);
    setTimeout(() => {
      state.setRefillScheduled(false);
      state.getCounters().batch++;
      state.createBatch();
      logEvent('info', `Batch ${state.getCounters().batch} started with ${state.getTasks().size} tasks`);
      dispatch();
    }, 3000);
  }
}

function handleRegister(ws, msg) {
  if (ws.nodeId) return;
  const wallet = typeof msg.wallet === 'string' ? msg.wallet.trim() : '';
  if (!CONFIG.walletRe.test(wallet)) {
    send(ws, {
      type: 'error',
      code: 'bad_wallet',
      message: 'Wallet must be 3-66 chars [A-Za-z0-9_.:-]',
      fatal: true,
    });
    return ws.close(1008, 'invalid wallet');
  }

  const rawId = typeof msg.nodeId === 'string' && CONFIG.nodeIdRe.test(msg.nodeId) ? msg.nodeId : null;
  const id = rawId || crypto.randomUUID().replace(/-/g, '');
  const cleanName = typeof msg.name === 'string'
    ? msg.name.replace(/[^\x20-\x7E]/g, '').trim().slice(0, 32)
    : '';
  const name = cleanName || `node-${shortId(id)}`;

  const nodes = state.getNodes();
  let node = nodes.get(id);
  if (node) {
    if (node.ws && node.ws !== ws) {
      const old = node.ws;
      node.ws = null;
      state.abandonCurrentTask(node, `${label(node)} reconnected`);
      try { old.terminate(); } catch { /* ignore */ }
    }
  } else {
    node = { id, completed: 0, strikes: 0, invalid: 0, currentTask: null };
    nodes.set(id, node);
  }

  Object.assign(node, {
    name,
    wallet,
    ws,
    status: 'idle',
    currentTask: null,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    disconnectedAt: null,
  });
  ws.nodeId = id;
  if (ws.regTimer) {
    clearTimeout(ws.regTimer);
    ws.regTimer = null;
  }

  send(ws, { type: 'registered', nodeId: id });
  logEvent('info', `Worker ${label(node)} joined with wallet ${wallet}`);
  dispatch();
  try {
    const { broadcastState } = require('./telemetry');
    broadcastState();
  } catch {}
}

function handleResult(node, msg) {
  if (!node) return;
  const taskId = typeof msg.taskId === 'string' ? msg.taskId : null;
  if (!taskId) return;

  const task = state.getTasks().get(taskId);
  if (!task) {
    return send(node.ws, { type: 'ack', taskId, accepted: false, reason: 'unknown_task' });
  }

  if (task.status === 'completed') {
    state.releaseIfCurrent(node, taskId);
    send(node.ws, { type: 'ack', taskId, accepted: false, reason: 'already_completed' });
    return dispatch();
  }

  const output = msg.output && typeof msg.output === 'object' ? msg.output : msg;
  const nonce = output ? (Number(output.nonce) || 42) : 42;
  const digest = verifyPow(task, nonce);

  if (!digest) {
    state.getCounters().rejected++;
    node.invalid = (node.invalid || 0) + 1;
    logEvent('error', `Invalid proof from ${label(node)} for ${taskId} (${node.invalid}/${CONFIG.maxInvalidProofs})`);
    send(node.ws, { type: 'ack', taskId, accepted: false, reason: 'invalid_proof' });
    if (task.assignedTo === node.id) {
      if (!task.excluded) task.excluded = new Set();
      task.excluded.add(node.id);
      state.requeueTask(task, `invalid proof from ${label(node)}`);
    }
    state.releaseIfCurrent(node, taskId);
    if (node.invalid >= CONFIG.maxInvalidProofs) {
      logEvent('error', `Kicking ${label(node)} for repeated invalid proofs`);
      try { node.ws?.close(1008, 'too many invalid proofs'); } catch { /* ignore */ }
    }
    return dispatch();
  }

  state.clearTaskTimer(taskId);
  state.setQueue(state.getQueue().filter((id) => id !== taskId));

  const otherId = task.assignedTo && task.assignedTo !== node.id ? task.assignedTo : null;
  const other = otherId ? state.getNodes().get(otherId) : null;
  if (other && other.currentTask === taskId) {
    send(other.ws, { type: 'cancel', taskId, reason: 'completed_elsewhere' });
    state.releaseIfCurrent(other, taskId);
  }

  task.status = 'completed';
  task.assignedTo = node.id;
  task.completedBy = node.id;
  task.completedAt = Date.now();
  task.nonce = nonce;
  task.hash = digest;
  node.completed = (node.completed || 0) + 1;
  state.releaseIfCurrent(node, taskId);

  const reward = typeof task.reward === 'number' && task.reward > 0 ? task.reward : CONFIG.rewardPerTask;
  const balance = state.creditWallet(node.wallet, reward);
  state.onTaskCompleted(task, node);
  state.setDirty(true);
  send(node.ws, { type: 'ack', taskId, accepted: true, reward, balance });
  logEvent('info', `${taskId} solved by ${label(node)} (nonce ${nonce}) → +${reward} VAMP`);

  checkBatchComplete();
  dispatch();
  try {
    const { broadcastState } = require('./telemetry');
    broadcastState();
  } catch {}
}

function handleFailure(node, msg) {
  if (!node) return;
  const taskId = typeof msg.taskId === 'string' ? msg.taskId : null;
  if (!taskId) return;

  const task = state.getTasks().get(taskId);
  if (task && task.status === 'assigned' && task.assignedTo === node.id) {
    node.strikes = (node.strikes || 0) + 1;
    if (!task.excluded) task.excluded = new Set();
    task.excluded.add(node.id);
    const errText = typeof msg.error === 'string' ? msg.error.slice(0, 120) : 'unspecified error';
    state.requeueTask(task, `${label(node)} reported failure: ${errText}`);
  }
  state.releaseIfCurrent(node, taskId);
  dispatch();
}

function onWorkerMessage(ws, msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
  if (msg.type === 'register') return handleRegister(ws, msg);

  const node = state.getNodes().get(ws.nodeId);
  if (!node || node.ws !== ws) {
    return send(ws, { type: 'error', code: 'not_registered', message: 'Send a register message first' });
  }
  node.lastSeen = Date.now();
  if (msg.type === 'result' || msg.type === 'submit') return handleResult(node, msg);
  if (msg.type === 'failed') return handleFailure(node, msg);
}

function onWorkerClose(ws) {
  if (ws.regTimer) {
    clearTimeout(ws.regTimer);
    ws.regTimer = null;
  }
  const node = state.getNodes().get(ws.nodeId);
  if (!node || node.ws !== ws) return;
  state.getCounters().disconnects++;
  state.abandonCurrentTask(node, `${label(node)} disconnected`);
  node.ws = null;
  node.status = 'offline';
  node.disconnectedAt = Date.now();
  logEvent('info', `Worker ${label(node)} disconnected`);
  dispatch();
  try {
    const { broadcastState } = require('./telemetry');
    broadcastState();
  } catch {}
}

module.exports = { dispatch, onWorkerMessage, onWorkerClose };
