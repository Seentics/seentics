import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

/** Shared client: Drizzle + raw tagged-template SQL */
export const sql = postgres(url, { max: 25 });
export const db = drizzle(sql, { schema });

/**
 * Dashboard analytics reads, on their own small pool.
 *
 * Benchmarked on realistic data, these were the stack's limit: uncached dashboard
 * queries grow with a site's traffic, and a handful of them at once saturated Postgres
 * while ingest — on the same pool — queued behind them, for every customer. A separate
 * pool is a bulkhead: at most `ANALYTICS_READ_POOL_MAX` run at once, whatever the
 * dashboard traffic, and ingest keeps its own connections.
 *
 * It also carries the settings those queries need and ingest does not:
 *
 * - `work_mem` sized for per-visitor hash aggregation. At the server default (16 MB) a
 *   90-day top-pages over 633k pageviews spilled to disk and took 6.6 s; at 64 MB,
 *   0.7 s. Only this pool gets it, and the pool's cap is what bounds the total —
 *   roughly max × work_mem × hash_mem_multiplier (2) × two hash nodes, ~1.2 GB at
 *   the defaults, inside Postgres's 2.5 GB.
 * - `statement_timeout`, so one pathological report cannot hold a connection (and its
 *   memory) indefinitely.
 */
export const analyticsReadSql = postgres(url, {
  max: Number(process.env.ANALYTICS_READ_POOL_MAX) || 6,
  connection: {
    work_mem: process.env.ANALYTICS_READ_WORK_MEM || "48MB",
    statement_timeout: Number(process.env.ANALYTICS_READ_STATEMENT_TIMEOUT_MS) || 30_000,
  },
});
export * from "./schema";
