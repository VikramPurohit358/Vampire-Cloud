'use strict';

const fs = require('fs');
const path = require('path');

// Auto-load .env from root or master directory if present
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(__dirname, '..', '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath);
      } else {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
          }
        }
      }
      break;
    } catch {
      // ignore
    }
  }
}

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
