import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { ensureCoreSchema, ensureAnalyticsPartitions } from './ensure-schema';

/**
 * Run all core analytics SQL migrations on every startup.
 * All files in db/sql/ are idempotent (IF NOT EXISTS / ON CONFLICT / DO blocks).
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
    const dir = join(import.meta.dir, 'sql');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const filename of files) {
      const content = readFileSync(join(dir, filename), 'utf-8');
      if (content.includes('CONCURRENTLY')) {
        // CONCURRENTLY cannot run inside a transaction block — execute each statement separately.
        // Strip full-line `--` comments FIRST: a `;` inside a comment would otherwise split a
        // statement mid-comment, leaving a fragment that no longer starts with `--` and gets
        // executed as SQL (→ syntax error).
        const withoutComments = content
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n');
        const statements = withoutComments
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const stmt of statements) {
          await sql.unsafe(stmt);
        }
      } else {
        await sql.unsafe(content);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  // 3. Ensure monthly analytics_events partitions (no-op if already present)
  await ensureAnalyticsPartitions();
}
