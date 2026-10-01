import type { TrackerCollectBody } from "../interfaces";

/**
 * A batch from a visitor who has not consented, reduced to what needs no consent.
 *
 * Kept: page views, custom events, funnel steps and errors — each carrying the day's
 * anonymous id (platform/privacy/visitor-salt.ts) instead of whatever the browser sent.
 * Removed: session recordings, heatmaps and layout snapshots, automation triggers, and
 * `identify()` calls — each either captures what the visitor sees and does, or ties them
 * to a person.
 *
 * Done here, on the server, as well as in the tracker: a page still running an older
 * tracker from cache, or a hand-rolled integration, cannot get round it.
 */
export function anonymizeTrackerBatch(body: TrackerCollectBody, anonymousId: string): TrackerCollectBody {
  const withId = (items: unknown) =>
    (Array.isArray(items) ? items : [])
      .filter((item) => !(item && typeof item === "object" && (item as { type?: unknown }).type === "identify"))
      .map((item) => (item && typeof item === "object" ? { ...(item as object), vid: anonymousId, sid: anonymousId } : item));
  return {
    ...body,
    events: withId(body.events),
    funnels: withId(body.funnels),
    errors: withId(body.errors),
    session: [],
    heatmaps: [],
    heatmap_dom_snapshot: [],
    heatmap_screenshot: [],
    automations: [],
  } as TrackerCollectBody;
}

/** Whether a batch is to be anonymised: a site that asks for consent, and none given. */
export function needsAnonymizing(consentMode: string | null | undefined, consentGranted: boolean): boolean {
  return consentMode !== "none" && !consentGranted;
}
