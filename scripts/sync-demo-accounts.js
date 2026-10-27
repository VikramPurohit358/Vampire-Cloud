const { MongoClient } = require('./master/node_modules/mongodb');
const crypto = require('crypto');

function hashPassword(password, jwtSecret = 'vampire-secret-cloud-key-2026') {
  return crypto.createHash('sha256').update(password + jwtSecret).digest('hex');
}

async function verifyAndSync() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vampire_cloud';
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db();

  // 1. Admin Demo Account
  await db.collection('users').updateOne(
    { email: 'admin@vampirecloud.network' },
    {
      $set: {
        userId: 'usr_admin',
        email: 'admin@vampirecloud.network',
        role: 'admin',
        name: 'Platform Administrator',
        passwordHash: hashPassword('admin123'),
        active: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 2. Enterprise Company Demo Account
  await db.collection('companies').updateOne(
    { email: 'company@apexquantum.ai' },
    {
      $set: {
        companyId: 'comp_apexdemo',
        email: 'company@apexquantum.ai',
        name: 'Apex Quantum AI',
        role: 'company',
        passwordHash: hashPassword('company123'),
        contactPerson: 'Dr. Jane Vance',
        allocatedBudget: 50000,
        serviceTier: 'Enterprise Dedicated',
        active: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Also support the original contact@apexquantum.ai with company123
  await db.collection('companies').updateOne(
    { email: 'contact@apexquantum.ai' },
    {
      $set: {
        passwordHash: hashPassword('company123'),
      },
    }
  );

  // 3. Contributor / User Demo Account
  await db.collection('users').updateOne(
    { email: 'user@vampirecloud.network' },
    {
      $set: {
        userId: 'usr_demo_worker',
        email: 'user@vampirecloud.network',
        role: 'user',
        name: 'Alex Contributor',
        wallet: '0x71C568a23dE11a5D448c267c8282f1E5868B4b03',
        passwordHash: hashPassword('user123'),
        active: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Also support miner@vampirecloud.network with user123
  await db.collection('users').updateOne(
    { email: 'miner@vampirecloud.network' },
    {
      $set: {
        passwordHash: hashPassword('user123'),
      },
    }
  );

  console.log('--- MongoDB Seeding Completed Successfully ---');
  const allUsers = await db.collection('users').find({}).toArray();
  const allComps = await db.collection('companies').find({}).toArray();
  console.log('Users in DB:');
  allUsers.forEach(u => console.log(` - ${u.email} (${u.role})`));
  console.log('Companies in DB:');
  allComps.forEach(c => console.log(` - ${c.email} (${c.name})`));
  await c.close();
}

verifyAndSync().catch(console.error);
