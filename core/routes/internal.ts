import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../config";
import type {
  InternalCollectAnalyticsBody,
  InternalCollectHeatmapEventsBody,
  InternalCollectReplayEventsBody,
} from "../lib/api-types";
import { buildAnalyticsIngestMeta } from "../lib/analytics-ingest-meta";
import { clientIpForIngest } from "../lib/client-ip";
import { ingestAnalyticsBatch } from "../services/ingest.service";
import { getHeatmapEngine } from "../lib/heatmap-engine";
import { isGlobalApiKeyValid } from "../lib/global-key";
import { getReplayEngine } from "../lib/replay-engine";
import type { AnalyticsIngestEvent } from "../lib/types";
import { runDataRetentionCleanupSafe } from "../services/retention.service";
import { resolveWebsiteForTracker } from "../lib/website-for-tracker";

function requireGlobalKey(c: Pick<Context, "req">) {
  return isGlobalApiKeyValid(env(), c.req.header("X-API-Key"));
}

export const internalRoutes = new Hono();

internalRoutes.use("*", async (c, next) => {
  if (!requireGlobalKey(c)) return c.json({ error: "Invalid API key" }, 401);
  return next();
});

internalRoutes.get("/user-resource-counts", (c) => c.json({ data: {} }));
internalRoutes.post("/user/sync", (c) => c.json({ data: { ok: true } }));
internalRoutes.get("/system/stats", (c) => c.json({ data: {} }));
internalRoutes.get("/website-owner", (c) => c.json({ data: null }));
internalRoutes.post("/retention-cleanup", async (c) => {
  try {
    const stats = await runDataRetentionCleanupSafe(env());
    return c.json({ data: { ok: true, stats: stats ?? null } });
  } catch {
    return c.json({ error: "retention cleanup failed" }, 500);
  }
});

internalRoutes.post("/collect/analytics", async (c) => {
  const body = await c.req.json<InternalCollectAnalyticsBody>().catch(() => null);
  const wid = body?.website_id?.trim();
  if (!wid) return c.json({ error: "website_id required" }, 400);
  const website = await resolveWebsiteForTracker(wid);
  if (!website) return c.json({ error: "unknown website" }, 404);
  const raw = Array.isArray(body?.events) ? body!.events! : [];
  const cfg = env();
  const ingestMeta = buildAnalyticsIngestMeta({
    userAgent: c.req.header("User-Agent") ?? "",
    clientIp: clientIpForIngest(c, cfg.trustProxy, cfg.isProduction),
    acceptLanguage: c.req.header("Accept-Language") ?? "",
    headers: c.req.raw.headers,
  });
  const events: AnalyticsIngestEvent[] = raw.map((item) => {
    if (!item || typeof item !== "object") return { type: "event", ts: Date.now(), data: {}, ingestMeta };
    const o = item as Record<string, unknown>;
    return {
      type: String(o.type ?? "event"),
      ts: Number(o.ts) || Date.now(),
      url: typeof o.url === "string" ? o.url : "",
      sid: typeof o.sid === "string" ? o.sid : "",
      vid: typeof o.vid === "string" ? o.vid : "",
      data: (o.data as Record<string, unknown>) ?? {},
      ingestMeta,
    };
  });
  await ingestAnalyticsBatch(website.site_id, events);
  return c.body(null, 204);
});

/** Server-side replay batches (`GLOBAL_API_KEY`). Browser traffic uses `POST /api/v1/tracker/collect`. */
internalRoutes.post("/collect/replay-events", async (c) => {
  const body = await c.req.json<InternalCollectReplayEventsBody>().catch(() => null);
  const events = body?.events;
  if (!events?.length) return c.json({ error: "events required" }, 400);
  await getReplayEngine().processEvents(events);
  return c.json({ ok: true });
});

/** Server-side heatmap batches (`GLOBAL_API_KEY`). Browser traffic uses `POST /api/v1/tracker/collect`. */
internalRoutes.post("/collect/heatmap-events", async (c) => {
  const body = await c.req.json<InternalCollectHeatmapEventsBody>().catch(() => null);
  const events = body?.events;
  if (!events?.length) return c.json({ error: "events required" }, 400);
  await getHeatmapEngine().processEvents(events);
  return c.json({ ok: true });
});
