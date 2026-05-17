import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { ensureCoreSchema, ensureAnalyticsPartitions } from './ensure-schema';

/**
 * Run all *.sql files in `dir` in alphabetical order.
 * All files must be idempotent (IF NOT EXISTS / ON CONFLICT / DO blocks).
 * Silently skips if the directory does not exist.
 */
async function runSqlDir(sql: postgres.Sql, dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of files) {
    const content = readFileSync(join(dir, filename), 'utf-8');
    await sql.unsafe(content);
  }
}

/**
 * Run all migrations needed to bring the shared DB fully up to date.
 * Called from seentics/core/index.ts on every startup.
 *
 * Order:
 *   1. Drizzle push — creates/updates core analytics tables (websites, analytics_events, …).
 *   2. Core SQL migrations — db/sql/001…007 (indexes, renames, partitions, ai_queries, …).
 *      All files are idempotent: DO blocks / IF NOT EXISTS / ON CONFLICT DO NOTHING.
 *   3. Gateway billing SQL migrations — gateway/db/sql/001…006.
 *      Runs when the monorepo gateway directory is accessible (dev / bare-metal).
 *      Silently skipped in production Docker — gateway's own container handles them.
 *   4. Partition guard — ensure_analytics_partitions(3) is a no-op for existing partitions.
 */
export async function runCoreMigrations(databaseUrl: string): Promise<void> {
  // 1. Drizzle push (creates analytics tables on empty / broken DBs)
  await ensureCoreSchema();

  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
  try {
    // 2. Core SQL migrations
    await runSqlDir(sql, join(import.meta.dir, 'sql'));

    // 3. Gateway billing SQL migrations (monorepo dev / bare-metal only)
    await runSqlDir(sql, join(import.meta.dir, '..', '..', '..', '..', 'gateway', 'db', 'sql'));
  } finally {
    await sql.end({ timeout: 5 });
  }

  // 4. Ensure monthly analytics_events partitions (no-op if already present)
  await ensureAnalyticsPartitions();
}
