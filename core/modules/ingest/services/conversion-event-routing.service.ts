import { randomUUID } from "node:crypto";
import type { ConversionTrackerRow } from "../../integrations/interfaces";
import { normalizeTrackerEvents, type TrackerBatchRoutingContext } from "./tracker-event-normalization.service";

/**
 * Consented custom events, for the site's server-side conversions.
 *
 * Called only for an identified visitor's batch (never an anonymous one), and only custom
 * events go: purchases, sign-ups and whatever the owner mapped are all `track()` calls. The
 * request's IP and browser travel with them because the ad platforms match on both; they
 * are kept only on the queued conversion, and cleared once it is sent. Which events a site
 * actually forwards — if any — is decided by the conversions lane, against its destinations.
 */
export function routeConversionEvents(ctx: TrackerBatchRoutingContext & { clientIp: string }): number {
  const events = normalizeTrackerEvents(Array.isArray(ctx.body.events) ? ctx.body.events : []);
  const batchId = typeof ctx.body.batch_id === "string" && ctx.body.batch_id ? ctx.body.batch_id.slice(0, 64) : randomUUID();
  const ad = ctx.body.ad && typeof ctx.body.ad === "object" && !Array.isArray(ctx.body.ad) ? (ctx.body.ad as Record<string, unknown>) : null;
  const rows: ConversionTrackerRow[] = [];
  events.forEach((event, index) => {
    if (event.type !== "custom") return;
    const data = event.data ?? {};
    const name = typeof data.name === "string" ? data.name.trim().slice(0, 120) : "";
    if (!name) return;
    rows.push({
      websiteId: ctx.website.id,
      fallbackId: `${batchId}:${index}`,
      name,
      occurredAt: event.ts,
      url: event.url ?? "",
      visitorId: event.vid || null,
      properties: data,
      ip: ctx.clientIp,
      userAgent: ctx.userAgent,
      // Shape-checked by the conversions router before anything is forwarded.
      ad: ad as ConversionTrackerRow["ad"],
    });
  });
  if (rows.length === 0) return 0;
  return ctx.queue.enqueue("conversions", ctx.website.id, rows).accepted;
}
