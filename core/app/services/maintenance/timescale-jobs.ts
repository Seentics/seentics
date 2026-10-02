import { sql } from "../../../db";
import { alertOps } from "../../../platform/observability/ops-alert";

/**
 * TimescaleDB's own jobs — compressing raw analytics events after 48 hours, dropping
 * them at 31 days (db/sql/037–038) — run inside Postgres, where nothing in the app
 * sees them fail. This hourly check alerts when one has failed its last run or not
 * succeeded within two of its intervals: stopped, e.g. for want of a background
 * worker (Postgres logged "background worker limit of 4 exceeded" before
 * timescaledb.max_background_workers was raised). A stuck retention job means raw
 * events outliving the 31 days promised; a stuck compression job, a disk filling up.
 *
 * Returns the unhealthy jobs (for tests and the log). Nothing to check on a Postgres
 * without TimescaleDB.
 */
export async function checkTimescaleJobs(): Promise<string[]> {
  const [present] = await sql<{ ok: boolean }[]>`
    SELECT to_regclass('timescaledb_information.job_stats') IS NOT NULL AS ok
  `;
  if (!present?.ok) return [];

  const rows = await sql<{
    job_id: number; proc_name: string; hypertable_name: string | null;
    last_run_status: string | null; last_successful_finish: Date | null; total_failures: number;
  }[]>`
    SELECT j.job_id, j.proc_name, j.hypertable_name, s.last_run_status, s.last_successful_finish,
           s.total_failures::int AS total_failures
    FROM timescaledb_information.jobs j
    JOIN timescaledb_information.job_stats s USING (job_id)
    WHERE j.scheduled
      AND j.proc_name IN ('policy_compression', 'policy_retention')
      AND (
        s.last_run_status = 'Failed'
        OR coalesce(s.last_successful_finish, j.initial_start, now()) < now() - 2 * j.schedule_interval - interval '1 hour'
      )
  `;
  const unhealthy = rows.map((r) =>
    `${r.proc_name} on ${r.hypertable_name ?? "?"} (job ${r.job_id}): ` +
    (r.last_run_status === "Failed" ? "last run failed" : "no recent success") +
    `, last success ${r.last_successful_finish?.toISOString() ?? "never"}, ${r.total_failures} failure(s)`,
  );
  if (unhealthy.length) {
    await alertOps("Analytics compression or retention job is not running", {
      jobs: unhealthy.join("\n"),
      check: "SELECT * FROM timescaledb_information.job_stats; and the Postgres log",
    });
  }
  return unhealthy;
}
