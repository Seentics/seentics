import { Hono } from "hono";
import { env } from "./config";
import { runCoreMigrations } from "./db/migrate";
import { configureLogger, log } from "./platform/lib/logger";
import { SEENTICS_PEER_IP_HEADER } from "./platform/lib/client-ip";
import { bootstrap } from "./app/bootstrap";
import { corsMiddleware } from "./platform/middleware/cors";
import { rateLimitMiddleware } from "./platform/middleware/rate-limit";
import { requestLogMiddleware } from "./platform/middleware/request-log";
import { privacyRoutes } from "./platform/http/privacy";
import { createRawDataRoutes } from "./platform/raw-data/routes";
import { createUserBranchRoutes } from "./platform/http/user-branch";


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

// Compose the modular graph: infrastructure, then modules, then their routes. Each
// module is built by its own `init.ts` and receives its peer modules plus the event bus
// — and because every member of an `XModule` interface is itself an interface, no
// module is handed another's service, repository or engine. Nothing reaches back into a
// registry at call time. See app/bootstrap.ts.
//
// Before the middleware, not after: the analytics response cache is one of the things
// the graph provides, and composing is side-effect free, so there is nothing to gain
// by deferring it.
const application = bootstrap(cfg, core_log);

app.use("*", requestLogMiddleware(cfg));
app.use("*", rateLimitMiddleware(cfg));
app.use("*", corsMiddleware(cfg.corsAllowedOrigins));
app.use("*", application.modules.analytics.cacheMiddleware);

// Return 503 while migrations are running so the healthcheck waits without counting failures
app.get("/health", (c) => ready ? c.text("ok") : c.text("starting", 503));

app.route("/api/v1/auth", application.modules.auth.routes);
app.route(
  "/api/v1/user",
  createUserBranchRoutes({
    websites: application.routes.websites,
    invitations: application.modules.websites.invitations,
    authModule: application.modules.auth,
  }),
);
app.route("/api/v1/ai", application.routes.ai);
app.route("/api/v1/analytics", application.routes.analytics);
app.route(
  "/api/v1/raw",
  createRawDataRoutes({
    analytics: application.modules.analytics.reads,
    ports: {
      analyticsEvents: application.modules.analytics.rawEvents,
      heatmaps: application.modules.heatmaps.rawReads,
      recordings: application.modules.recordings.rawReads,
    },
  }),
);
app.route("/api/v1/privacy", privacyRoutes);
app.route("/api/v1/internal", application.routes.internal);

app.route("/api/v1/funnels", application.routes.funnels.publicRoutes);
app.route("/api/v1/websites", application.routes.websites);
app.route("/api/v1/websites", application.routes.funnels.authRoutes);
app.route("/api/v1/automations", application.routes.automations);

app.route("/api/v1/replays", application.routes.recordings);
app.route("/api/v1/heatmaps", application.routes.heatmaps);
app.route("/api/v1/tracker", application.routes.tracker);

const port = cfg.port;

Bun.serve({
  fetch(req, server) {
    // Strip any client-supplied peer-IP header and set it from the real TCP peer so
    // rate limiting / geo can never be spoofed (see lib/client-ip.ts). Request header
    // guards allow set/delete of non-forbidden headers, so mutate in place.
    req.headers.delete(SEENTICS_PEER_IP_HEADER);
    req.headers.set(
      SEENTICS_PEER_IP_HEADER,
      (server as BunServerWithRequestIp).requestIP(req)?.address ?? "",
    );
    return app.fetch(req, server);
  },
  port,
});

core_log.info({ msg: 'http_listening', service: 'seentics-core', port });

// Run migrations and init after the HTTP server is already accepting connections.
// /health returns 503 until this completes, so Docker healthcheck waits correctly.
try {
  await runCoreMigrations(cfg.databaseUrl);
  // Geo database, tracker caches, engines, flushers and the scheduler are all
  // started by the composed application — see `app/bootstrap.ts`.
  await application.start();
  ready = true;
  core_log.info({ msg: 'startup_complete', service: 'seentics-core', port });
} catch (err) {
  core_log.error({ msg: 'startup_failed', err: String(err) });
  process.exit(1);
}

async function shutdown() {
  core_log.info({ msg: 'shutdown_started' });
  try {
    // Stops the scheduler, drains the ingest buffers into the engines, shuts the
    // engines down in that order, then stops the outbox publisher. The ordering
    // matters and is enforced in one place — see `app/bootstrap.ts`.
    await application.stop();
  } catch (e) {
    core_log.error({ msg: 'application_stop_error', err: String(e) });
  }
}

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
