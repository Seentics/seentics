import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { ensureCoreSchema, ensureAnalyticsPartitions } from './ensure-schema';

/**
 * Run each core analytics migration once, tracked by a checksum ledger.
 *
 * Order:
 *   1. Drizzle push — creates/updates core analytics tables (websites, analytics_events, …).
 *   2. Core SQL migrations — db/sql/001…007 (indexes, renames, partitions, ai_queries, …).
 *   3. Partition guard — ensure_analytics_partitions(3) is a no-op for existing partitions.
 *
 * Gateway billing migrations (plans, subscriptions, …) are the gateway's responsibility
 * and run in gateway/migrate.ts on gateway startup.
 */
export async function runCoreMigrations(databaseUrl: string): Promise<void> {
  // 1. Drizzle push (creates analytics tables on empty / broken DBs)
  await ensureCoreSchema();

  // 2. Core SQL migrations
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15, onnotice: () => {} });
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS core_schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.unsafe('SELECT pg_advisory_lock(824631002)');
    const dir = join(import.meta.dir, 'sql');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const filename of files) {
      let content = readFileSync(join(dir, filename), 'utf-8');
      // `analytics_events` is a partitioned table. Postgres forbids CREATE INDEX
      // CONCURRENTLY on a partitioned parent, so strip the keyword: a plain
      // CREATE INDEX IF NOT EXISTS on the parent cascades to every partition.
      // (Postgres parses `--` comments and multi-statement bodies natively, so no
      // manual comment/semicolon splitting is needed.)
      if (content.includes('CONCURRENTLY')) {
        content = content.replace(/\bCONCURRENTLY\b/g, '');
      }
      const checksum = createHash('sha256').update(content).digest('hex');
      const applied = await sql<{ checksum: string }[]>`
        SELECT checksum FROM core_schema_migrations WHERE filename = ${filename}
      `;
      if (applied[0]) {
        if (applied[0].checksum !== checksum) throw new Error(`Migration ${filename} was modified after being applied`);
        continue;
      }
      // A migration may declare `-- requires-extension: <name>` for an optional feature
      // (the analytics rollups need `hll`). On a server without that extension it is
      // skipped — not recorded, so it applies on the first start after the extension is
      // installed — rather than failing startup for every self-hosted install on a plain
      // Postgres image.
      const required = content.match(/^--\s*requires-extension:\s*(\S+)/m)?.[1];
      if (required) {
        const [available] = await sql<{ ok: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = ${required}) AS ok
        `;
        if (!available?.ok) {
          console.warn(`[migrate] skipping ${filename}: Postgres extension "${required}" is not installed`);
          continue;
        }
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO core_schema_migrations (filename, checksum)
          VALUES (${filename}, ${checksum})
        `;
      });
    }
  } finally {
    try { await sql.unsafe('SELECT pg_advisory_unlock(824631002)'); } catch { /* connection may not be established */ }
    await sql.end({ timeout: 5 });
  }

  // 3. Ensure monthly analytics_events partitions (no-op if already present)
  await ensureAnalyticsPartitions();
}
