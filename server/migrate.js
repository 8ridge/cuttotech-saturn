// Auto-migration runner
// Runs on server startup to ensure schema is up-to-date.
// Tracks applied migrations in `_migrations` table for idempotency.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function isApplied(name) {
  const r = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [name]);
  return r.rowCount > 0;
}

async function markApplied(name) {
  await pool.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
}

async function runSqlFile(filePath, name) {
  if (await isApplied(name)) {
    console.log(`⏭️  Migration already applied: ${name}`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf-8');
  console.log(`▶️  Running migration: ${name}`);
  try {
    await pool.query(sql);
    await markApplied(name);
    console.log(`✅ Migration applied: ${name}`);
  } catch (err) {
    // Some schema files use idempotent DDL (CREATE TABLE IF NOT EXISTS) so
    // re-running is safe. We swallow "already exists" errors and mark applied.
    const msg = err?.message || '';
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      err?.code === '42P07' || // duplicate_table
      err?.code === '42710'    // duplicate_object
    ) {
      console.log(`ℹ️  Migration ${name}: objects already exist — marking as applied`);
      await markApplied(name);
      return;
    }
    throw err;
  }
}

export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  await ensureMigrationsTable();

  // Order matters: base schema first, then auth, then migrations alphabetically
  const baseFiles = [
    { file: 'schema.sql', name: '00_schema' },
    { file: 'schema_auth.sql', name: '01_schema_auth' },
  ];

  for (const { file, name } of baseFiles) {
    const fp = path.join(__dirname, file);
    if (fs.existsSync(fp)) {
      await runSqlFile(fp, name);
    } else {
      console.warn(`⚠️  Schema file missing: ${file}`);
    }
  }

  // Migrations folder (alphabetical order, skip .md / non-migration files)
  const migrationsDir = path.join(__dirname, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('queries')) // skip read-only query files
      .sort();
    for (const f of files) {
      await runSqlFile(path.join(migrationsDir, f), `02_${f}`);
    }
  }

  console.log('✅ All migrations completed');
}

// CLI usage: `node server/migrate.js` (manual run)
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
