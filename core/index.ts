import { env } from "./config";
import { runCoreMigrations } from "./db/migrate";
import { configureLogger, log } from "./platform/observability/logger";
import { SEENTICS_PEER_IP_HEADER } from "./platform/http/client-ip";
import { bootstrap } from "./app/bootstrap";
import { shutdownObserve } from "./platform/observability/observe";
import { createHttpApp } from "./app/http-app";


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

// Compose the modular graph: infrastructure, then modules, then their routes. Each
// module is built by its own `init.ts` and receives its peer modules through interfaces
// — and because every member of an `XModule` interface is itself an interface, no
// module is handed another's service, repository or engine. Nothing reaches back into a
// registry at call time. See app/bootstrap.ts.
//
// Composing is side-effect free, so it happens before the middleware rather than after.
// Note what is deliberately *not* mounted here: the analytics response cache. A cache
// hit short-circuits the middleware chain, so mounting it globally placed it ahead of
// the router's own `authMiddleware` and turned it into an authentication bypass. It now
// lives inside the analytics router, behind auth — see `middleware/analytics-cache.ts`.
const application = bootstrap(cfg, core_log);

const app = createHttpApp(cfg, application, () => ready);

const port = cfg.port;

Bun.serve({
  fetch(req, server) {
    // Strip any client-supplied peer-IP header and set it from the real TCP peer so
    // rate limiting / geo can never be spoofed (see platform/http/client-ip.ts). Request header
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

core_log.info({ msg: 'http_listening', port });

// Run migrations and init after the HTTP server is already accepting connections.
// /health returns 503 until this completes, so Docker healthcheck waits correctly.
try {
  // The API process migrates; a worker starts after it is healthy (deploy/docker-compose.prod.yml)
  // and must not race it with a second push of the same schema.
  if (cfg.role !== "worker") await runCoreMigrations(cfg.databaseUrl);
  // Geo database, tracker caches, engines, flushers and the scheduler are all
  // started by the composed application — see `app/bootstrap.ts`.
  await application.start();
  ready = true;
  core_log.info({ msg: 'startup_complete', port });
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
  // Last, so the lines above are sent too.
  await shutdownObserve().catch(() => undefined);
}

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
