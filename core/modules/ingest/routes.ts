import { promisify } from "node:util";
import { gunzip as gunzipCallback } from "node:zlib";
import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../../config";
import type { TrackerCollectBody } from "../../platform/lib/api-types";
import { clientIpForIngest } from "../../platform/lib/client-ip";
import { log } from "../../platform/lib/logger";
import { originFromRequest, validateOriginDomain, validateScreenshotTargetUrl } from "../../platform/lib/origin";
import { validationErrorResponse } from "../../platform/validation";
import type {
  AutomationEvaluation,
  AutomationTrackerSettings,
  VisitorProfileWriter,
} from "../automations/interfaces";
import type { FunnelTrackerConfig } from "../funnels/interfaces";
import type { HeatmapScreenshotCapture } from "../heatmaps/interfaces";
import type { TrackerWebsites } from "../websites/interfaces";
// The `/collect` sorters are internal to this module — ingest's own code, not a peer
// module's — so they stay plain imports. Everything they hand a batch to is behind
// `IngestSinks`, which is where ingest's cross-module coupling is declared.
import {
  handleAutomations,
  handleEvents,
  handleFunnels,
  handleHeatmaps,
  handleRecordings,
  handleVisitorProfile,
} from "./services/collect-handlers";
import { buildAnalyticsIngestMeta } from "../../platform/lib/analytics-ingest-meta";
import type { IngestQueue } from "./interfaces";
import { trackerCollectSchema } from "./validators/tracker.schema";

// The zod schema caps legit content around 5MB total — 8MB leaves headroom without
// letting a client make us buffer tens of MB.
const maxBodyBytes = 8 * 1024 * 1024;
const maxGunzipBytes = 50 * 1024 * 1024;

const gunzip = promisify(gunzipCallback);

/**
 * The tracker's HTTP surface, mounted at `/api/v1/tracker`.
 *
 * The hottest and the only fully anonymous surface in the product: `seentics.js`
 * calls it from pages we do not control, so every path here validates the request
 * origin against the website's registered domain instead of authenticating a user,
 * and the wire shapes — paths, status codes, JSON field names — are a contract with
 * snippets already deployed in the wild.
 *
 * A factory rather than a module-level `new Hono()`, and that is what closes the
 * couplings the previous version documented as unavoidable. Four capabilities used
 * to be reached for through imports purely because a singleton router has no
 * injection point:
 *
 * - the funnels and automations halves of `/init` were free functions wrapping their
 *   modules' repositories;
 * - server-side evaluation went through a free `evaluate()` (since deleted) backed by a
 *   lazily-constructed service whose event bus had no subscribers;
 * - `/request-screenshot` called a free `captureHeatmapScreenshot` (since deleted),
 *   which resolved
 *   the website itself through `lib/website-resolve` — a second read of a table this
 *   handler had already read, from a module that should not touch it at all.
 *
 * All four now arrive as ports, so the routes reach no database and no other module
 * directly, and the whole surface runs against fakes in a test.
 */
export function createTrackerRoutes(deps: {
  /**
   * Where `/collect` buffers what it parsed.
   *
   * The handlers take it on their context rather than importing it, so this router
   * no longer depends on the queue being a module-level singleton.
   */
  queue: IngestQueue;
  /** Where `/collect` sends the visitor profile it built from the batch. */
  visitorProfiles: VisitorProfileWriter;
  /** Active automations for `/init`. One indexed read per session start. */
  automations: AutomationTrackerSettings;
  /** Server-side trigger evaluation for `/automations/evaluate`. */
  automationEvaluation: AutomationEvaluation;
  /** Active funnel definitions for `/init`. */
  funnels: FunnelTrackerConfig;
  /**
   * On-demand Playwright capture for `/request-screenshot`.
   *
   * The narrowest of the four and the only one with outbound network reach, which is
   * why the handler validates the target URL against the site's own domain before it
   * is ever called.
   */
  screenshots: HeatmapScreenshotCapture;
  /**
   * Tracker-facing website lookup.
   *
   * Injected rather than imported so a test can substitute it without stubbing a
   * shared platform module — `mock.module` is process-global in Bun, so doing that
   * leaked into the suite that exercises the real implementation.
   */
  trackerWebsites: TrackerWebsites;
}) {
  const { queue, visitorProfiles, automations, automationEvaluation, funnels, screenshots } = deps;
  const {
    resolve: resolveWebsiteForTracker,
    listGoals: listTrackerGoals,
    buildConfig: buildPublicTrackerConfig,
  } = deps.trackerWebsites;
  const r = new Hono();

  async function readJsonBody(c: Pick<Context, "req">): Promise<unknown> {
    // Reject oversized requests up front (before buffering the body).
    const contentLength = Number.parseInt(c.req.header("Content-Length") ?? "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      throw new Error("body too large");
    }
    const buf = Buffer.from(await c.req.arrayBuffer());
    if (buf.length > maxBodyBytes) {
      throw new Error("body too large");
    }
    const enc = c.req.header("Content-Encoding");
    let raw = buf;
    if (enc?.toLowerCase().includes("gzip")) {
      // Async gunzip keeps decompression off the event loop; maxOutputLength still
      // guards against decompression bombs.
      raw = await gunzip(buf, { maxOutputLength: maxGunzipBytes });
    }
    return JSON.parse(raw.toString("utf8")) as unknown;
  }

  r.get("/init/:website_id", async (c) => {
    const cfg = env();
    const websiteId = c.req.param("website_id");
    const origin = originFromRequest(c.req.raw.headers);

    const website = await resolveWebsiteForTracker(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }
    if (!validateOriginDomain(origin, website.url, cfg.environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }

    let goals: Awaited<ReturnType<typeof listTrackerGoals>> = [];
    try {
      goals = await listTrackerGoals(website.id);
    } catch {
      goals = [];
    }

    const config = await buildPublicTrackerConfig(website, goals);
    let funnelData: unknown[] = [];
    let automationData: unknown[] = [];
    try {
      // `website.id` is the resolved UUID — the funnels module no longer re-resolves.
      funnelData = await funnels.activeForTracker(website.id);
    } catch {
      funnelData = [];
    }
    try {
      // `website.id` is already the resolved UUID, which is what keys `automations`.
      const rows = await automations.activeFor(website.id);
      automationData = rows.map((a) => ({
        id: a.id,
        name: a.name,
        ...a.definition,
      }));
    } catch {
      automationData = [];
    }
    c.header("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return c.json({
      config,
      funnels: funnelData,
      automations: automationData,
    });
  });

  r.get("/config/:website_id", async (c) => {
    const cfg = env();
    const websiteId = c.req.param("website_id");
    const origin = originFromRequest(c.req.raw.headers);

    const website = await resolveWebsiteForTracker(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }
    if (!validateOriginDomain(origin, website.url, cfg.environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }

    let goals: Awaited<ReturnType<typeof listTrackerGoals>> = [];
    try {
      goals = await listTrackerGoals(website.id);
    } catch {
      goals = [];
    }

    const config = await buildPublicTrackerConfig(website, goals);
    c.header("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return c.json(config);
  });

  /**
   * Accepts tracker batches, enqueues by kind (events, funnels, automations, recordings, heatmaps).
   * Background flush (~1s by default) runs batched DB / S3 work — see `services/ingest-queue.service.ts`.
   */
  r.post("/collect", async (c) => {
    const cfg = env();
    let body: TrackerCollectBody;
    try {
      const raw = await readJsonBody(c);
      const parsed = trackerCollectSchema.safeParse(raw);
      if (!parsed.success) return validationErrorResponse(c, parsed.error);
      body = parsed.data as unknown as TrackerCollectBody;
    } catch {
      return c.json({ error: "invalid request body" }, 400);
    }

    const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
    if (!websiteId) {
      return c.json({ error: "website_id is required" }, 400);
    }

    const n =
      (Array.isArray(body.events) ? body.events.length : 0) +
      (Array.isArray(body.session) ? body.session.length : 0) +
      (Array.isArray(body.heatmaps) ? body.heatmaps.length : 0) +
      (Array.isArray(body.heatmap_screenshot) ? body.heatmap_screenshot.length : 0) +
      (Array.isArray(body.funnels) ? body.funnels.length : 0) +
      (Array.isArray(body.automations) ? body.automations.length : 0);

    if (n === 0) {
      return c.json({ status: "ok", message: "nothing to process" }, 200);
    }

    const website = await resolveWebsiteForTracker(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }

    const origin = originFromRequest(c.req.raw.headers);
    if (!validateOriginDomain(origin, website.url, cfg.environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }

    // Prefer the HTTP User-Agent header. Fallback to navigator.userAgent embedded in the payload
    // body when the UA is missing or is a server runtime (e.g. Bun/x.x injected by Bun fetch()
    // when proxying through the gateway → core chain).
    let ua = c.req.header("User-Agent") ?? "";
    if (!ua || /^(bun\/|node\/|node-fetch|undici|got\/|axios\/)/i.test(ua)) {
      // Primary fallback: top-level body.ua (sent with every payload since tracker v2)
      const bodyUa = typeof body.ua === "string" ? body.ua.trim() : "";
      if (bodyUa) {
        ua = bodyUa;
      } else {
        // Secondary fallback: ua inside a pageview event's data object
        const eventsArr = Array.isArray(body.events) ? body.events : [];
        for (const ev of eventsArr) {
          const evUa = (ev as Record<string, unknown> | null)?.data;
          const candidate = typeof (evUa as Record<string, unknown> | null)?.ua === "string"
            ? ((evUa as Record<string, unknown>).ua as string).trim()
            : "";
          if (candidate) { ua = candidate; break; }
        }
      }
    }
    // One enrichment blob per /collect: client IP → MaxMind (country/region/city) + UA/device + optional edge/fallback headers.
    // handleEvents / handleFunnels attach this same ingestMeta to every row before enqueue → flush → Postgres.
    const ingestMeta = buildAnalyticsIngestMeta({
      userAgent: ua,
      clientIp: clientIpForIngest(c, cfg.trustProxy, cfg.isProduction),
      acceptLanguage: c.req.header("Accept-Language") ?? "",
      headers: c.req.raw.headers,
    });
    const ctx = { body, website, userAgent: ua, ingestMeta, queue, visitorProfiles };

    const lenEvents = Array.isArray(body.events) ? body.events.length : 0;
    const lenSession = Array.isArray(body.session) ? body.session.length : 0;
    const lenHeat = Array.isArray(body.heatmaps) ? body.heatmaps.length : 0;
    const lenHeatShot = Array.isArray(body.heatmap_screenshot) ? body.heatmap_screenshot.length : 0;
    const lenFunnels = Array.isArray(body.funnels) ? body.funnels.length : 0;
    const lenAuto = Array.isArray(body.automations) ? body.automations.length : 0;
    const eventTypesSample =
      lenEvents > 0 && Array.isArray(body.events)
        ? [
            ...new Set(
              body.events
                .slice(0, 40)
                .map((x) => (x && typeof x === "object" && "type" in x ? String((x as { type?: string }).type ?? "") : ""))
                .filter(Boolean),
            ),
          ].slice(0, 15)
        : [];

    const collectFields = {
      msg: "tracker_collect" as const,
      website_param: websiteId,
      website_uuid: website.id,
      website_id: website.id,
      origin,
      len_events: lenEvents,
      len_session: lenSession,
      len_heatmaps: lenHeat,
      len_heatmap_screenshot: lenHeatShot,
      len_funnels: lenFunnels,
      len_automations: lenAuto,
      event_types_sample: eventTypesSample,
    };
    log.debug(collectFields);
    if (cfg.diagnosticLog) {
      log.info(collectFields);
    }

    handleEvents(ctx);
    handleVisitorProfile(ctx);
    handleFunnels(ctx);
    handleAutomations(ctx);
    handleRecordings(ctx);
    handleHeatmaps(ctx);

    return c.json({ status: "ok", message: "processed", queued: n }, 200);
  });

  /**
   * POST /api/v1/tracker/request-screenshot
   * Called by seentics.js when a visitor lands on a page with no screenshot yet.
   * Validates origin + websiteId like other tracker endpoints (no auth required).
   * Responds 202 immediately; Playwright capture runs in background (fire-and-forget).
   * Server-side deduplication (cache → DB → Playwright) ensures the browser only
   * launches when no screenshot already exists for this page.
   */
  r.post("/request-screenshot", async (c) => {
    const cfg = env();

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
    if (!websiteId) return c.json({ error: "website_id required" }, 400);

    const pageUrl = typeof body.page_url === "string" ? body.page_url.trim() : "";
    const pagePath = typeof body.page_path === "string" ? body.page_path.trim() : "";
    if (!pageUrl || !pagePath) return c.json({ error: "page_url and page_path required" }, 400);

    try {
      new URL(pageUrl);
    } catch {
      return c.json({ error: "invalid page_url" }, 400);
    }

    const website = await resolveWebsiteForTracker(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }

    const origin = originFromRequest(c.req.raw.headers);
    if (!validateOriginDomain(origin, website.url, cfg.environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }

    // SSRF guard: only capture URLs on the website's registered domain — never
    // IP literals, localhost, or internal hosts (website ids are public).
    if (!validateScreenshotTargetUrl(pageUrl, website.url)) {
      return c.json({ error: "page_url not allowed" }, 400);
    }

    // Detached on purpose: a capture launches a browser and fetches a third-party
    // page, which no visitor's request should wait on. The port resolves the website
    // through the heatmaps module's own settings read — the free function this
    // replaced resolved it a second time through `lib/website-resolve` instead, and
    // an unknown website still ends as a rejected promise that lands here.
    void screenshots
      .capture(websiteId, { pageUrl, pagePath, force: false })
      .catch(() => { /* best-effort */ });

    return c.json({ status: "queued" }, 202);
  });

  /**
   * POST /api/v1/tracker/automations/evaluate
   * Called by seentics.js when a behavioral trigger fires client-side.
   * Returns client-side action payloads (show_modal, redirect, etc.) and
   * dispatches webhook actions async. No auth — origin + websiteId validated.
   */
  r.post("/automations/evaluate", async (c) => {
    const cfg = env();

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
    if (!websiteId) return c.json({ error: "website_id required" }, 400);

    const anonymousId = typeof body.anonymous_id === "string" ? body.anonymous_id.trim() : "";
    const sessionId   = typeof body.session_id   === "string" ? body.session_id.trim()   : "";
    if (!anonymousId || !sessionId) return c.json({ error: "anonymous_id and session_id required" }, 400);

    const triggerRaw = body.trigger;
    if (!triggerRaw || typeof triggerRaw !== "object" || Array.isArray(triggerRaw)) {
      return c.json({ error: "trigger object required" }, 400);
    }
    const trigger = triggerRaw as { type: string; [k: string]: unknown };
    if (!trigger.type) return c.json({ error: "trigger.type required" }, 400);

    const website = await resolveWebsiteForTracker(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }

    const origin = originFromRequest(c.req.raw.headers);
    if (!validateOriginDomain(origin, website.url, cfg.environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }

    try {
      const result = await automationEvaluation.evaluate({
        // Both identifiers, already resolved by the origin check above: the UUID
        // keys every table the evaluation touches, the websiteId only labels the events
        // it publishes. Passing both is what keeps the automations module out of the
        // `websites` table.
        websiteId:   website.id,
        anonymousId,
        userId:      typeof body.user_id === "string" ? body.user_id : null,
        sessionId,
        trigger,
        context:     (body.context && typeof body.context === "object" && !Array.isArray(body.context))
                       ? (body.context as Record<string, unknown>)
                       : {},
      });
      return c.json({ status: "ok", matched: result.matched, actions: result.actions });
    } catch (err) {
      log.error({ msg: "automations_evaluate_error", websiteId, err });
      return c.json({ error: "evaluation failed" }, 500);
    }
  });

  return r;
}
