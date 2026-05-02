import { Hono } from "hono";
import { env } from "./config";
import { applyAnalyticsEventsWebsiteIdMigration, ensureCoreSchema } from "./db/ensure-schema";
import { flushIngestQueuesNow, startIngestQueueFlusher, stopIngestQueueFlusher } from "./services/ingest.service";
import { initMaxMindGeo } from "./lib/maxmind-geo";
import { configureLogger } from "./lib/logger";
import { getHeatmapEngine } from "./lib/heatmap-engine";
import { getReplayEngine } from "./lib/replay-engine";
import { configureTrackerOriginCache } from "./lib/origin";
import { startDataRetentionCron } from "./services/retention.service";
import { configureTrackerWebsiteCache } from "./lib/website-for-tracker";
import { analyticsCacheMiddleware } from "./middleware/analytics-cache";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestLogMiddleware } from "./middleware/request-log";
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
 *
 * Schema: `applyAnalyticsEventsWebsiteIdMigration` renames legacy `website_site_id` → `website_id`.
 * `ensureCoreSchema` runs Drizzle push when the DB has no `websites` table (dev default). See `.env.example` SKIP_DB_PUSH / FORCE_DB_PUSH / AUTO_DB_PUSH.
 */
const cfg = env();
configureLogger(cfg);
await applyAnalyticsEventsWebsiteIdMigration();
await ensureCoreSchema();
await initMaxMindGeo(cfg.maxmind);
configureTrackerWebsiteCache(cfg);
configureTrackerOriginCache(cfg);
startIngestQueueFlusher(cfg);
startDataRetentionCron(cfg);

const app = new Hono();

app.use("*", requestLogMiddleware(cfg));
app.use("*", rateLimitMiddleware(cfg));
app.use("*", corsMiddleware(cfg.corsAllowedOrigins));
app.use("*", analyticsCacheMiddleware(cfg));

app.get("/health", (c) => c.text("ok"));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/user", userBranchRoutes);
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

async function shutdown() {
  stopIngestQueueFlusher();
  try {
    await flushIngestQueuesNow();
  } catch (e) {
    console.error("ingest queues flush", e);
  }
  try {
    await getReplayEngine().shutdown();
  } catch (e) {
    console.error("replay shutdown", e);
  }
  try {
    await getHeatmapEngine().shutdown();
  } catch (e) {
    console.error("heatmap shutdown", e);
  }
}

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

const port = cfg.port;



console.log(`seentics core on :${port} (Bun + Hono + Drizzle — full OSS API)`);
