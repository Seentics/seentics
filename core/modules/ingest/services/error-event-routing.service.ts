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
export function routeErrorEvents(ctx: TrackerBatchRoutingContext): number {
  const input = Array.isArray(ctx.body.errors) ? ctx.body.errors : [];
  const raw = normalizeTrackerEvents(input);
  if (raw.length === 0) return 0;

  // `normalizeTrackerEvents` keeps the fields every tracker event shares and nothing
  // else — it was written for pageviews and clicks. An error's substance is in its own
  // fields (message, kind, source, stack, position), which it dropped, so every error
  // reached `toRow` with an empty message and was discarded: the Errors page stayed
  // empty for every site. They are carried over here, type-checked.
  const errorFields = (item: unknown) => {
    const v = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const text = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : undefined);
    const num = (key: string) =>
      typeof v[key] === "number" && Number.isFinite(v[key]) ? (v[key] as number) : undefined;
    return {
      message: text("message"),
      kind: text("kind"),
      source: text("source"),
      stack: text("stack"),
      line_no: num("line_no"),
      col_no: num("col_no"),
    };
  };
  const detailed = input.filter((item) => item && typeof item === "object" && !Array.isArray(item));

  const events = raw.map((event, i) => ({
    ...event,
    ...errorFields(detailed[i]),
    websiteId: ctx.website.id,
    // Browser, OS and device for the sample rows — "which browsers is this breaking in"
    // is usually the first question asked of a fault.
    clientUa: ctx.userAgent,
  })) as ErrorTrackerEvent[];

  const accepted = ctx.queue.enqueue("errors", ctx.website.id, chronological(events)).accepted;
  log.debug({ msg: "errors_queued", website_id: ctx.website.id, n: accepted });
  return accepted;
}
