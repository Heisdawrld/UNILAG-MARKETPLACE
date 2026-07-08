/**
 * sync-turso-schema.mjs
 *
 * Reads prisma/schema.sql and executes every statement against Turso.
 * Idempotent: "already exists" / "duplicate column" errors are ignored.
 *
 * Can be called two ways:
 *   1. As a module:  import { syncTursoSchema } from './scripts/sync-turso-schema.mjs'
 *   2. Standalone:   node scripts/sync-turso-schema.mjs
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function syncTursoSchema() {
  const TURSO_URL = process.env.TURSO_DATABASE_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL || !TURSO_TOKEN) {
    console.log('[turso-sync] TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set — skipping');
    return;
  }

  // Resolve schema.sql relative to project root (scripts/ → ../)
  const schemaPath = resolve(__dirname, '..', 'prisma', 'schema.sql');
  let sql;
  try {
    sql = readFileSync(schemaPath, 'utf8');
  } catch {
    console.error(`[turso-sync] schema.sql not found at ${schemaPath}`);
    console.error('[turso-sync] Run: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql');
    return; // non-fatal — server can still start
  }

  // Split into individual statements (prisma migrate diff outputs semicolon-delimited SQL).
  // Strip leading line-comments (-- ...) from each statement so they're not mistaken as empty.
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .map(s => s.replace(/^--[^\n]*\n/gm, '').trim()) // drop leading -- comment lines
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`[turso-sync] Syncing ${statements.length} SQL statements to Turso (${TURSO_URL.substring(0, 30)}...)`);

  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 70);
    try {
      await client.execute(stmt);
      ok++;
    } catch (err) {
      const msg = err?.message || String(err);
      // Idempotent: ignore "already exists" / "duplicate column" / "no such table" (for ALTER)
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('no such column') ||
        msg.includes('no such table') ||
        msg.includes('UNIQUE constraint failed: sqlite_master')
      ) {
        skipped++;
      } else {
        console.error(`[turso-sync] FAILED: ${preview}`);
        console.error(`[turso-sync]   ${msg}`);
        failed++;
      }
    }
  }

  console.log(`[turso-sync] Done: ${ok} created, ${skipped} already existed, ${failed} failed`);

  if (failed > 0) {
    console.warn('[turso-sync] Some statements failed — app will continue but may have issues');
  }
}

// Run standalone if executed directly (not imported)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  syncTursoSchema().catch((err) => {
    console.error('[turso-sync] Fatal error:', err);
    process.exit(1);
  });
}
