import { Cron } from "croner";
import { aiInBackground } from "../modules/ai/interfaces/background";
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
 *  - ai-weekly-digest : Mondays at 07:00 UTC — hands each site's weekly digest to the gateway to mail
 *  - ai-anomaly-check : hourly at :15 — each active site against its seasonal baseline; alerts opened and resolved
 *  - recording-analysis : every 10 min — frustration signals for recordings that have gone idle
 *  - ai-session-summaries : daily at 05:30 UTC — summaries for each site's most frustrated sessions
 *  - ai-recommendations : daily at 06:00 UTC — collects suggestions, expires stale ones, measures applied ones
 *  - stylesheet-archive : every minute — fetches and stores stylesheets recordings link to, plus a bounded backfill
 *  - screenshot-refresh : every 3 days at 03:00 UTC — re-captures stale heatmap page screenshots
 */
export function startScheduler(
  cfg: AppConfig,
  deps?: {
    heatmapScreenshots?: HeatmapScreenshotMaintenance;
    retention?: RetentionRunner;
    analyticsRollups?: AnalyticsRollups;
    /** Writes each site's daily dashboard insight. */
    aiInsights?: { runDaily(): Promise<unknown> };
    /** Hands each site's weekly digest to the gateway. `enabled` is false without one. */
    aiDigest?: { enabled: boolean; runWeekly(): Promise<unknown> };
    /** The hourly anomaly check. `enabled` is false when its reads were not wired. */
    aiAnomalies?: { enabled: boolean; runHourly(): Promise<unknown> };
    /** Collects recommendations and takes due impact readings. `enabled` is false when not wired. */
    aiRecommendations?: { enabled: boolean; runDaily(): Promise<unknown> };
    /** Analyses ended recordings for frustration signals, and pre-writes summaries for the worst. */
    recordingAnalysis?: { analyzePending(): Promise<unknown>; summarizeTop(): Promise<unknown>; summariesEnabled(): boolean };
    /** Archives the stylesheets recordings and heatmap snapshots link to. */
    stylesheetArchive?: { runOnce(): Promise<unknown> };
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

  // Daily dashboard insights — 05:00 UTC, after the day's rollups have settled. Only with
  // AI_BACKGROUND=true: by default each site's insight is made when its dashboard is first opened.
  const aiInsights = deps?.aiInsights;
  if (aiInsights && !aiInBackground()) {
    log.info({ msg: "scheduler_job_disabled", job: "ai-insights", reason: "made on demand (AI_BACKGROUND is not true)" });
  } else if (aiInsights && process.env.AI_INSIGHTS_ENABLED !== "false") {
    const insightsCron = process.env.AI_INSIGHTS_CRON ?? "0 5 * * *";
    const insightsJob = new Cron(
      insightsCron,
      { timezone: "UTC", name: "ai-insights", catch: true, protect: true },
      async () => {
        log.info({ msg: "scheduler_job_start", job: "ai-insights" });
        try {
          const stats = await traceJob("ai-insights", () => aiInsights.runDaily());
          log.info({ msg: "scheduler_job_done", job: "ai-insights", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "ai-insights", err: String(e) });
        }
      },
    );
    jobs.push(insightsJob);
    log.info({ msg: "scheduler_job_registered", job: "ai-insights", schedule: insightsCron });
  }

  // Weekly digest — Mondays 07:00 UTC, two hours after the daily insights, so each site's lines are
  // already written. Core only builds the notice; the gateway mails it, so without one there is no job.
  const aiDigest = deps?.aiDigest;
  if (process.env.AI_DIGEST_ENABLED === "false") {
    log.info({ msg: "scheduler_job_disabled", job: "ai-weekly-digest", reason: "AI_DIGEST_ENABLED=false" });
  } else if (!aiDigest?.enabled) {
    log.info({ msg: "scheduler_job_disabled", job: "ai-weekly-digest", reason: "no gateway notify url" });
  } else {
    const digestCron = process.env.AI_DIGEST_CRON ?? "0 7 * * 1";
    const digestJob = new Cron(
      digestCron,
      { timezone: "UTC", name: "ai-weekly-digest", catch: true, protect: true },
      async () => {
        log.info({ msg: "scheduler_job_start", job: "ai-weekly-digest" });
        try {
          const stats = await traceJob("ai-weekly-digest", () => aiDigest.runWeekly());
          log.info({ msg: "scheduler_job_done", job: "ai-weekly-digest", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "ai-weekly-digest", err: String(e) });
        }
      },
    );
    jobs.push(digestJob);
    log.info({ msg: "scheduler_job_registered", job: "ai-weekly-digest", schedule: digestCron });
  }

  // Anomaly check — hourly at :15, a quarter hour after the hour it judges closed, so late events
  // have landed. Detection needs no model and alerts show on the dashboard without a gateway (they
  // are only mailed with one), so it runs whenever it is wired. `protect`: a slow run is skipped
  // over, never stacked.
  const aiAnomalies = deps?.aiAnomalies;
  if (process.env.AI_ANOMALY_ENABLED === "false") {
    log.info({ msg: "scheduler_job_disabled", job: "ai-anomaly-check", reason: "AI_ANOMALY_ENABLED=false" });
  } else if (aiAnomalies?.enabled) {
    const anomalyCron = process.env.AI_ANOMALY_CRON ?? "15 * * * *";
    const anomalyJob = new Cron(
      anomalyCron,
      { timezone: "UTC", name: "ai-anomaly-check", catch: true, protect: true },
      async () => {
        try {
          const stats = await traceJob("ai-anomaly-check", () => aiAnomalies.runHourly());
          log.info({ msg: "scheduler_job_done", job: "ai-anomaly-check", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "ai-anomaly-check", err: String(e) });
        }
      },
    );
    jobs.push(anomalyJob);
    log.info({ msg: "scheduler_job_registered", job: "ai-anomaly-check", schedule: anomalyCron });
  }

  // Recommendations — 06:00 UTC, after the daily insights (05:00) and session summaries (05:30) it
  // collects from. Rule-based, so it runs without a model; a reading's sentence uses one if configured.
  const aiRecommendations = deps?.aiRecommendations;
  if (process.env.AI_RECOMMENDATIONS_ENABLED === "false") {
    log.info({ msg: "scheduler_job_disabled", job: "ai-recommendations", reason: "AI_RECOMMENDATIONS_ENABLED=false" });
  } else if (aiRecommendations?.enabled) {
    const recommendationsCron = process.env.AI_RECOMMENDATIONS_CRON ?? "0 6 * * *";
    const recommendationsJob = new Cron(
      recommendationsCron,
      { timezone: "UTC", name: "ai-recommendations", catch: true, protect: true },
      async () => {
        log.info({ msg: "scheduler_job_start", job: "ai-recommendations" });
        try {
          const stats = await traceJob("ai-recommendations", () => aiRecommendations.runDaily());
          log.info({ msg: "scheduler_job_done", job: "ai-recommendations", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "ai-recommendations", err: String(e) });
        }
      },
    );
    jobs.push(recommendationsJob);
    log.info({ msg: "scheduler_job_registered", job: "ai-recommendations", schedule: recommendationsCron });
  }

  // Recording analysis — every 10 min: frustration signals for sessions that have gone idle, a
  // bounded batch per tick (RECORDING_ANALYSIS_BATCH). Each recording is read once and the result
  // stored. Session summaries — 05:30 UTC: pre-written for each site's most frustrated sessions of
  // the last day; skipped without a model, and capped per site and per run (AI_SESSION_SUMMARY_*).
  const recordingAnalysis = deps?.recordingAnalysis;
  if (recordingAnalysis && process.env.RECORDING_ANALYSIS_ENABLED !== "false") {
    const analysisCron = process.env.RECORDING_ANALYSIS_CRON ?? "*/10 * * * *";
    const analysisJob = new Cron(
      analysisCron,
      { timezone: "UTC", name: "recording-analysis", catch: true, protect: true },
      async () => {
        try {
          const stats = await traceJob("recording-analysis", () => recordingAnalysis.analyzePending());
          log.info({ msg: "scheduler_job_done", job: "recording-analysis", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "recording-analysis", err: String(e) });
        }
      },
    );
    jobs.push(analysisJob);
    log.info({ msg: "scheduler_job_registered", job: "recording-analysis", schedule: analysisCron });

    if (!aiInBackground()) {
      // Summaries are written when a recording is opened.
      log.info({ msg: "scheduler_job_disabled", job: "ai-session-summaries", reason: "made on demand (AI_BACKGROUND is not true)" });
    } else if (process.env.AI_SESSION_SUMMARY_ENABLED === "false") {
      log.info({ msg: "scheduler_job_disabled", job: "ai-session-summaries", reason: "AI_SESSION_SUMMARY_ENABLED=false" });
    } else if (!recordingAnalysis.summariesEnabled()) {
      log.info({ msg: "scheduler_job_disabled", job: "ai-session-summaries", reason: "AI not configured" });
    } else {
      const summaryCron = process.env.AI_SESSION_SUMMARY_CRON ?? "30 5 * * *";
      const summaryJob = new Cron(
        summaryCron,
        { timezone: "UTC", name: "ai-session-summaries", catch: true, protect: true },
        async () => {
          log.info({ msg: "scheduler_job_start", job: "ai-session-summaries" });
          try {
            const stats = await traceJob("ai-session-summaries", () => recordingAnalysis.summarizeTop());
            log.info({ msg: "scheduler_job_done", job: "ai-session-summaries", stats });
          } catch (e) {
            log.error({ msg: "scheduler_job_failed", job: "ai-session-summaries", err: String(e) });
          }
        },
      );
      jobs.push(summaryJob);
      log.info({ msg: "scheduler_job_registered", job: "ai-session-summaries", schedule: summaryCron });
    }
  }

  // Stylesheet archive — every minute: fetches a bounded batch of pending stylesheets (SSRF-guarded,
  // capped, concurrency-limited) and scans a few pre-archive recordings for more. `protect`: a slow
  // run is skipped over, never stacked. Worker role only, like every job here.
  const stylesheetArchive = deps?.stylesheetArchive;
  if (process.env.STYLESHEET_ARCHIVE_ENABLED === "false") {
    log.info({ msg: "scheduler_job_disabled", job: "stylesheet-archive", reason: "STYLESHEET_ARCHIVE_ENABLED=false" });
  } else if (stylesheetArchive) {
    const archiveCron = process.env.STYLESHEET_ARCHIVE_CRON ?? "* * * * *";
    const archiveJob = new Cron(
      archiveCron,
      { timezone: "UTC", name: "stylesheet-archive", catch: true, protect: true },
      async () => {
        try {
          const stats = await traceJob("stylesheet-archive", () => stylesheetArchive.runOnce());
          log.debug({ msg: "scheduler_job_done", job: "stylesheet-archive", stats });
        } catch (e) {
          log.error({ msg: "scheduler_job_failed", job: "stylesheet-archive", err: String(e) });
        }
      },
    );
    jobs.push(archiveJob);
    log.info({ msg: "scheduler_job_registered", job: "stylesheet-archive", schedule: archiveCron });
  }

  // Heatmap screenshot refresh — every 3 days at 03:00 UTC. Last: it returns early when unwired.
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
