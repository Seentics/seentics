import { log } from "../../../platform/observability/logger";
import { TRACKER_FUNNEL_EVENT_TYPES } from "../../funnels/interfaces";
import {
  attachIngestMetadata,
  chronological,
  normalizeTrackerEvents,
  type TrackerBatchRoutingContext,
} from "./tracker-event-normalization.service";

export function routeFunnelEvents(ctx: TrackerBatchRoutingContext): number {
  if (!ctx.website.funnel_enabled) return 0;
  const events = normalizeTrackerEvents(Array.isArray(ctx.body.funnels) ? ctx.body.funnels : [])
    .filter((event) => TRACKER_FUNNEL_EVENT_TYPES.has(event.type) && event.sid);
  if (events.length === 0) return 0;
  const queued = attachIngestMetadata(chronological(events), ctx.ingestMeta);
  const accepted = ctx.queue.enqueue("funnels", ctx.website.id, queued).accepted;
  log.debug({ msg: "funnel_events_queued", website_id: ctx.website.id, n: accepted });
  return accepted;
}
