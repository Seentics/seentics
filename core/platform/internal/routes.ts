import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../../config";
import type {
  InternalCollectAnalyticsBody,
  InternalCollectHeatmapEventsBody,
  InternalCollectReplayEventsBody,
} from "../lib/api-types";
import { buildAnalyticsIngestMeta } from "../lib/analytics-ingest-meta";
import { clientIpForIngest } from "../lib/client-ip";
import { isGlobalApiKeyValid } from "../lib/global-key";
import type { AnalyticsIngestEvent } from "../lib/types";
import type { RetentionService } from "../retention";
import type { IngestSinks } from "../../modules/ingest/interfaces";
import { resolveWebsiteForTracker } from "../lib/website-for-tracker";
import { getUserResourceCounts } from "../lib/user-resource-counts";
import { parseJson } from "../../platform/validation";
import {
  internalCollectAnalyticsSchema,
  internalCollectHeatmapEventsSchema,
  internalCollectReplayEventsSchema,
} from "./internal.schema";

function requireGlobalKey(c: Pick<Context, "req">) {
  return isGlobalApiKeyValid(env(), c.req.header("X-API-Key"));
}

/**
 * Operational endpoints, mounted at `/api/v1/internal` behind the global API key.
 *
 * A factory rather than a module-level router: it previously reached into three other
 * modules directly — the analytics batch writer plus the recordings and heatmap engine
 * singletons — to accept server-to-server event pushes. Those are the same four write
 * targets ingest already models as `IngestSinks`, so it takes that port instead of
 * duplicating the wiring, and the retention sweep arrives injected.
 */
export function createInternalRoutes(deps: {
  /** The same write targets ingest flushes to; reused rather than re-derived. */
  sinks: IngestSinks;
  retention: RetentionService;
}) {
  const { sinks, retention } = deps;
  const internalRoutes = new Hono();

  internalRoutes.use("*", async (c, next) => {
    if (!requireGlobalKey(c)) return c.json({ error: "Invalid API key" }, 401);
    return next();
  });

internalRoutes.get("/user-resource-counts", async (c) => {
  const userId = c.req.query("user_id")?.trim() ?? "";
  if (!userId) return c.json({ error: "user_id required" }, 400);
  try {
    const counts = await getUserResourceCounts(userId);
    return c.json({ data: counts });
  } catch (e) {
    return c.json({ error: "failed to fetch counts", detail: String(e) }, 500);
  }
});
internalRoutes.post("/user/sync", (c) => c.json({ data: { ok: true } }));
internalRoutes.get("/system/stats", (c) => c.json({ data: {} }));
internalRoutes.get("/website-owner", async (c) => {
  const websiteId = c.req.query("website_id")?.trim() ?? "";
  if (!websiteId) return c.json({ error: "website_id required" }, 400);
  const website = await resolveWebsiteForTracker(websiteId);
  if (!website) return c.json({ data: null });
  return c.json({ data: { user_id: website.user_id } });
});
internalRoutes.post("/retention-cleanup", async (c) => {
  try {
    const stats = await retention.runSafely(env());
    return c.json({ data: { ok: true, stats: stats ?? null } });
  } catch {
    return c.json({ error: "retention cleanup failed" }, 500);
  }
});

internalRoutes.post("/collect/analytics", async (c) => {
  const parsed = await parseJson(c, internalCollectAnalyticsSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data as unknown as InternalCollectAnalyticsBody;
  const wid = (body as { website_id?: string }).website_id?.trim();
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
  await sinks.writeAnalyticsBatch(website.site_id, events);
  return c.body(null, 204);
});

/** Server-side replay batches (`GLOBAL_API_KEY`). Browser traffic uses `POST /api/v1/tracker/collect`. */
internalRoutes.post("/collect/replay-events", async (c) => {
  const parsed = await parseJson(c, internalCollectReplayEventsSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data as unknown as InternalCollectReplayEventsBody;
  const events = (body as { events?: unknown[] }).events;
  if (!events?.length) return c.json({ error: "events required" }, 400);
  const cfg = env();
  const ingestMeta = buildAnalyticsIngestMeta({
    userAgent: c.req.header("User-Agent") ?? "",
    clientIp: clientIpForIngest(c, cfg.trustProxy, cfg.isProduction),
    acceptLanguage: c.req.header("Accept-Language") ?? "",
    headers: c.req.raw.headers,
  });
  const enriched = events.map((e) => ({ ...(e as Record<string, unknown>), ingestMeta }));
  await sinks.processRecordings(enriched as Parameters<IngestSinks["processRecordings"]>[0]);
  return c.json({ ok: true });
});

/** Server-side heatmap batches (`GLOBAL_API_KEY`). Browser traffic uses `POST /api/v1/tracker/collect`. */
internalRoutes.post("/collect/heatmap-events", async (c) => {
  const parsed = await parseJson(c, internalCollectHeatmapEventsSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data as unknown as InternalCollectHeatmapEventsBody;
  const events = (body as { events?: unknown[] }).events;
  if (!events?.length) return c.json({ error: "events required" }, 400);
  await sinks.processHeatmaps(events as Parameters<IngestSinks["processHeatmaps"]>[0]);
  return c.json({ ok: true });
});

  return internalRoutes;
}
