import { Cron } from "croner";
import type { AppConfig } from "../config";
import type { RetentionService } from "./retention";
import type { HeatmapScreenshotMaintenance } from "../modules/heatmaps/interfaces";
import { log as baseLog } from "./lib/logger";

const log = baseLog.child({ category: "scheduler" });

let jobs: Cron[] = [];

/**
 * All scheduled background jobs in one place.
 *
 * Jobs:
 *  - data-retention  : daily at 04:15 UTC — purges analytics, sessions, heatmap data per retention config
 *  - screenshot-refresh : every 3 days at 03:00 UTC — re-captures stale heatmap page screenshots
 */
export function startScheduler(
  cfg: AppConfig,
  deps?: {
    heatmapScreenshots?: HeatmapScreenshotMaintenance;
    retention?: RetentionService;
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
          const stats = await deps?.retention?.runSafely(cfg);
          log.info({ msg: "scheduler_job_done", job: "data-retention", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "data-retention", err: String(e) });
        }
      },
    );
    jobs.push(retentionJob);
    log.info({ msg: "scheduler_job_registered", job: "data-retention", schedule: cfg.dataRetention.cronExpression });
  }

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
        const result = await heatmapScreenshots.refreshStaleScreenshots(3);
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
