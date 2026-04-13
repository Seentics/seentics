import { Hono } from "hono";
import { env } from "./config";
import { configureLogger } from "./lib/logger";
import { getHeatmapEngine } from "./lib/heatmap-engine";
import { getReplayEngine } from "./lib/replay-engine";
import { analyticsCacheMiddleware } from "./middleware/analytics-cache";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestLogMiddleware } from "./middleware/request-log";
import { adminRoutes } from "./routes/admin";
import { analyticsRoutes } from "./routes/analytics";
import { authRoutes } from "./routes/auth";
import { automationRoutes } from "./routes/automations";
import { funnelAuthRoutes, funnelPublicRoutes } from "./routes/funnels";
import { heatmapRoutes } from "./routes/heatmaps";
import { internalRoutes } from "./routes/internal";
import { privacyRoutes } from "./routes/privacy";
import { replayRoutes } from "./routes/replays";
import { trackerRoutes } from "./routes/tracker";
import { userBranchRoutes } from "./routes/user-branch";

/**
 * Public ingest: `POST /api/v1/tracker/collect` (and `GET …/tracker/init|config`).
 * Trusted server ingest (`X-API-Key: GLOBAL_API_KEY`): `POST /api/v1/internal/collect/analytics`,
 * `…/collect/replay-events`, `…/collect/heatmap-events`.
 */
const cfg = env();
configureLogger(cfg);

const app = new Hono();

app.use("*", requestLogMiddleware(cfg));
app.use("*", rateLimitMiddleware(cfg));
app.use("*", corsMiddleware(cfg.corsAllowedOrigins));
app.use("*", analyticsCacheMiddleware(cfg));

app.get("/health", (c) => c.text("ok"));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/user", userBranchRoutes);
app.route("/api/v1/analytics", analyticsRoutes);
app.route("/api/v1/privacy", privacyRoutes);
app.route("/api/v1/internal", internalRoutes);
app.route("/api/v1/admin", adminRoutes);

app.route("/api/v1/funnels", funnelPublicRoutes);
app.route("/api/v1/websites", funnelAuthRoutes);
app.route("/api/v1/websites", automationRoutes);

app.route("/api/v1/replays", replayRoutes);
app.route("/api/v1/heatmaps", heatmapRoutes);
app.route("/api/v1/tracker", trackerRoutes);

async function shutdown() {
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
export default {
  port,
  fetch: app.fetch,
};

console.log(`seentics core on :${port} (Bun + Hono + Drizzle — full OSS API)`);
