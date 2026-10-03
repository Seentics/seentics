import { createHash } from "node:crypto";
import type { TrackerCollectBody } from "../interfaces";

/**
 * The anonymous id for one visitor on one website, for the salt's day: same person,
 * site and day → same id; nothing linkable across days once the salt is deleted
 * (platform/privacy/visitor-salt.ts). The IP address is hashed here and never stored.
 */
export function anonymousVisitorId(salt: Buffer, websiteId: string, ip: string, userAgent: string): string {
  const hash = createHash("sha256")
    .update(salt)
    .update("\0").update(websiteId)
    .update("\0").update(ip)
    .update("\0").update(userAgent)
    .digest("hex");
  return `h-${hash.slice(0, 32)}`;
}

/**
 * A batch from a visitor who has not consented, reduced to what needs no consent.
 *
 * Kept: page views, custom events, funnel steps, errors and heatmap clicks and scrolls —
 * each carrying the day's anonymous id (platform/privacy/visitor-salt.ts) instead of
 * whatever the browser sent. A heatmap point is a position on a page, as anonymous as a
 * page view. Removed: session recordings, layout snapshots, automation triggers, and
 * `identify()` calls — each either captures what the visitor sees, or ties them to a
 * person.
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
    heatmaps: withId(body.heatmaps),
    session: [],
    heatmap_dom_snapshot: [],
    heatmap_screenshot: [],
    automations: [],
  } as TrackerCollectBody;
}

/**
 * Whether a batch is to be anonymised: a site that asks for consent and none given — or
 * a batch the tracker itself marks anonymous (sent before it knew the site's mode, so
 * it carries no real ids). On the default `cookieless` mode consent is asked only where
 * the law asks for it (`consentRegion`); `strict` asks everyone.
 */
export function needsAnonymizing(
  consentMode: string | null | undefined,
  consentGranted: boolean,
  markedAnonymous = false,
  consentRegion = true,
): boolean {
  if (markedAnonymous) return true;
  if (consentMode === "none" || consentGranted) return false;
  return consentMode !== "cookieless" || consentRegion;
}
