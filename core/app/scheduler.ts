import { Cron } from "croner";
import type { AppConfig } from "../config";
import type { RetentionRunner } from "../platform/retention";
import type { HeatmapScreenshotMaintenance } from "../modules/heatmaps/interfaces";
import { log as baseLog } from "../platform/observability/logger";
import type { AnalyticsRollups } from "../modules/analytics/interfaces";
import { alertOps } from "../platform/observability/ops-alert";
import { traceJob } from "../platform/observability/observe";
import { checkTimescaleJobs } from "./services/maintenance/timescale-jobs";

const log = baseLog.child({ category: "scheduler" });

let jobs: Cron[] = [];

/**
 * All scheduled background jobs in one place.
 *
 * Jobs:
 *  - data-retention  : daily at 04:15 UTC — purges analytics, sessions, heatmap data per retention config
 *  - analytics-rollups : every 30 s — rebuilds stale website-days of the dashboard rollups
 *  - screenshot-refresh : every 3 days at 03:00 UTC — re-captures stale heatmap page screenshots
 */
export function startScheduler(
  cfg: AppConfig,
  deps?: {
    heatmapScreenshots?: HeatmapScreenshotMaintenance;
    retention?: RetentionRunner;
    analyticsRollups?: AnalyticsRollups;
  },
): void {
  if (jobs.length > 0) {
    log.warn({ msg: "scheduler_already_started" });
    return;
  }

  if (cfg.dataRetention.enabled) {
    const retentionJob = new Cron(
      cfg.dataRetention.cronExpression,
      { timezone: "UTC", name: "data-retention", catch: true },
      async () => {
        log.info({ msg: "scheduler_job_start", job: "data-retention" });
        try {
          const stats = await traceJob("data-retention", async () => deps?.retention?.runSafely(cfg));
          log.info({ msg: "scheduler_job_done", job: "data-retention", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "data-retention", err: String(e) });
        }
      },
    );
    jobs.push(retentionJob);
    log.info({ msg: "scheduler_job_registered", job: "data-retention", schedule: cfg.dataRetention.cronExpression });
  }

  // Analytics rollups — every 30 s, rebuild the website-days ingest has marked stale.
  // `protect` skips a tick while the previous run is still going, so a large backfill
  // never stacks runs on top of each other.
  const rollups = deps?.analyticsRollups;
  if (rollups && process.env.ANALYTICS_ROLLUPS_ENABLED !== "false") {
    const rollupSchedule = process.env.ANALYTICS_ROLLUP_CRON ?? "*/30 * * * * *";
    const rollupJob = new Cron(
      rollupSchedule,
      { timezone: "UTC", name: "analytics-rollups", catch: true, protect: true },
      async () => {
        try {
          await traceJob("analytics-rollups", () => rollups.buildStale());
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "analytics-rollups", err: String(e) });
          // The builder also prunes session rows; failing, dashboards go stale and the
          // pruning stops. The gateway sends each title at most once an hour.
          await alertOps("Analytics rollup builder is failing", { error: String(e) });
        }
      },
    );
    jobs.push(rollupJob);
    log.info({ msg: "scheduler_job_registered", job: "analytics-rollups", schedule: rollupSchedule });
  }

  // TimescaleDB job health — hourly: alerts when compression or retention of raw
  // analytics events failed or stopped running (services/maintenance/timescale-jobs.ts).
  const timescaleJob = new Cron(
    process.env.TIMESCALE_JOB_CHECK_CRON ?? "7 * * * *",
    { timezone: "UTC", name: "timescale-job-check", catch: true, protect: true },
    async () => {
      try {
        await traceJob("timescale-job-check", () => checkTimescaleJobs());
      } catch (e) {
        log.error({ msg: "scheduler_job_failed", job: "timescale-job-check", err: String(e) });
      }
    },
  );
  jobs.push(timescaleJob);
  log.info({ msg: "scheduler_job_registered", job: "timescale-job-check", schedule: "hourly" });

  // Heatmap screenshot refresh — every 3 days at 03:00 UTC
  const heatmapScreenshots = deps?.heatmapScreenshots;
  if (!heatmapScreenshots) {
    // Registering a job with nothing to call would be worse than skipping it: the
    // cron would fire every three days and do nothing, silently.
    log.warn({ msg: "scheduler_job_not_wired", job: "screenshot-refresh" });
    return;
  }

  const screenshotRefreshCron = process.env.HEATMAP_SCREENSHOT_REFRESH_CRON ?? "0 3 */3 * *";
  const screenshotJob = new Cron(
    screenshotRefreshCron,
    { timezone: "UTC", name: "screenshot-refresh", catch: true },
    async () => {
      log.info({ msg: "scheduler_job_start", job: "screenshot-refresh" });
      try {
        const result = await traceJob("screenshot-refresh", () => heatmapScreenshots.refreshStaleScreenshots(3));
        log.info({ msg: "scheduler_job_done", job: "screenshot-refresh", queued: result.queued });
      } catch (e) {
        log.error({ msg: "scheduler_job_failed", job: "screenshot-refresh", err: String(e) });
      }
    },
  );
  jobs.push(screenshotJob);
  log.info({ msg: "scheduler_job_registered", job: "screenshot-refresh", schedule: screenshotRefreshCron });
}

export function stopScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs = [];
  log.info({ msg: "scheduler_stopped" });
}
