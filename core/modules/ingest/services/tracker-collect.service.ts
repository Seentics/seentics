import type { TrackerCollectBody } from "../interfaces";
import { buildAnalyticsIngestMeta } from "../../../platform/http/analytics-ingest-meta";
import { log } from "../../../platform/observability/logger";
import type {
  IngestQueue,
  ProcessTrackerCollectInput,
  ProcessTrackerCollectResult,
  TrackerCollectService,
} from "../interfaces";
import { anonymizeTrackerBatch, anonymousVisitorId } from "../lib/anonymous-batch";
import { routeAnalyticsEvents } from "./analytics-event-routing.service";
import { routeAutomationTriggers } from "./automation-trigger-routing.service";
import { routeErrorEvents } from "./error-event-routing.service";
import { routeFunnelEvents } from "./funnel-event-routing.service";
import { routeHeatmapEvents } from "./heatmap-event-routing.service";
import { routeRecordingEvents } from "./recording-event-routing.service";
import { routeVisitorProfile } from "./visitor-profile-routing.service";

export function createTrackerCollectService(queue: IngestQueue): TrackerCollectService {
  return {
    process(input) {
      return processTrackerCollect(input, queue);
    },
  };
}

function processTrackerCollect(
  input: ProcessTrackerCollectInput,
  queue: IngestQueue,
): ProcessTrackerCollectResult {
  const { website, headers } = input;
  let { body } = input;
  if (trackerCollectItemCount(body) === 0) return { kind: "empty" };

  const consentGranted = (body as Record<string, unknown>).consent === true;
  if ((website.respect_dnt && headers.get("DNT") === "1") ||
      (website.consent_mode === "strict" && !consentGranted)) {
    return { kind: "privacy-disabled" };
  }

  const userAgent = trackerUserAgent(body, headers.get("User-Agent") ?? "");
  // No consent on a site that asks for it: only what needs none, under a daily
  // anonymous id. The controller supplies the salt exactly when this applies.
  const anonymous = Boolean(input.anonymousSalt);
  if (input.anonymousSalt) {
    body = anonymizeTrackerBatch(body, anonymousVisitorId(input.anonymousSalt, website.id, input.clientIp, userAgent));
    if (trackerCollectItemCount(body) === 0) return { kind: "empty" };
  }
  const ingestMeta = buildAnalyticsIngestMeta({
    userAgent,
    clientIp: input.clientIp,
    acceptLanguage: headers.get("Accept-Language") ?? "",
    headers,
  });
  let queued = 0;
  let dropped = 0;
  const countingQueue: IngestQueue = {
    enqueue(lane, websiteId, rows) {
      const result = queue.enqueue(lane, websiteId, rows);
      queued += result.accepted;
      dropped += result.dropped;
      return result;
    },
  };
  const context = { body, website, userAgent, ingestMeta, queue: countingQueue };

  const fields = {
    msg: "tracker_collect" as const,
    website_param: input.websiteParam,
    website_uuid: website.id,
    website_id: website.id,
    origin: input.origin,
    len_events: lengthOf(body.events),
    len_session: lengthOf(body.session),
    len_heatmaps: lengthOf(body.heatmaps),
    len_heatmap_screenshot: lengthOf(body.heatmap_screenshot),
    len_funnels: lengthOf(body.funnels),
    len_automations: lengthOf(body.automations),
    len_errors: lengthOf(body.errors),
    event_types_sample: eventTypes(body.events),
  };
  log.debug(fields);
  if (input.diagnosticLog) log.info(fields);

  // A visitor profile is a record of one person across visits: only with consent.
  const analyticsRouted = routeAnalyticsEvents(context);
  if (!anonymous) routeVisitorProfile(context, analyticsRouted);
  routeFunnelEvents(context);
  routeAutomationTriggers(context);
  routeRecordingEvents(context);
  routeHeatmapEvents(context);
  routeErrorEvents(context);

  return { kind: "processed", queued, dropped };
}

/**
 * How many items the batch will queue. Zero short-circuits to `empty` before any
 * routing runs.
 *
 * Counts `heatmap_dom_snapshot` — `routeHeatmapEvents` drains that array, so leaving it
 * out made a snapshot-only flush look like nothing to do and dropped it. The controller's
 * `trackerCollectRequestItemCount` gate has to agree with this one; a batch that clears
 * there and is called empty here is data accepted and then discarded.
 */
export function trackerCollectItemCount(body: TrackerCollectBody): number {
  return lengthOf(body.events) + lengthOf(body.session) + lengthOf(body.heatmaps) +
    lengthOf(body.heatmap_screenshot) + lengthOf(body.heatmap_dom_snapshot) + lengthOf(body.errors) +
    lengthOf(body.funnels) + lengthOf(body.automations);
}

function lengthOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function eventTypes(events: unknown): string[] {
  if (!Array.isArray(events)) return [];
  return [...new Set(events.slice(0, 40)
    .map((event) => event && typeof event === "object" && "type" in event
      ? String((event as { type?: string }).type ?? "")
      : "")
    .filter(Boolean))].slice(0, 15);
}

function trackerUserAgent(body: TrackerCollectBody, header: string): string {
  if (header && !/^(bun\/|node\/|node-fetch|undici|got\/|axios\/)/i.test(header)) {
    return header;
  }

  const bodyUserAgent = typeof body.ua === "string" ? body.ua.trim() : "";
  if (bodyUserAgent) return bodyUserAgent;

  for (const event of Array.isArray(body.events) ? body.events : []) {
    const data = (event as Record<string, unknown> | null)?.data;
    const userAgent = typeof (data as Record<string, unknown> | null)?.ua === "string"
      ? ((data as Record<string, unknown>).ua as string).trim()
      : "";
    if (userAgent) return userAgent;
  }
  return header;
}
