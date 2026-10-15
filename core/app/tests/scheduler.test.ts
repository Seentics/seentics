import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { scheduledJobs } from "croner";
import type { AppConfig } from "../../config";

// The one job that reaches the database directly; stubbed so the wiring can be checked without one.
const checkTimescaleJobs = mock(async () => [] as string[]);
mock.module("../services/maintenance/timescale-jobs", () => ({ checkTimescaleJobs: checkTimescaleJobs }));

const { startScheduler, stopScheduler } = await import("../scheduler");

const JOB_NAMES = [
  "data-retention", "analytics-rollups", "timescale-job-check", "ai-insights", "ai-weekly-digest",
  "ai-anomaly-check", "ai-recommendations", "recording-analysis", "ai-session-summaries",
  "stylesheet-archive", "screenshot-refresh",
];

const ENV_KEYS = [
  "AI_BACKGROUND", "AI_DIGEST_ENABLED", "AI_ANOMALY_ENABLED", "AI_RECOMMENDATIONS_ENABLED", "AI_INSIGHTS_ENABLED",
  "ANALYTICS_ROLLUPS_ENABLED", "STYLESHEET_ARCHIVE_ENABLED", "RECORDING_ANALYSIS_ENABLED", "AI_SESSION_SUMMARY_ENABLED",
  "ANALYTICS_ROLLUP_CRON", "AI_ANOMALY_CRON",
];
let saved: Record<string, string | undefined> = {};

const cfg = (enabled = true) =>
  ({ dataRetention: { enabled, cronExpression: "15 4 * * *" } }) as unknown as AppConfig;

function fakes() {
  return {
    retention: { runSafely: mock(async () => ({ websitesProcessed: 0 })) },
    analyticsRollups: { buildStale: mock(async () => undefined) } as never as { buildStale: ReturnType<typeof mock> },
    aiInsights: { runDaily: mock(async () => null) },
    aiDigest: { enabled: true, runWeekly: mock(async () => null) },
    aiAnomalies: { enabled: true, runHourly: mock(async () => null) },
    aiRecommendations: { enabled: true, runDaily: mock(async () => null) },
    recordingAnalysis: {
      analyzePending: mock(async () => null),
      summarizeTop: mock(async () => null),
      summariesEnabled: () => true,
    },
    stylesheetArchive: { runOnce: mock(async () => null) },
    heatmapScreenshots: { refreshStaleScreenshots: mock(async () => ({ queued: 0 })) },
  };
}

const ours = () => scheduledJobs.filter((j) => JOB_NAMES.includes(j.name ?? ""));
const names = () => ours().map((j) => j.name ?? "").sort();
const job = (name: string) => {
  const found = ours().find((j) => j.name === name);
  if (!found) throw new Error(`no job ${name}`);
  return found;
};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  checkTimescaleJobs.mockClear();
});

afterEach(() => {
  stopScheduler();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("the scheduler's jobs", () => {
  it("registers every wired job on its default schedule; model-only jobs wait for AI_BACKGROUND", async () => {
    startScheduler(cfg(), fakes() as never);

    expect(names()).toEqual([
      "ai-anomaly-check", "ai-recommendations", "ai-weekly-digest", "analytics-rollups", "data-retention",
      "recording-analysis", "screenshot-refresh", "stylesheet-archive", "timescale-job-check",
    ]);
    expect(job("data-retention").getPattern()).toBe("15 4 * * *");
    expect(job("analytics-rollups").getPattern()).toBe("*/30 * * * * *");
    expect(job("ai-anomaly-check").getPattern()).toBe("15 * * * *");
    expect(job("ai-recommendations").getPattern()).toBe("0 6 * * *");
    expect(job("ai-weekly-digest").getPattern()).toBe("0 7 * * 1");
    expect(job("screenshot-refresh").getPattern()).toBe("0 3 */3 * *");
    expect(job("stylesheet-archive").getPattern()).toBe("* * * * *");
    expect(job("timescale-job-check").getPattern()).toBe("7 * * * *");
  });

  it("runs each job's own work when it fires", async () => {
    const deps = fakes();
    const config = cfg();
    startScheduler(config, deps as never);

    for (const name of names()) await job(name).trigger();

    expect(deps.retention.runSafely).toHaveBeenCalledWith(config);
    expect(deps.analyticsRollups.buildStale).toHaveBeenCalledTimes(1);
    expect(deps.aiDigest.runWeekly).toHaveBeenCalledTimes(1);
    expect(deps.aiAnomalies.runHourly).toHaveBeenCalledTimes(1);
    expect(deps.aiRecommendations.runDaily).toHaveBeenCalledTimes(1);
    expect(deps.recordingAnalysis.analyzePending).toHaveBeenCalledTimes(1);
    expect(deps.stylesheetArchive.runOnce).toHaveBeenCalledTimes(1);
    expect(deps.heatmapScreenshots.refreshStaleScreenshots).toHaveBeenCalledWith(3);
    expect(checkTimescaleJobs).toHaveBeenCalledTimes(1);
    // Not registered without AI_BACKGROUND, so never called.
    expect(deps.aiInsights.runDaily).not.toHaveBeenCalled();
    expect(deps.recordingAnalysis.summarizeTop).not.toHaveBeenCalled();
  });

  it("adds the daily insights and session summaries with AI_BACKGROUND=true", async () => {
    process.env.AI_BACKGROUND = "true";
    const deps = fakes();
    startScheduler(cfg(), deps as never);

    expect(names()).toContain("ai-insights");
    expect(names()).toContain("ai-session-summaries");
    await job("ai-insights").trigger();
    await job("ai-session-summaries").trigger();
    expect(deps.aiInsights.runDaily).toHaveBeenCalledTimes(1);
    expect(deps.recordingAnalysis.summarizeTop).toHaveBeenCalledTimes(1);
  });

  it("skips session summaries when no model is configured, even in the background", () => {
    process.env.AI_BACKGROUND = "true";
    const deps = fakes();
    deps.recordingAnalysis.summariesEnabled = () => false;
    startScheduler(cfg(), deps as never);
    expect(names()).not.toContain("ai-session-summaries");
  });

  it("leaves out jobs that are switched off or not wired", () => {
    process.env.AI_ANOMALY_ENABLED = "false";
    process.env.AI_RECOMMENDATIONS_ENABLED = "false";
    process.env.ANALYTICS_ROLLUPS_ENABLED = "false";
    process.env.STYLESHEET_ARCHIVE_ENABLED = "false";
    const deps = fakes();
    deps.aiDigest.enabled = false; // no gateway to mail it
    const { heatmapScreenshots: _unwired, ...rest } = deps;

    startScheduler(cfg(false), rest as never);

    // Only what cannot be switched off remains.
    expect(names()).toEqual(["recording-analysis", "timescale-job-check"]);
  });

  it("does not register anything twice when started again", () => {
    startScheduler(cfg(), fakes() as never);
    const before = ours().length;
    startScheduler(cfg(), fakes() as never);
    expect(ours().length).toBe(before);
  });

  it("swallows a failing job, so one bad run does not stop the schedule", async () => {
    const deps = fakes();
    deps.retention.runSafely = mock(async () => { throw new Error("db down"); });
    deps.aiAnomalies.runHourly = mock(async () => { throw new Error("boom"); });
    startScheduler(cfg(), deps as never);

    await job("data-retention").trigger();
    await job("ai-anomaly-check").trigger();

    expect(deps.retention.runSafely).toHaveBeenCalledTimes(1);
    expect(job("data-retention").isStopped()).toBe(false);
    expect(job("ai-anomaly-check").isStopped()).toBe(false);
  });

  it("honours a schedule from the environment", () => {
    process.env.AI_ANOMALY_CRON = "45 * * * *";
    startScheduler(cfg(), fakes() as never);
    expect(job("ai-anomaly-check").getPattern()).toBe("45 * * * *");
  });

  it("stops and forgets every job", () => {
    startScheduler(cfg(), fakes() as never);
    const started = ours();
    expect(started.length).toBeGreaterThan(0);
    stopScheduler();
    expect(ours()).toHaveLength(0);
    expect(started.every((j) => j.isStopped())).toBe(true);
    // And a fresh start registers again.
    startScheduler(cfg(), fakes() as never);
    expect(ours().length).toBe(started.length);
  });
});
