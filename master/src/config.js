'use strict';

const path = require('path');

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

const CONFIG = Object.freeze({
  port:                   num(process.env.PORT, 8080),
  totalTasks:             num(process.env.TOTAL_TASKS, 100),
  difficulty:             num(process.env.DIFFICULTY, 5),
  taskTimeoutMs:          num(process.env.TASK_TIMEOUT_MS, 30_000),
  rewardPerTask:          num(process.env.REWARD_PER_TASK, 10),
  heartbeatMs:            10_000,
  telemetryMs:            1_000,
  persistMs:              5_000,
  registrationTimeoutMs:  5_000,
  offlineRetentionMs:     60_000,
  maxInvalidProofs:       3,
  autoRefill:             process.env.AUTO_REFILL === 'true',
  statePath:              process.env.STATE_FILE || path.join(__dirname, '..', 'data', 'ledger.json'),
  mongodbUri:             process.env.MONGODB_URI || 'mongodb://mongodb:27017/vampire_cloud',
  jwtSecret:              process.env.JWT_SECRET || 'vampire-cloud-secret-token-key-2026',
  walletRe:               /^[A-Za-z0-9_.:-]{3,66}$/,
  nodeIdRe:               /^[A-Za-z0-9_-]{8,64}$/,
});

module.exports = { CONFIG };
