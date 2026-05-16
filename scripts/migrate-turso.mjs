// Migration script — run with: npx tsx scripts/migrate-turso.mjs
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://unilag-marketplace-xgvantage.aws-us-west-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzg5MDk2NzQsImlkIjoiMDE5ZTJmMjAtY2UwMS03ZDUwLWI1YjMtNDQzYzE5MjIxZWY3IiwicmlkIjoiNTNhZjdiODUtODIyNy00NmQ1LThiYTQtNmJkMzViNmRmNWE1In0.0WdmVzlEMvqAV6c-l-ZA5kunbF2UEI8ZtyYWXcpyBMxolB8E3KbJL8nXRpBl7mVuCxd7Nu-cdzk1GEA14PUHBw',
});

const migrations = [
  // Add runner fields to User table
  `ALTER TABLE User ADD COLUMN isRunner INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE User ADD COLUMN runnerRating REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE User ADD COLUMN tasksCompleted INTEGER NOT NULL DEFAULT 0`,

  // Task table
  `CREATE TABLE IF NOT EXISTS Task (
    id TEXT NOT NULL PRIMARY KEY,
    creatorId TEXT NOT NULL,
    assignedRunnerId TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward REAL NOT NULL,
    category TEXT NOT NULL,
    location TEXT,
    pickupLocation TEXT,
    urgency TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    deadline DATETIME,
    images TEXT NOT NULL DEFAULT '[]',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL,
    CONSTRAINT Task_creatorId_fkey FOREIGN KEY (creatorId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT Task_assignedRunnerId_fkey FOREIGN KEY (assignedRunnerId) REFERENCES User (id) ON DELETE SET NULL ON UPDATE CASCADE
  )`,

  // Task indexes
  `CREATE INDEX IF NOT EXISTS Task_status_idx ON Task(status)`,
  `CREATE INDEX IF NOT EXISTS Task_creatorId_idx ON Task(creatorId)`,
  `CREATE INDEX IF NOT EXISTS Task_category_idx ON Task(category)`,

  // TaskApplication table
  `CREATE TABLE IF NOT EXISTS TaskApplication (
    id TEXT NOT NULL PRIMARY KEY,
    taskId TEXT NOT NULL,
    runnerId TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT TaskApplication_taskId_fkey FOREIGN KEY (taskId) REFERENCES Task (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT TaskApplication_runnerId_fkey FOREIGN KEY (runnerId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  // TaskApplication indexes and unique constraint
  `CREATE UNIQUE INDEX IF NOT EXISTS TaskApplication_taskId_runnerId_key ON TaskApplication(taskId, runnerId)`,
  `CREATE INDEX IF NOT EXISTS TaskApplication_taskId_idx ON TaskApplication(taskId)`,
  `CREATE INDEX IF NOT EXISTS TaskApplication_runnerId_idx ON TaskApplication(runnerId)`,
];

console.log('🚀 Running migrations on Turso...\n');

for (const sql of migrations) {
  const preview = sql.trim().split('\n')[0].slice(0, 60);
  try {
    await client.execute(sql);
    console.log(`✅ ${preview}`);
  } catch (err) {
    const msg = err?.message || String(err);
    // Ignore "already exists" and "duplicate column" errors — idempotent
    if (msg.includes('already exists') || msg.includes('duplicate column') || msg.includes('no such column')) {
      console.log(`⏭️  Already done: ${preview}`);
    } else {
      console.error(`❌ FAILED: ${preview}`);
      console.error(`   ${msg}`);
    }
  }
}

console.log('\n✨ Migration complete!');
