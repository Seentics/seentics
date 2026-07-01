import { Hono } from "hono";
import { env } from "./config";
import { runCoreMigrations } from "./db/migrate";
import { flushIngestQueuesNow, startIngestQueueFlusher, stopIngestQueueFlusher } from "./services/ingest.service";
import { initMaxMindGeo } from "./lib/maxmind-geo";
import { configureLogger, log } from "./lib/logger";
import { getHeatmapEngine } from "./lib/heatmap-engine";
import { getReplayEngine } from "./lib/replay-engine";
import { configureTrackerOriginCache } from "./lib/origin";
import { startScheduler, stopScheduler } from "./services/scheduler";
import { configureTrackerWebsiteCache } from "./lib/website-for-tracker";
import { initializeScreenshotCache } from "./lib/heatmap-screenshot-cache";
import { analyticsCacheMiddleware } from "./middleware/analytics-cache";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestLogMiddleware } from "./middleware/request-log";
import { aiRoutes } from "./routes/ai";
import { analyticsRoutes } from "./routes/analytics";
import { authRoutes } from "./routes/auth";
import { automationRoutes } from "./routes/automations";
import { funnelAuthRoutes, funnelPublicRoutes } from "./routes/funnels";
import { heatmapRoutes } from "./routes/heatmaps";
import { internalRoutes } from "./routes/internal";
import { privacyRoutes } from "./routes/privacy";
import { rawDataRoutes } from "./routes/raw-data";
import { replayRoutes } from "./routes/replays";
import { trackerRoutes } from "./routes/tracker";
import { userBranchRoutes } from "./routes/user-branch";

type BunServerWithRequestIp = {
  requestIP: (request: Request) => { address: string } | null;
  /** Per-request idle override (Bun); used for large `tracker/collect` uploads. */
  timeout: (request: Request, seconds: number) => void;
};

/**
 * Public ingest: `POST /api/v1/tracker/collect` enqueues events/funnels/automations/recordings/heatmaps and flushes
 * on a timer (`INGEST_QUEUE_FLUSH_MS`, default 1000). `GET …/tracker/init|config` unchanged.
 *
 * Data retention: `Bun.cron` runs `runDataRetentionCleanup` on `DATA_RETENTION_CRON` (default 04:15 UTC daily).
 * Manual: `POST /api/v1/internal/retention-cleanup`.
 *
 * Raw API: `GET /api/v1/raw/v1/websites/:website_id/...` (website API key); read models align with `/api/v1/analytics/*`.
 * Automations: `routes/automations.ts`.
 * `runCoreMigrations` runs Drizzle push + tracked SQL migrations (core analytics + gateway billing when accessible). See `.env.example` SKIP_DB_PUSH / FORCE_DB_PUSH / AUTO_DB_PUSH.
 */
const cfg = env();
configureLogger(cfg);
const core_log = log.child({ category: 'startup' });

let ready = false;

const app = new Hono();

app.use("*", requestLogMiddleware(cfg));
app.use("*", rateLimitMiddleware(cfg));
app.use("*", corsMiddleware(cfg.corsAllowedOrigins));
app.use("*", analyticsCacheMiddleware(cfg));

// Return 503 while migrations are running so the healthcheck waits without counting failures
app.get("/health", (c) => ready ? c.text("ok") : c.text("starting", 503));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/user", userBranchRoutes);
app.route("/api/v1/ai", aiRoutes);
app.route("/api/v1/analytics", analyticsRoutes);
app.route("/api/v1/raw", rawDataRoutes);
app.route("/api/v1/privacy", privacyRoutes);
app.route("/api/v1/internal", internalRoutes);

app.route("/api/v1/funnels", funnelPublicRoutes);
app.route("/api/v1/websites", funnelAuthRoutes);
app.route("/api/v1/automations", automationRoutes);

app.route("/api/v1/replays", replayRoutes);
app.route("/api/v1/heatmaps", heatmapRoutes);
app.route("/api/v1/tracker", trackerRoutes);

const port = cfg.port;

Bun.serve({
  fetch: app.fetch,
  port,
});

core_log.info({ msg: 'http_listening', service: 'seentics-core', port });

// Run migrations and init after the HTTP server is already accepting connections.
// /health returns 503 until this completes, so Docker healthcheck waits correctly.
try {
  await runCoreMigrations(cfg.databaseUrl);
  await initMaxMindGeo(cfg.maxmind);
  configureTrackerWebsiteCache(cfg);
  configureTrackerOriginCache(cfg);
  if (cfg.screenshotCache.enabled) {
    initializeScreenshotCache(cfg.screenshotCache.ttlMs, cfg.screenshotCache.maxEntries);
  }
  startIngestQueueFlusher(cfg);
  startScheduler(cfg);
  ready = true;
  core_log.info({ msg: 'startup_complete', service: 'seentics-core', port });
} catch (err) {
  core_log.error({ msg: 'startup_failed', err: String(err) });
  process.exit(1);
}

async function shutdown() {
  core_log.info({ msg: 'shutdown_started' });
  stopScheduler();
  stopIngestQueueFlusher();
  try {
    await flushIngestQueuesNow();
  } catch (e) {
    core_log.error({ msg: 'ingest_flush_error', err: String(e) });
  }
  try {
    await getReplayEngine().shutdown();
  } catch (e) {
    core_log.error({ msg: 'replay_shutdown_error', err: String(e) });
  }
  try {
    await getHeatmapEngine().shutdown();
  } catch (e) {
    core_log.error({ msg: 'heatmap_shutdown_error', err: String(e) });
  }
}

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
