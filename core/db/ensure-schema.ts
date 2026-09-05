import { join } from "path";
import postgres from "postgres";

/**
 * Code expects `analytics_events.website_id` (Drizzle `websiteId`). Older DBs still have `website_site_id`.
 * Runs on every core startup (independent of SKIP_DB_PUSH / drizzle push).
 */
export async function applyAnalyticsEventsWebsiteIdMigration(): Promise<void> {
  if (process.env.SKIP_ANALYTICS_WEBSITE_ID_MIGRATION === "true" || process.env.SKIP_ANALYTICS_WEBSITE_ID_MIGRATION === "1") {
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const cols = await client<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'analytics_events'
    `;
    const names = new Set(cols.map((c) => c.column_name));
    if (names.has("website_site_id") && !names.has("website_id")) {
           await client`ALTER TABLE analytics_events RENAME COLUMN website_site_id TO website_id`;
      console.log("[schema] analytics_events: renamed website_site_id → website_id");
    } else if (!names.has("website_id") && names.size > 0) {
      console.warn(
        "[schema] analytics_events has no website_id column (found:",
        [...names].join(", "),
        ") — fix DB manually or run drizzle-kit push",
      );
    }
  } finally {
    await client.end({ timeout: 3 });
  }
}

/**
 * Tables that must exist for the process to run.
 *
 * Checking only `websites` was a real gap: push is skipped whenever that one table is
 * present, so a table added to `schema.ts` afterwards was never created on any database
 * that already existed. The two ingest tables both hit it — the process started, then
 * logged a missing relation on every poll.
 *
 * Add new tables here as they are introduced. A `db/sql/` migration is still the
 * preferred way to create one; this is the backstop that catches the ones that forget.
 */
const REQUIRED_TABLES = [
  "websites",
  "analytics_events",
  "ingest_batches",
  "ingest_applied_batches",
] as const;

/** Names from `REQUIRED_TABLES` that the database does not have. */
async function missingCoreTables(): Promise<string[]> {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const rows = await client<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${[...REQUIRED_TABLES]}::text[])
    `;
    const present = new Set(rows.map((r) => r.table_name));
    return REQUIRED_TABLES.filter((t) => !present.has(t));
  } catch {
    // Unreachable database: treat as "everything missing" so the caller pushes and
    // surfaces the real connection error rather than starting against nothing.
    return [...REQUIRED_TABLES];
  } finally {
    await client.end({ timeout: 3 });
  }
}

/**
 * Ensures the `ai_queries` table exists (migration 005).
 * Safe to call on every startup — uses CREATE TABLE IF NOT EXISTS.
 */
export async function applyAiQueriesMigration(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const rows = await client<{ ok: number }[]>`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ai_queries' LIMIT 1
    `;
    if (rows.length > 0) return; // already exists

    await client`
      CREATE TABLE IF NOT EXISTS ai_queries (
        id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            UUID          NOT NULL,
        website_id         TEXT          NOT NULL,
        prompt             TEXT          NOT NULL,
        system_context     TEXT,
        generated_sql      TEXT,
        viz_type           VARCHAR(32),
        title              TEXT,
        insight            TEXT,
        x_key              TEXT,
        y_key              TEXT,
        columns            JSONB,
        row_count          INTEGER,
        model              VARCHAR(64)   NOT NULL DEFAULT 'gpt-4o-mini',
        input_tokens       INTEGER,
        output_tokens      INTEGER,
        estimated_cost_usd REAL,
        status             VARCHAR(32)   NOT NULL DEFAULT 'pending',
        error_message      TEXT,
        execution_time_ms  INTEGER,
        created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS ix_ai_queries_user_id      ON ai_queries (user_id)`;
    await client`CREATE INDEX IF NOT EXISTS ix_ai_queries_website_id   ON ai_queries (website_id)`;
    await client`CREATE INDEX IF NOT EXISTS ix_ai_queries_user_created ON ai_queries (user_id, created_at)`;
    console.log("[schema] ai_queries: table created (migration 005)");
  } finally {
    await client.end({ timeout: 3 });
  }
}

/**
 * Ensures monthly partitions exist for analytics_events (current month + 3 ahead).
 * Calls the ensure_analytics_partitions() SQL function installed by migration 007.
 * Safe to call on every startup — the function is a no-op for partitions that exist.
 */
export async function ensureAnalyticsPartitions(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    // Quietly skip if the function hasn't been installed yet (pre-migration DBs).
    await client`SELECT ensure_analytics_partitions(3)`;
  } catch {
    // Function doesn't exist (migration 007 not yet applied) — not an error.
  } finally {
    await client.end({ timeout: 3 });
  }
}

/**
 * Ensures Drizzle tables exist (`drizzle-kit push --force`) on empty or broken DBs.
 * Skips when `websites` already exists (fast path for `bun --watch` restarts), unless `FORCE_DB_PUSH=1`.
 *
 * - Non-production: runs when schema looks missing.
 * - Production: only when `AUTO_DB_PUSH=1` (prefer explicit migrations for prod).
 * - `SKIP_DB_PUSH=1` disables entirely.
 */
export async function ensureCoreSchema(): Promise<void> {
  if (process.env.SKIP_DB_PUSH === "true" || process.env.SKIP_DB_PUSH === "1") return;

  const envName = (process.env.ENVIRONMENT ?? "").toLowerCase();
  if (envName === "production") {
    if (process.env.AUTO_DB_PUSH !== "true" && process.env.AUTO_DB_PUSH !== "1") return;
  }

  const force = process.env.FORCE_DB_PUSH === "true" || process.env.FORCE_DB_PUSH === "1";
  if (!force) {
    const missing = await missingCoreTables();
    if (missing.length === 0) return;
    console.log(`[schema] missing tables, running push: ${missing.join(", ")}`);
  }

  const coreRoot = join(import.meta.dir, "..");
  const r = Bun.spawnSync(["bun", "run", "db:push:force"], {
    cwd: coreRoot,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (r.exitCode !== 0) {
    throw new Error(`drizzle-kit push failed (exit ${r.exitCode ?? "unknown"})`);
  }
}
