import { log } from "../../../platform/observability/logger";
import type { ErrorTrackerEvent } from "../../errors/interfaces";
import {
  chronological,
  normalizeTrackerEvents,
  type TrackerBatchRoutingContext,
} from "./tracker-event-normalization.service";

/**
 * Queue the uncaught errors a batch carried.
 *
 * Unlike heatmaps and recordings this has no per-website feature flag to check. An
 * uncaught error is a fault on the customer's own site, reported by a tracker they
 * installed; there is no sampling decision to respect and nothing to opt into. The
 * privacy gates that matter — DNT and strict consent — are applied to the whole batch in
 * `processTrackerCollect`, before any router runs, and the tracker declines to queue an
 * error at all when `trackingAllowed()` is false.
 */
export function routeErrorEvents(ctx: TrackerBatchRoutingContext): void {
  const raw = normalizeTrackerEvents(Array.isArray(ctx.body.errors) ? ctx.body.errors : []);
  if (raw.length === 0) return;

  const events = raw.map((event) => ({
    ...event,
    websiteId: ctx.website.id,
    // Browser, OS and device for the sample rows — "which browsers is this breaking in"
    // is usually the first question asked of a fault.
    clientUa: ctx.userAgent,
  })) as ErrorTrackerEvent[];

  ctx.queue.enqueue("errors", ctx.website.id, chronological(events));
  log.debug({ msg: "errors_queued", website_id: ctx.website.id, n: events.length });
}
