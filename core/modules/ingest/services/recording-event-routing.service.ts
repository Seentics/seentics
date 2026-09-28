import { log } from "../../../platform/observability/logger";
import {
  chronological,
  normalizeTrackerEvents,
  type TrackerBatchRoutingContext,
} from "./tracker-event-normalization.service";

export function routeRecordingEvents(ctx: TrackerBatchRoutingContext): number {
  if (!ctx.website.replay_enabled) return 0;
  const events = chronological(normalizeTrackerEvents(
    Array.isArray(ctx.body.session) ? ctx.body.session : [],
  ).map((event) => ({
    ...event,
    websiteId: ctx.website.id,
    data: event.data ?? {},
    ingestMeta: ctx.ingestMeta,
  })));
  if (events.length === 0) return 0;
  const accepted = ctx.queue.enqueue("recordings", ctx.website.id, events).accepted;
  log.debug({ msg: "recordings_queued", website_id: ctx.website.id, n: accepted });
  return accepted;
}
