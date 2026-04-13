import { join } from "path";
import postgres from "postgres";

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
