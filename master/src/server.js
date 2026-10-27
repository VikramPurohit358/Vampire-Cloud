'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');

const { CONFIG } = require('./config');
const { logEvent } = require('./logger');
const state = require('./state');
const { dispatch, onWorkerMessage, onWorkerClose } = require('./scheduler');
const { broadcastState, onObserverConnect, onObserverClose, pruneOfflineNodes } = require('./telemetry');
const { send, liveWorkerCount } = require('./utils');
const {
  initDb,
  authenticateAny,
  registerUser,
  createEnterpriseInvite,
  getEnterpriseInvite,
  acceptEnterpriseInvite,
  getAllInvites,
  recordBillingTransaction,
  getBillingHistory,
  getAllAccounts,
} = require('./db');

function readJson(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > maxBytes) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!buf.trim()) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    });
    return res.end();
  }

  let pathname = '';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }

  if (pathname === '/healthz' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      workers: liveWorkerCount(state.getNodes()),
      batch: state.getCounters().batch,
      minted: state.getCounters().minted,
    });
  }

  if (pathname === '/metrics' && req.method === 'GET') {
    const counters = state.getCounters();
    const tasks = state.getTasks();
    let completed = 0, assigned = 0, pending = 0;
    for (const t of tasks.values()) {
      if (t.status === 'completed') completed++;
      else if (t.status === 'assigned') assigned++;
      else pending++;
    }
    res.writeHead(200, {
      'Content-Type': 'text/plain; version=0.0.4',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end([
      `# HELP vc_tasks_total Total tasks in the current batch`,
      `# TYPE vc_tasks_total gauge`,
      `vc_tasks_total ${tasks.size}`,
      `vc_tasks_completed ${completed}`,
      `vc_tasks_pending ${pending}`,
      `vc_tasks_assigned ${assigned}`,
      `vc_workers_live ${liveWorkerCount(state.getNodes())}`,
      `vc_minted_total ${counters.minted}`,
    ].join('\n') + '\n');
  }

  // Universal unified login endpoint (directs to admin, company, or user role)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || !password) {
        return sendJson(res, 400, { ok: false, error: 'Email and password are required' });
      }
      const auth = await authenticateAny(email, password);
      if (!auth.ok) {
        return sendJson(res, 401, { ok: false, error: auth.error });
      }
      return sendJson(res, 200, { ok: true, session: auth.session });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // Contributor / Worker self-registration endpoint
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const session = await registerUser(body);
      return sendJson(res, 201, { ok: true, session });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Legacy/Dedicated company login endpoint
  if (pathname === '/api/company/login' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || !password) {
        return sendJson(res, 400, { ok: false, error: 'Email and password are required' });
      }
      const auth = await authenticateAny(email, password);
      if (!auth.ok || auth.session.role !== 'company') {
        return sendJson(res, 401, { ok: false, error: auth.error || 'Enterprise company account credentials required' });
      }
      return sendJson(res, 200, { ok: true, session: auth.session });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // Admin: Create secure enterprise invitation link
  if (pathname === '/api/admin/invites' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const adminKey = req.headers['authorization'] || req.headers['x-admin-key'] || body.adminKey;
      if (adminKey !== 'vampire-admin-secret-2026' && adminKey !== `Bearer ${CONFIG.jwtSecret}`) {
        return sendJson(res, 403, { ok: false, error: 'Unauthorized: Admin privileges required' });
      }
      const invite = await createEnterpriseInvite(body);
      return sendJson(res, 201, { ok: true, invite });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Admin: List all enterprise invites
  if (pathname === '/api/admin/invites' && req.method === 'GET') {
    const adminKey = req.headers['authorization'] || req.headers['x-admin-key'];
    if (adminKey !== 'vampire-admin-secret-2026' && adminKey !== `Bearer ${CONFIG.jwtSecret}`) {
      return sendJson(res, 403, { ok: false, error: 'Unauthorized: Admin privileges required' });
    }
    const invites = await getAllInvites();
    return sendJson(res, 200, { ok: true, invites });
  }

  // Enterprise: Validate invitation token
  const inviteMatch = pathname.match(/^\/api\/auth\/invite\/([^/]+)$/);
  if (inviteMatch && req.method === 'GET') {
    const token = inviteMatch[1];
    const invite = await getEnterpriseInvite(token);
    if (!invite) {
      return sendJson(res, 404, { ok: false, error: 'Invitation not found or expired' });
    }
    return sendJson(res, 200, {
      ok: true,
      invite: {
        companyName: invite.companyName,
        email: invite.email,
        contactPerson: invite.contactPerson,
        serviceTier: invite.serviceTier,
        allocatedCredits: invite.allocatedCredits,
        status: invite.status,
      },
    });
  }

  // Enterprise: Accept invitation and setup credentials
  if (pathname === '/api/auth/accept-invite' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!body.token || !body.password) {
        return sendJson(res, 400, { ok: false, error: 'Invitation token and password are required' });
      }
      const session = await acceptEnterpriseInvite(body);
      return sendJson(res, 200, { ok: true, session });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Admin: Credit purchase allocation order (fiat / crypto escrow)
  if (pathname === '/api/admin/billing/credit' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const adminKey = req.headers['authorization'] || req.headers['x-admin-key'] || body.adminKey;
      if (adminKey !== 'vampire-admin-secret-2026' && adminKey !== `Bearer ${CONFIG.jwtSecret}`) {
        return sendJson(res, 403, { ok: false, error: 'Unauthorized: Admin privileges required' });
      }
      const tx = await recordBillingTransaction(body);
      return sendJson(res, 201, { ok: true, transaction: tx });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Company: Get billing ledger & purchase transactions
  if (pathname === '/api/company/billing' && req.method === 'GET') {
    const companyId = parsed.query?.companyId || null;
    const history = await getBillingHistory(companyId);
    return sendJson(res, 200, { ok: true, history });
  }

  // Dynamic Spot Pricing Engine: Calculates current network rate per TFLOPS
  if (pathname === '/api/pricing/spot' && req.method === 'GET') {
    const activeNodes = liveWorkerCount();
    const queueDepth = state.getQueue().length;
    // Base spot rate 12.0 VAMP with supply/demand elasticity
    const spotRate = Number((12.0 + (queueDepth * 0.15) - Math.min(4.0, activeNodes * 0.5)).toFixed(2));
    return sendJson(res, 200, {
      ok: true,
      spotRate: Math.max(8.0, spotRate),
      unit: 'VAMP/TFLOPS-hr',
      networkCapacityTflops: activeNodes * 4.2 + 12.4,
      networkDifficulty: CONFIG.difficulty,
      activeNodes,
      queueDepth,
      timestamp: Date.now(),
    });
  }

  // Admin list all accounts (companies and users)
  if (pathname === '/api/admin/accounts' && req.method === 'GET') {
    const adminKey = req.headers['authorization'] || req.headers['x-admin-key'];
    if (adminKey !== 'vampire-admin-secret-2026' && adminKey !== `Bearer ${CONFIG.jwtSecret}`) {
      return sendJson(res, 403, { ok: false, error: 'Unauthorized: Admin privileges required' });
    }
    const accounts = await getAllAccounts();
    return sendJson(res, 200, { ok: true, ...accounts });
  }

  if (pathname === '/api/batches') {
    if (req.method === 'GET') {
      const list = [...state.getBatches().values()].sort((a, b) => b.createdAt - a.createdAt);
      return sendJson(res, 200, { ok: true, batches: list });
    }
    if (req.method === 'POST') {
      try {
        const body = await readJson(req);
        if (!body.company || typeof body.company !== 'string' || !body.company.trim()) {
          return sendJson(res, 400, { ok: false, error: 'Company identifier is required' });
        }
        const batch = state.createCompanyBatch({
          company: body.company,
          name: body.name,
          category: body.category,
          dockerImage: body.dockerImage,
          datasetUri: body.datasetUri,
          commandArgs: body.commandArgs,
          environment: body.environment,
          totalTasks: body.totalTasks,
          difficulty: body.difficulty,
          rewardPerTask: body.rewardPerTask,
          spotPrice: body.spotPrice,
          workload: body.workload,
          completionTimeSeconds: body.completionTimeSeconds,
        });
        dispatch();
        broadcastState();
        return sendJson(res, 201, { ok: true, batch });
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message });
      }
    }
  }

  const batchResultsMatch = pathname.match(/^\/api\/batches\/([^/]+)\/results$/);
  if (batchResultsMatch && req.method === 'GET') {
    const batchId = decodeURIComponent(batchResultsMatch[1]);
    const batch = state.getBatches().get(batchId);
    if (!batch) {
      return sendJson(res, 404, { ok: false, error: 'Batch not found' });
    }
    const results = [];
    for (const t of state.getTasks().values()) {
      if (t.batchId === batchId) {
        results.push({
          id: t.id,
          status: t.status,
          difficulty: t.difficulty,
          reward: t.reward,
          completedBy: t.completedBy,
          completedAt: t.completedAt,
          nonce: t.nonce,
          hash: t.hash,
          attempts: t.attempts,
        });
      }
    }
    return sendJson(res, 200, { ok: true, batch, results });
  }

  const walletMatch = pathname.match(/^\/api\/wallets\/([^/]+)$/);
  if (walletMatch && req.method === 'GET') {
    const wallet = decodeURIComponent(walletMatch[1]);
    const w = state.getWallets().get(wallet) || { earnings: 0, tasks: 0, claimed: 0 };
    const claims = state.getClaims().get(wallet) || [];
    let activeNodes = 0;
    for (const n of state.getNodes().values()) {
      if (n.wallet === wallet && n.status !== 'offline') activeNodes++;
    }
    return sendJson(res, 200, {
      ok: true,
      wallet,
      earnings: w.earnings,
      tasks: w.tasks,
      claimed: w.claimed || 0,
      activeNodes,
      claims,
    });
  }

  const claimMatch = pathname.match(/^\/api\/wallets\/([^/]+)\/claim$/);
  if (claimMatch && req.method === 'POST') {
    const wallet = decodeURIComponent(claimMatch[1]);
    try {
      const claimRecord = state.claimWallet(wallet);
      broadcastState();
      return sendJson(res, 200, { ok: true, claim: claimRecord });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('Not Found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logEvent('error', `Port ${CONFIG.port} is already in use. Please choose another port via PORT=...`);
  } else {
    logEvent('error', `Server error: ${err.message}`);
  }
  process.exit(1);
});

const workerWss   = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const observerWss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });

workerWss.on('error', (err) => logEvent('warn', `Worker WSS error: ${err.message}`));
observerWss.on('error', (err) => logEvent('warn', `Observer WSS error: ${err.message}`));

server.on('upgrade', (req, socket, head) => {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    return socket.destroy();
  }

  if (pathname === '/worker') {
    workerWss.handleUpgrade(req, socket, head, (ws) => workerWss.emit('connection', ws, req));
  } else if (pathname === '/observer') {
    observerWss.handleUpgrade(req, socket, head, (ws) => observerWss.emit('connection', ws, req));
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

workerWss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.nodeId = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.regTimer = setTimeout(() => {
    if (!ws.nodeId) {
      ws.close(1008, 'registration timeout');
    }
  }, CONFIG.registrationTimeoutMs);

  ws.on('message', (data) => {
    ws.isAlive = true;
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return send(ws, { type: 'error', code: 'bad_json', message: 'Invalid JSON' });
    }
    if (!msg || typeof msg !== 'object') return;
    try {
      onWorkerMessage(ws, msg);
    } catch (err) {
      console.error('Worker handler error:', err);
    }
  });

  ws.on('close', () => onWorkerClose(ws));
  ws.on('error', (err) => console.warn('Worker socket error:', err.message));
});

observerWss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', () => {});
  ws.on('close', () => onObserverClose(ws));
  ws.on('error', () => onObserverClose(ws));
  onObserverConnect(ws);
});

const heartbeat = setInterval(() => {
  for (const wss of [workerWss, observerWss]) {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }
}, CONFIG.heartbeatMs);

const telemetry = setInterval(() => {
  pruneOfflineNodes();
  dispatch();
  broadcastState();
}, CONFIG.telemetryMs);

const persister = setInterval(() => state.saveState(), CONFIG.persistMs);

if (state.loadState()) {
  logEvent('info', `Restored ledger: ${state.getTasks().size} tasks, ${state.getQueue().length} pending, ${state.getWallets().size} wallets`);
} else {
  state.createBatch();
  logEvent('info', `Created batch ${state.getCounters().batch}: ${state.getTasks().size} tasks at difficulty ${CONFIG.difficulty}`);
}
dispatch();

initDb().then(() => {
  server.listen(CONFIG.port, () => {
    logEvent('info', `Vampire Cloud master listening on :${CONFIG.port}`);
  });
}).catch((err) => {
  console.error('Database initialization error:', err);
  server.listen(CONFIG.port, () => {
    logEvent('info', `Vampire Cloud master listening on :${CONFIG.port} (standalone mode)`);
  });
});

let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logEvent('info', `${signal} received — shutting down`);
  clearInterval(heartbeat);
  clearInterval(telemetry);
  clearInterval(persister);

  for (const t of state.timers.values()) clearTimeout(t);
  for (const task of state.getTasks().values()) {
    if (task.status === 'assigned') task.status = 'pending';
  }
  state.setDirty(true);
  state.saveState();

  for (const wss of [workerWss, observerWss]) {
    for (const ws of wss.clients) {
      try { ws.close(1001, 'server shutting down'); } catch { /* ignore */ }
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
