import type { OwnedWebsites } from "../../websites/interfaces";
import type { TrackingActivityReader, Verification, WebsiteVerification } from "../interfaces";

/**
 * Is the site's tracker installed and sending?
 *
 *   receiving  events in the last 24 hours
 *   stale      events before, none in the last 24 hours
 *   not_seen   never an event
 *
 * `is_verified` is the website's flag or any event ever. A recheck (`POST …/verify`) also
 * sets the flag the first time events are seen, so the dashboard's site list shows it.
 */
export class WebsiteVerificationService implements WebsiteVerification {
  constructor(private readonly deps: { websites: OwnedWebsites; activity: TrackingActivityReader }) {}

  async check(ownerId: string, websiteId: string, opts: { recheck?: boolean } = {}): Promise<Verification | null> {
    const site = await this.deps.websites.getWebsite(ownerId, websiteId);
    if (!site) return null;
    const act = (await this.deps.activity.activity([site.id])).get(site.id) ?? { lastEventAt: null, events24h: 0 };
    const seen = act.lastEventAt !== null;
    if (opts.recheck && seen && !site.isVerified) await this.deps.websites.markVerified(ownerId, site.id);
    return {
      status: act.events24h > 0 ? "receiving" : seen ? "stale" : "not_seen",
      isVerified: site.isVerified || seen,
      lastEventAt: act.lastEventAt,
      events24h: act.events24h,
    };
  }
}
