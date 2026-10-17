import { Hono } from "hono";
import type { AppConfig } from "../config";
import type { Application } from "./bootstrap";
import { handleAppError } from "../platform/http/error-handler";
import { corsMiddleware } from "../platform/middleware/cors";
import { rateLimitMiddleware } from "../platform/middleware/rate-limit";
import { requestLogMiddleware } from "../platform/middleware/request-log";
import { requestSpans } from "../platform/observability/observe";
import { isGlobalApiKeyValid } from "../platform/security/global-key";
import { privacyRoutes } from "./http/privacy";
import { createRawDataRoutes } from "./http/public-api/routes";
import { createManagementRoutes } from "./http/management-api/routes";
import { createEmbedRoutes } from "./http/embed/routes";
import { createMcpRoutes } from "./http/mcp/routes";
import { createUserBranchRoutes } from "./http/user-branch";

/**
 * The HTTP surface: middleware and every router, mounted on one app.
 *
 * Its own function, out of `index.ts`, so the integration suite (core/integration) serves the
 * same app the server does, against a test database, without listening on a port.
 */
export function createHttpApp(cfg: AppConfig, application: Application, isReady: () => boolean): Hono {
  const app = new Hono();
  app.onError(handleAppError);

  // The span first, so the request's own log line carries its trace id.
  app.use("*", requestSpans());
  app.use("*", requestLogMiddleware(cfg));
  app.use("*", rateLimitMiddleware(cfg));
  app.use("*", corsMiddleware(cfg.corsAllowedOrigins));

  // Return 503 while migrations are running so the healthcheck waits without counting failures
  app.get("/health", (c) => (isReady() ? c.text("ok") : c.text("starting", 503)));

  // Core is a downstream service in managed Cloud. This closes a directly
  // reachable debug port as a route around Gateway auth, quotas, and auditing.
  app.use("/api/*", async (c, next) => {
    if (!cfg.gatewayOnly || isGlobalApiKeyValid(cfg, c.req.header("X-API-Key"))) return next();
    return c.json({ error: "Gateway authentication required" }, 401);
  });

  app.route("/api/v1/auth", application.modules.auth.routes);
  app.route(
    "/api/v1/user",
    createUserBranchRoutes({
      websites: application.routes.websites,
      invitations: application.modules.websites.invitations,
      authModule: application.modules.auth,
      agency: { apiKeys: application.modules.apiKeys.accountRoutes },
    }),
  );
  app.route("/api/v1/ai", application.routes.ai);
  app.route("/api/v1/analytics", application.routes.analytics);
  app.route(
    "/api/v1/raw",
    createRawDataRoutes({
      analytics: application.modules.analytics.reads,
      apiKeys: application.modules.apiKeys.verifier,
      ports: {
        analyticsEvents: application.modules.analytics.rawEvents,
        heatmaps: application.modules.heatmaps.rawReads,
        recordings: application.modules.recordings.rawReads,
      },
    }),
  );
  // Provisioning websites with an account API key — what a multi-tenant platform calls from
  // its own signup handler. See app/http/management-api/routes.ts.
  app.route(
    "/api/v1/manage",
    createManagementRoutes({
      accountKeys: application.modules.apiKeys.accountVerifier,
      websites: application.modules.websites.managementRoutes,
    }),
  );
  // The MCP server: the same reads, for an outside assistant (Claude, Cursor…) holding an
  // account key. See app/http/mcp/routes.ts.
  app.route(
    "/api/v1/mcp",
    createMcpRoutes({
      accountKeys: application.modules.apiKeys.accountVerifier,
      websites: application.modules.websites.ownedWebsites,
      clients: application.modules.websites.clients,
      analytics: application.modules.analytics.reads,
      insights: application.modules.analytics.insightReads,
      impact: application.modules.analytics.impactReads,
      goals: application.modules.analytics.anomalyReads,
      metrics: [
        application.modules.analytics.agencyMetrics,
        application.modules.recordings.agencyMetrics,
        application.modules.leads.agencyMetrics,
        application.modules.integrations.agencyMetrics,
      ],
      assistant: application.modules.ai.readTools,
    }),
  );
  // The agency workspace's public API. Only the gateway reaches it: it authenticates the
  // caller, checks the Agency plan, and names the agency in X-Agency-* headers, which the
  // router trusts only alongside the gateway's own key. See modules/agency/routes.ts.
  app.route("/api/v1/agency", application.modules.agency.routes);
  // Iframed dashboards, read with a permanent, revocable embed link's token.
  // See app/http/embed/routes.ts.
  app.route(
    "/api/v1/embed",
    createEmbedRoutes({
      embedLinks: application.modules.apiKeys.embedLinks,
      branding: application.modules.agency.whiteLabel,
      clients: application.modules.websites.clients,
      analytics: application.modules.analytics.reads,
      websites: application.modules.websites.query,
      recordings: application.modules.recordings.reads,
      heatmaps: application.modules.heatmaps.reads,
      stylesheets: application.modules.recordings.stylesheets,
    }),
  );
  app.route("/api/v1/privacy", privacyRoutes);
  app.route("/api/v1/internal", application.routes.internal);

  app.route("/api/v1/funnels", application.routes.funnels.publicRoutes);
  app.route("/api/v1/websites", application.routes.websites);
  app.route("/api/v1/websites", application.routes.funnels.authRoutes);
  app.route("/api/v1/automations", application.routes.automations);
  app.route("/api/v1/leads", application.routes.leads);
  app.route("/api/v1/integrations", application.routes.integrations);
  app.route("/api/v1/conversions", application.routes.conversions);

  app.route("/api/v1/replays", application.routes.recordings);
  app.route("/api/v1/heatmaps", application.routes.heatmaps);
  app.route("/api/v1/errors", application.routes.errors);
  app.route("/api/v1/tracker", application.routes.tracker);
  app.route("/api/v1/tracker/leads", application.routes.leadsTracker);

  return app;
}
