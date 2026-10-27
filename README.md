# Vampire Cloud 🧛

A **distributed compute grid** where idle machines sell their spare CPU cycles for VAMP tokens.

```
┌──────────────────────────────────────────────────┐
│              Vampire Cloud Architecture          │
│                                                  │
│  ┌─────────────┐   ws://.../observer   ┌───────┐ │
│  │  Dashboard  │◄──────────────────────│       │ │
│  │  (Next.js)  │                       │Master │ │
│  └─────────────┘                       │(Node) │ │
│                                        │       │ │
│  ┌─────────────┐   ws://.../worker     │       │ │
│  │  Worker × N │◄──────────────────────│       │ │
│  │  (Python)   │──────────────────────►│       │ │
│  └─────────────┘                       └───────┘ │
└──────────────────────────────────────────────────┘
```

## Features

- **Master server** (Node.js / `ws`) — assigns tasks, verifies proofs, manages the VAMP ledger
- **Worker node** (Python / `asyncio` + `websockets`) — runs compute off the event loop; reconnects automatically
- **Observer dashboard** (Next.js / React) — live WebSocket feed with progress bars, node cards, leaderboard, and event log
- **Proof-of-Work** — SHA-256 PoW verified server-side; pluggable workload registry
- **Fault tolerance** — task timeouts + requeue, exponential back-off, graceful shutdown, atomic ledger persistence
- **Docker & docker-compose** — one command to run everything
- **GitHub Actions CI** — lint, type-check, and Docker build on every push

---

## Project Structure

```
vampire-cloud/
├── master/                    # Orchestrator server (Node.js)
│   ├── src/
│   │   ├── server.js          # Entry point, HTTP + WS transport
│   │   ├── config.js          # Centralised configuration
│   │   ├── logger.js          # Ring-buffer event logger
│   │   ├── state.js           # Mutable global state & persistence
│   │   ├── scheduler.js       # Task assignment, PoW verification, worker protocol
│   │   ├── telemetry.js       # Observer fan-out, state snapshot builder
│   │   └── utils.js           # WebSocket helpers
│   ├── Dockerfile
│   └── package.json
│
├── worker/                    # Compute node (Python)
│   ├── __init__.py
│   ├── __main__.py            # `python -m worker` entry point
│   ├── cli.py                 # Argument parsing, logging setup
│   ├── node.py                # Worker class (connection + compute loop)
│   ├── workloads.py           # Pluggable workload registry + SHA-256 PoW
│   ├── requirements.txt
│   └── Dockerfile
│
├── dashboard/                 # Observer UI (Next.js 15 + Tailwind)
│   ├── app/
│   │   ├── layout.tsx         # Root layout + metadata
│   │   ├── page.tsx           # Main dashboard page
│   │   ├── globals.css        # Global styles
│   │   ├── types/index.ts     # Shared TypeScript types
│   │   ├── hooks/
│   │   │   ├── useObserver.ts # WebSocket hook with reconnect
│   │   │   └── useTick.ts     # 1s re-render tick hook
│   │   └── components/
│   │       ├── ConnectionPill.tsx
│   │       ├── EventLog.tsx
│   │       ├── Leaderboard.tsx
│   │       ├── NodeCard.tsx
│   │       ├── Stat.tsx
│   │       └── utils.ts       # Formatting helpers + design tokens
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── next.config.js
│
├── data/                      # Ledger persistence (gitignored)
├── .github/workflows/ci.yml   # GitHub Actions CI
├── docker-compose.yml
├── .env.example
├── pyproject.toml
└── README.md
```

---

## Architecture & Features

- **Master Orchestrator** (Node.js / `ws` / `mongodb`) — Task scheduling, cryptographic proof verification, dynamic spot pricing, enterprise invitation management, and ledger accounting.
- **Enterprise Client Portal** — Containerized payload configuration (Docker OCI images, S3 dataset URIs, runtime parameters), dynamic spot pricing order book, and real-time geographical telemetry.
- **Compute Contributor Portal** — In-browser compute runner, Python CLI integration, interactive SVG time-series hashrate charts (24h/7d), real-time hardware telemetry (CPU/GPU thermals, RAM load, thread utilization), and 1-click token payouts.
- **Root Administrator Center** — Cryptographic onboarding invitation token generation for enterprise clients (no arbitrary typing), verified purchase order and tokenomics ledger (fiat invoices / USDC escrow), and registry audit tables.
- **Proof-of-Work Engine** — SHA-256 target difficulty validation verified server-side with zero trust.
- **Fault Tolerance** — Task timeouts, retry re-queueing, exponential back-off, persistent volume storage, and graceful shutdown.

---

## Quick Start

### Docker Compose

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start the full enterprise stack (MongoDB, Master, Dashboard, Worker)
docker compose up -d --build
```

**Access Points:**
- **Web Command Center:** http://localhost:3000
- **Master REST & WebSocket API:** http://localhost:8080
- **Dynamic Spot Pricing:** http://localhost:8080/api/pricing/spot
- **Health Check Probe:** http://localhost:8080/healthz
- **Prometheus Metrics:** http://localhost:8080/metrics

---

### Option 2 — Local Development

#### Master server

```bash
cd master
npm install
npm run dev
# Listening on :8080
```

#### Dashboard

```bash
cd dashboard
npm install
# Create .env.local:
echo "NEXT_PUBLIC_MASTER_WS_URL=ws://localhost:8080/observer" > .env.local
npm run dev
# Open http://localhost:3000
```

#### Worker node

```bash
# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# or: source .venv/bin/activate  # macOS / Linux

pip install -r worker/requirements.txt

python -m worker --wallet 0xYourWallet
# or with verbose logging:
python -m worker --wallet 0xYourWallet --verbose
```

---

## Configuration

All settings are driven by environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Master server port |
| `TOTAL_TASKS` | `100` | Tasks per batch |
| `DIFFICULTY` | `5` | SHA-256 PoW leading zeros |
| `TASK_TIMEOUT_MS` | `30000` | Task deadline (ms) |
| `REWARD_PER_TASK` | `10` | VAMP per verified task |
| `AUTO_REFILL` | `false` | Auto-start next batch |
| `NEXT_PUBLIC_MASTER_WS_URL` | `ws://localhost:8080/observer` | Dashboard WebSocket URL |
| `VAMP_MASTER_URL` | `ws://localhost:8080/worker` | Worker WebSocket URL |
| `VAMP_WALLET` | random | Worker payout wallet |
| `VAMP_NODE_NAME` | hostname | Worker display name |

---

## Adding New Workloads

Register a new workload in `worker/workloads.py`:

```python
from worker.workloads import workload, ComputeCancelled
import threading

@workload("my_workload")
def my_workload(payload: dict, cancel: threading.Event) -> dict:
    # Poll cancel.is_set() regularly and raise ComputeCancelled to stop.
    if cancel.is_set():
        raise ComputeCancelled()
    result = do_heavy_work(payload["input"])
    return {"output": result}
```

The master sends the workload name in each task message; the worker looks it up from the registry.

---

## WebSocket Protocol

### Worker ↔ Master

| Direction | Message |
|---|---|
| Worker → Master | `{ type: "register", nodeId, wallet, name, version }` |
| Master → Worker | `{ type: "registered", nodeId }` |
| Master → Worker | `{ type: "task", taskId, workload, payload, timeoutMs }` |
| Worker → Master | `{ type: "result", taskId, output: { nonce, hash, hashes, elapsedSec } }` |
| Worker → Master | `{ type: "failed", taskId, error }` |
| Master → Worker | `{ type: "ack", taskId, accepted, reward?, balance?, reason? }` |
| Master → Worker | `{ type: "cancel", taskId, reason }` |
| Master → Worker | `{ type: "error", code, message, fatal? }` |

### Observer ← Master

Broadcast every 1 second:
```json
{
  "type": "state",
  "ts": 1700000000000,
  "config": { "taskTimeoutMs": 30000, "rewardPerTask": 10, "difficulty": 5 },
  "stats": { "batch": 1, "totalTasks": 100, "completedTasks": 42, ... },
  "nodes": [...],
  "leaderboard": [...],
  "events": [...]
}
```

---

## License

MIT
