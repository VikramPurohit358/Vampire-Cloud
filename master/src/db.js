'use strict';

const crypto = require('crypto');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // ignore
}
const { MongoClient } = require('mongodb');
const { CONFIG } = require('./config');
const { logEvent } = require('./logger');

let client = null;
let db = null;
let isConnected = false;

// In-memory fallback registries
const memoryUsers = new Map();
const memoryCompanies = new Map();
const memoryInvites = new Map();
const memoryBilling = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + (CONFIG.jwtSecret || 'vampire')).digest('hex');
}

// Pre-seeded standard demo accounts
const SEED_ADMIN = {
  userId: 'usr_admin',
  email: 'admin@vampirecloud.network',
  role: 'admin',
  name: 'Platform Administrator',
  passwordHash: hashPassword('admin123'),
  active: true,
  createdAt: new Date(),
};

const SEED_COMPANY = {
  companyId: 'comp_apexdemo',
  email: 'company@apexquantum.ai',
  name: 'Apex Quantum AI',
  role: 'company',
  passwordHash: hashPassword('company123'),
  contactPerson: 'Dr. Jane Vance',
  allocatedBudget: 50000,
  serviceTier: 'Enterprise Dedicated',
  active: true,
  createdAt: new Date(),
};

const SEED_USER = {
  userId: 'usr_demouser',
  email: 'user@vampirecloud.network',
  role: 'user',
  name: 'Alex Contributor',
  wallet: '0x71C568a23dE11a5D448c267c8282f1E5868B4b03',
  passwordHash: hashPassword('user123'),
  active: true,
  createdAt: new Date(),
};

// Also support legacy/alternative logins
const SEED_COMPANY_ALT = {
  companyId: 'comp_apexdemo',
  email: 'contact@apexquantum.ai',
  name: 'Apex Quantum AI',
  role: 'company',
  passwordHash: hashPassword('company123'),
  contactPerson: 'Dr. Jane Vance',
  allocatedBudget: 50000,
  serviceTier: 'Enterprise Dedicated',
  active: true,
  createdAt: new Date(),
};

const SEED_USER_ALT = {
  userId: 'usr_contributor1',
  email: 'miner@vampirecloud.network',
  role: 'user',
  name: 'Vampire Contributor',
  wallet: '0x71C568a23dE11a5D448c267c8282f1E5868B4b03',
  passwordHash: hashPassword('user123'),
  active: true,
  createdAt: new Date(),
};

async function initDb() {
  memoryUsers.set(SEED_ADMIN.email.toLowerCase(), { ...SEED_ADMIN });
  memoryCompanies.set(SEED_COMPANY.email.toLowerCase(), { ...SEED_COMPANY });
  memoryCompanies.set(SEED_COMPANY_ALT.email.toLowerCase(), { ...SEED_COMPANY_ALT });
  memoryUsers.set(SEED_USER.email.toLowerCase(), { ...SEED_USER });
  memoryUsers.set(SEED_USER_ALT.email.toLowerCase(), { ...SEED_USER_ALT });

  // Initial seed billing transaction
  const seedBilling = {
    id: 'tx_init_001',
    companyId: SEED_COMPANY.companyId,
    type: 'fiat_invoice',
    gateway: 'Stripe Corporate Billing',
    amountUsd: 12500,
    creditsAllocated: 50000,
    status: 'settled',
    referenceHash: '0x' + crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now() - 86400000 * 2,
  };
  memoryBilling.set(seedBilling.id, seedBilling);

  try {
    client = new MongoClient(CONFIG.mongodbUri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    });
    await client.connect();
    db = client.db('vampire_cloud');
    isConnected = true;
    logEvent('info', 'Connected to database (vampire_cloud)');

    const usersCol = db.collection('users');
    const companiesCol = db.collection('companies');
    const invitesCol = db.collection('invites');
    const billingCol = db.collection('billing');

    await usersCol.createIndex({ email: 1 }, { unique: true });
    await companiesCol.createIndex({ email: 1 }, { unique: true });
    await invitesCol.createIndex({ inviteToken: 1 }, { unique: true });

    // Ensure demo accounts exist or are updated with current passwords
    await usersCol.updateOne(
      { email: SEED_ADMIN.email },
      { $set: SEED_ADMIN },
      { upsert: true }
    );
    logEvent('info', 'Configured administrator credentials');

    await companiesCol.updateOne(
      { email: SEED_COMPANY.email },
      { $set: SEED_COMPANY },
      { upsert: true }
    );
    await companiesCol.updateOne(
      { email: SEED_COMPANY_ALT.email },
      { $set: SEED_COMPANY_ALT },
      { upsert: true }
    );
    logEvent('info', 'Provisioned enterprise client: Apex Quantum AI');

    await usersCol.updateOne(
      { email: SEED_USER.email },
      { $set: SEED_USER },
      { upsert: true }
    );
    await usersCol.updateOne(
      { email: SEED_USER_ALT.email },
      { $set: SEED_USER_ALT },
      { upsert: true }
    );
    logEvent('info', 'Configured compute contributor demo accounts');
  } catch (err) {
    isConnected = false;
    logEvent('warn', `Persistent database offline (${err.message}) — running resilient memory registry`);
  }
}

async function getUserByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const cleanEmail = email.trim().toLowerCase();

  if (isConnected && db) {
    try {
      const user = await db.collection('users').findOne({ email: cleanEmail });
      if (user) return user;
    } catch {
      // fallback
    }
  }
  return memoryUsers.get(cleanEmail) || null;
}

async function getCompanyByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const cleanEmail = email.trim().toLowerCase();

  if (isConnected && db) {
    try {
      const company = await db.collection('companies').findOne({ email: cleanEmail });
      if (company) return company;
    } catch {
      // fallback
    }
  }
  return memoryCompanies.get(cleanEmail) || null;
}

/**
 * Universal Unified Authentication:
 * Checks email & password against:
 * 1. Admin/Contributor users
 * 2. Enterprise clients
 * Returns role: 'admin' | 'company' | 'user'
 */
async function authenticateAny(email, password) {
  if (!email || !password) {
    return { ok: false, error: 'Email and password are required' };
  }
  const cleanEmail = email.trim().toLowerCase();
  const hash = hashPassword(password);

  // 1. Check users (Admin or Contributor)
  const user = await getUserByEmail(cleanEmail);
  if (user) {
    if (!user.active) {
      return { ok: false, error: 'This account has been suspended by the network administrator.' };
    }
    if (user.passwordHash !== hash) {
      return { ok: false, error: 'Invalid authentication credentials' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const role = user.role || 'user';
    return {
      ok: true,
      session: {
        role,
        userId: user.userId || user._id?.toString(),
        email: user.email,
        name: user.name,
        wallet: user.wallet || '',
        token,
        loginAt: Date.now(),
      },
    };
  }

  // 2. Check Companies
  const company = await getCompanyByEmail(cleanEmail);
  if (company) {
    if (!company.active) {
      return { ok: false, error: 'This enterprise account is currently deactivated.' };
    }
    if (company.passwordHash !== hash) {
      return { ok: false, error: 'Invalid authentication credentials' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    return {
      ok: true,
      session: {
        role: 'company',
        companyId: company.companyId || company._id?.toString(),
        email: company.email,
        name: company.name,
        contactPerson: company.contactPerson || '',
        serviceTier: company.serviceTier || 'Enterprise Dedicated',
        allocatedBudget: company.allocatedBudget || 10000,
        token,
        loginAt: Date.now(),
      },
    };
  }

  return {
    ok: false,
    error: 'Account not recognized. Enterprise onboarding requires an active corporate invitation.',
  };
}

/**
 * Contributor Sign-Up (Self-service allowed for compute contributors/workers)
 */
async function registerUser({ email, password, name, wallet }) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  const cleanEmail = email.trim().toLowerCase();

  const existingUser = await getUserByEmail(cleanEmail);
  const existingComp = await getCompanyByEmail(cleanEmail);
  if (existingUser || existingComp) {
    throw new Error('An account with this email address already exists');
  }

  const generatedWallet = wallet && wallet.trim().length >= 10
    ? wallet.trim()
    : '0x' + crypto.randomBytes(20).toString('hex');

  const userDoc = {
    userId: 'usr_' + crypto.randomBytes(6).toString('hex'),
    email: cleanEmail,
    role: 'user',
    name: name && name.trim() ? name.trim() : 'Contributor ' + cleanEmail.split('@')[0],
    wallet: generatedWallet,
    passwordHash: hashPassword(password),
    active: true,
    createdAt: new Date(),
  };

  if (isConnected && db) {
    try {
      await db.collection('users').insertOne(userDoc);
    } catch (err) {
      if (err.code === 11000) {
        throw new Error('An account with this email already exists');
      }
      throw err;
    }
  }
  memoryUsers.set(cleanEmail, userDoc);
  logEvent('info', `Registered new compute contributor: ${cleanEmail}`);

  const token = crypto.randomBytes(32).toString('hex');
  return {
    role: 'user',
    userId: userDoc.userId,
    email: userDoc.email,
    name: userDoc.name,
    wallet: userDoc.wallet,
    token,
    loginAt: Date.now(),
  };
}

/**
 * Enterprise Secure Onboarding & Invitation Generation Flow
 */
async function createEnterpriseInvite({ companyName, email, contactPerson, serviceTier, allocatedCredits }) {
  if (!companyName || !email) {
    throw new Error('Company name and official email are required');
  }
  const cleanEmail = email.trim().toLowerCase();
  const existingComp = await getCompanyByEmail(cleanEmail);
  if (existingComp) {
    throw new Error('An enterprise account with this email already exists');
  }

  const inviteToken = crypto.randomBytes(24).toString('hex');
  const inviteDoc = {
    id: 'inv_' + crypto.randomBytes(6).toString('hex'),
    companyName: companyName.trim(),
    email: cleanEmail,
    contactPerson: contactPerson && contactPerson.trim() ? contactPerson.trim() : 'Enterprise Director',
    serviceTier: serviceTier || 'Enterprise Dedicated',
    allocatedCredits: Number(allocatedCredits) || 25000,
    inviteToken,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000 * 7, // 7 days validity
  };

  if (isConnected && db) {
    try {
      await db.collection('invites').insertOne(inviteDoc);
    } catch (err) {
      // fallback
    }
  }
  memoryInvites.set(inviteToken, inviteDoc);
  logEvent('info', `Generated secure onboarding invitation for ${inviteDoc.companyName} (${cleanEmail})`);

  return inviteDoc;
}

async function getEnterpriseInvite(token) {
  if (!token) return null;
  if (isConnected && db) {
    try {
      const doc = await db.collection('invites').findOne({ inviteToken: token });
      if (doc) return doc;
    } catch {
      // fallback
    }
  }
  return memoryInvites.get(token) || null;
}

async function acceptEnterpriseInvite({ token, password }) {
  const invite = await getEnterpriseInvite(token);
  if (!invite) {
    throw new Error('Invalid or expired invitation link');
  }
  if (invite.status === 'accepted') {
    throw new Error('This invitation has already been accepted');
  }
  if (Date.now() > invite.expiresAt) {
    throw new Error('This invitation has expired. Contact network administrator for renewal.');
  }

  const companyDoc = {
    companyId: 'comp_' + crypto.randomBytes(6).toString('hex'),
    email: invite.email,
    name: invite.companyName,
    role: 'company',
    passwordHash: hashPassword(password),
    contactPerson: invite.contactPerson,
    allocatedBudget: invite.allocatedCredits,
    serviceTier: invite.serviceTier,
    active: true,
    createdAt: new Date(),
  };

  if (isConnected && db) {
    try {
      await db.collection('companies').insertOne(companyDoc);
      await db.collection('invites').updateOne({ inviteToken: token }, { $set: { status: 'accepted', acceptedAt: Date.now() } });
    } catch (err) {
      // fallback
    }
  }

  invite.status = 'accepted';
  memoryCompanies.set(invite.email.toLowerCase(), companyDoc);
  memoryInvites.set(token, invite);

  // Record initial billing credit assignment
  await recordBillingTransaction({
    companyId: companyDoc.companyId,
    type: 'fiat_invoice',
    gateway: 'Enterprise Purchase Order (Net 30)',
    amountUsd: Math.round(companyDoc.allocatedBudget * 0.25),
    creditsAllocated: companyDoc.allocatedBudget,
    referenceHash: '0x' + crypto.randomBytes(16).toString('hex'),
  });

  logEvent('info', `Enterprise client onboarded: ${companyDoc.name} via secure invitation token`);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  return {
    role: 'company',
    companyId: companyDoc.companyId,
    email: companyDoc.email,
    name: companyDoc.name,
    allocatedBudget: companyDoc.allocatedBudget,
    serviceTier: companyDoc.serviceTier,
    token: sessionToken,
    loginAt: Date.now(),
  };
}

async function getAllInvites() {
  if (isConnected && db) {
    try {
      return await db.collection('invites').find({}).sort({ createdAt: -1 }).toArray();
    } catch {
      // fallback
    }
  }
  return [...memoryInvites.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Enterprise Tokenomics & Verified Credit Purchases
 */
async function recordBillingTransaction({ companyId, type, gateway, amountUsd, creditsAllocated, referenceHash }) {
  const tx = {
    id: 'tx_' + crypto.randomBytes(6).toString('hex'),
    companyId,
    type: type || 'fiat_invoice',
    gateway: gateway || 'Stripe Invoicing',
    amountUsd: Number(amountUsd) || 0,
    creditsAllocated: Number(creditsAllocated) || 0,
    status: 'settled',
    referenceHash: referenceHash || '0x' + crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  if (isConnected && db) {
    try {
      await db.collection('billing').insertOne(tx);
      // update company budget
      await db.collection('companies').updateOne(
        { companyId },
        { $inc: { allocatedBudget: tx.creditsAllocated } }
      );
    } catch {
      // fallback
    }
  }
  memoryBilling.set(tx.id, tx);

  // Update in memory company
  for (const comp of memoryCompanies.values()) {
    if (comp.companyId === companyId) {
      comp.allocatedBudget = (comp.allocatedBudget || 0) + tx.creditsAllocated;
      break;
    }
  }

  logEvent('info', `Billing ledger settled: ${tx.creditsAllocated} VAMP credits credited to ${companyId}`);
  return tx;
}

async function getBillingHistory(companyId) {
  if (isConnected && db) {
    try {
      const query = companyId ? { companyId } : {};
      return await db.collection('billing').find(query).sort({ timestamp: -1 }).toArray();
    } catch {
      // fallback
    }
  }
  const all = [...memoryBilling.values()];
  if (companyId) return all.filter(t => t.companyId === companyId).sort((a, b) => b.timestamp - a.timestamp);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Admin Lists All Enterprise & Contributor Accounts
 */
async function getAllAccounts() {
  let companies = [];
  let users = [];

  if (isConnected && db) {
    try {
      companies = await db.collection('companies').find({}, { projection: { passwordHash: 0 } }).toArray();
      users = await db.collection('users').find({}, { projection: { passwordHash: 0 } }).toArray();
    } catch {
      // fallback
    }
  }

  if (companies.length === 0) {
    companies = [...memoryCompanies.values()].map(({ passwordHash, ...rest }) => rest);
  }
  if (users.length === 0) {
    users = [...memoryUsers.values()].map(({ passwordHash, ...rest }) => rest);
  }

  return { companies, users };
}

/**
 * Batches and Tasks in MongoDB
 */
async function saveBatchAndTasks(batch, tasksList) {
  if (isConnected && db) {
    try {
      await db.collection('batches').updateOne(
        { id: batch.id },
        { $set: batch },
        { upsert: true }
      );
      if (Array.isArray(tasksList) && tasksList.length > 0) {
        const sanitized = tasksList.map(t => ({
          ...t,
          excluded: t.excluded ? Array.from(t.excluded) : [],
        }));
        await db.collection('tasks').insertMany(sanitized, { ordered: false });
      }
      logEvent('info', `Saved batch ${batch.id} (${tasksList.length} tasks) to MongoDB`);
    } catch (err) {
      logEvent('warn', `Failed to persist batch to MongoDB: ${err.message}`);
    }
  }
}

async function updateTaskCompletion(taskId, batchId, workerId, nonce, hash, reward) {
  if (isConnected && db) {
    try {
      await db.collection('tasks').updateOne(
        { id: taskId },
        {
          $set: {
            status: 'completed',
            completedBy: workerId,
            completedAt: Date.now(),
            nonce,
            hash,
          },
        }
      );
      if (batchId) {
        await db.collection('batches').updateOne(
          { id: batchId },
          { $inc: { completedTasks: 1 } }
        );
      }
    } catch (err) {
      // ignore
    }
  }
}

async function creditWalletDb(wallet, reward) {
  if (isConnected && db) {
    try {
      await db.collection('wallets').updateOne(
        { wallet },
        {
          $inc: { earnings: reward, tasks: 1 },
          $set: { lastActive: Date.now() },
        },
        { upsert: true }
      );
    } catch (err) {
      // ignore
    }
  }
}

async function recordClaimDb(wallet, claimRecord) {
  if (isConnected && db) {
    try {
      await db.collection('wallets').updateOne(
        { wallet },
        {
          $set: { earnings: 0 },
          $inc: { claimed: claimRecord.amount },
        }
      );
      await db.collection('claims').insertOne(claimRecord);
    } catch (err) {
      // ignore
    }
  }
}

async function loadStoredBatchesAndTasks() {
  if (isConnected && db) {
    try {
      const batchesList = await db.collection('batches').find({}).toArray();
      const tasksList = await db.collection('tasks').find({}).toArray();
      return { batches: batchesList, tasks: tasksList };
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  initDb,
  getUserByEmail,
  getCompanyByEmail,
  authenticateAny,
  registerUser,
  createEnterpriseInvite,
  getEnterpriseInvite,
  acceptEnterpriseInvite,
  getAllInvites,
  recordBillingTransaction,
  getBillingHistory,
  getAllAccounts,
  hashPassword,
  saveBatchAndTasks,
  updateTaskCompletion,
  creditWalletDb,
  recordClaimDb,
  loadStoredBatchesAndTasks,
};
