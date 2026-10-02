import { sql } from "../../../db";

/**
 * How long raw analytics events stay, and what that means for the features built on them.
 *
 * With TimescaleDB (db/sql/037–038) raw events are kept RAW_EVENT_DAYS and then dropped
 * by a retention policy. Everything that can be summarised per day reads the rollups and
 * covers any range — dashboard, goals, custom events and their properties, revenue
 * (orders rollup, 039). What cannot — funnels (in the funnels module) and raw exports —
 * is held to RAW_EVENT_DAYS (`clampRawDays`), and is exact within it. Revenue without
 * the rollups falls back to raw events and is held the same way. Must match the
 * retention policy in 038.
 */
export const RAW_EVENT_DAYS = 31;

/** A requested range in days, held to what raw events cover. */
export function clampRawDays(days: number): number {
  if (!Number.isFinite(days) || days < 1) return 1;
  return Math.min(Math.floor(days), RAW_EVENT_DAYS);
}

/**
 * The first UTC day whose raw events are certainly all still stored, or null when raw
 * events are not dropped by age (a plain Postgres, no TimescaleDB). The day at the edge
 * is left out too: the retention policy may be dropping it while a caller reads.
 */
export async function rawEventsFrom(): Promise<string | null> {
  const [row] = await sql<{ from_day: string | null }[]>`
    SELECT CASE WHEN to_regclass('timescaledb_information.jobs') IS NULL THEN NULL ELSE (
      SELECT ((now() - (config->>'drop_after')::interval)::date + 1)::text
      FROM timescaledb_information.jobs
      WHERE proc_name = 'policy_retention' AND hypertable_name = 'analytics_events'
      LIMIT 1
    ) END AS from_day
  `;
  return row?.from_day ?? null;
}
