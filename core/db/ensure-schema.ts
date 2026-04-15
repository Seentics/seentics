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

async function isAnalyticsSchemaMissing(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const rows = await client<{ ok: number }[]>`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'websites' LIMIT 1
    `;
    return rows.length === 0;
  } catch {
    return true;
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
  if (!force && !(await isAnalyticsSchemaMissing())) return;

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
