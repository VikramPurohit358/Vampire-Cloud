export type NodeStatus = 'idle' | 'computing' | 'offline';
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'disconnected';
export type UserRole = 'admin' | 'company' | 'user';

export interface WorkerNode {
  id: string;
  name: string;
  wallet: string;
  status: NodeStatus;
  currentTask: string | null;
  taskStartedAt: number | null;
  tasksCompleted: number;
  strikes: number;
  lastSeen: number;
}

export interface LeaderboardRow {
  wallet: string;
  earnings: number;
  tasks: number;
  activeNodes: number;
}

export interface GridEvent {
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface GridConfig {
  taskTimeoutMs: number;
  rewardPerTask: number;
  difficulty: number;
}

export interface GridStats {
  batch: number;
  totalTasks: number;
  completedTasks: number;
  assignedTasks: number;
  pendingTasks: number;
  connectedNodes: number;
  computingNodes: number;
  requeued: number;
  timeouts: number;
  rejectedProofs: number;
  totalMinted: number;
}

export interface ComputeEnvironment {
  cores: number;
  memoryGb: number;
  gpu: boolean;
  arch: string;
}

export interface WorkloadTelemetry {
  geoDistribution: { [region: string]: number };
  avgLatencyMs: number;
  errorRatePct: number;
  throughputMhs: number;
  etaSeconds: number;
}

export interface Batch {
  id: string;
  name: string;
  company: string;
  category?: string;
  dockerImage?: string;
  datasetUri?: string;
  commandArgs?: string;
  environment?: ComputeEnvironment;
  totalTasks: number;
  completedTasks: number;
  rewardPerTask: number;
  totalBounty: number;
  spotPrice?: number;
  difficulty: number;
  workload: string;
  status: 'active' | 'completed';
  createdAt: number;
  completedAt: number | null;
  telemetry?: WorkloadTelemetry;
}

export interface BatchTaskResult {
  id: string;
  status: 'pending' | 'assigned' | 'completed';
  difficulty: number;
  reward: number;
  completedBy: string | null;
  completedAt: number | null;
  nonce: number | null;
  hash: string | null;
  attempts: number;
}

export interface ClaimRecord {
  wallet: string;
  amount: number;
  txHash: string;
  claimedAt: number;
}

export interface WalletProfile {
  wallet: string;
  earnings: number;
  tasks: number;
  claimed: number;
  activeNodes: number;
  claims: ClaimRecord[];
}

export interface HardwareTelemetry {
  cpuTemp: number;
  gpuTemp: number;
  memoryUtilPct: number;
  threads: number;
  powerWatts: number;
  fanSpeedPct: number;
}

export interface TimeSeriesPoint {
  time: string;
  timestamp: number;
  hashrate: number;
  earnings: number;
  tasks: number;
}

export interface BillingTransaction {
  id: string;
  companyId: string;
  type: 'fiat_invoice' | 'crypto_escrow' | 'smart_contract';
  gateway: string;
  amountUsd: number;
  creditsAllocated: number;
  status: 'settled' | 'escrowed' | 'pending';
  referenceHash: string;
  timestamp: number;
}

export interface EnterpriseInvite {
  id: string;
  companyName: string;
  email: string;
  contactPerson: string;
  inviteToken: string;
  serviceTier: 'Enterprise Dedicated' | 'Scale Compute' | 'Research Tier';
  allocatedCredits: number;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface CompanySession {
  role: 'company';
  companyId: string;
  email: string;
  name: string;
  allocatedBudget: number;
  contactPerson?: string;
  serviceTier?: string;
  token: string;
  loginAt: number;
}

export interface UserSession {
  role: 'user';
  userId?: string;
  email?: string;
  wallet: string;
  username: string;
  name?: string;
  token?: string;
  loginAt: number;
}

export interface AdminSession {
  role: 'admin';
  userId: string;
  email: string;
  name: string;
  token: string;
  loginAt: number;
}

export type AuthSession = AdminSession | CompanySession | UserSession;

export interface Snapshot {
  type: 'state';
  ts: number;
  config: GridConfig;
  stats: GridStats;
  nodes: WorkerNode[];
  batches?: Batch[];
  leaderboard: LeaderboardRow[];
  events: GridEvent[];
}
