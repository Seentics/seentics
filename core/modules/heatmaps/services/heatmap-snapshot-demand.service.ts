import { snapshotDeviceBucket, type SnapshotDeviceBucket } from "../lib/device";
import { snapshotCheckedAt } from "../lib/layout-db";
import { heatmapPagePathForEvent } from "../lib/paths";
import type { HeatmapSnapshotDemand } from "../interfaces";

/** A background captured or confirmed within this long is current; past it, the page is asked for again. */
export const SNAPSHOT_FRESH_MS = 24 * 60 * 60 * 1000;
/**
 * How long one visitor holds the claim to capture a page. The capture is taken a few
 * seconds after load and reaches the server with the next flush, so this covers it with
 * room to spare; a visitor who leaves before capturing frees the page when it lapses.
 */
export const SNAPSHOT_CLAIM_MS = 10 * 60 * 1000;
/** Answers kept per (site, page, device), so a burst of visitors is one database read. */
const FRESH_CACHE_MS = 60 * 1000;
const MAX_ENTRIES = 50_000;

type Freshness = (websiteId: string, pagePath: string, device: SnapshotDeviceBucket) => Promise<Date | null>;

/**
 * Decides which visitor captures a page's background, so a page gets about one capture a
 * day instead of one per visitor.
 *
 * Every visitor used to capture: the tracker's only dedup was per browser tab, so a page
 * with a thousand visitors was serialized a thousand times on visitors' main threads, up
 * to 3 MB each, and uploaded from their connections. The server stored any that differed
 * from the last by a byte — which on a real page (a timestamp, a token, a name) was most.
 *
 * Now the tracker asks first. A page whose background is under a day old needs nothing;
 * otherwise the first visitor to ask is told yes and holds the page for
 * `SNAPSHOT_CLAIM_MS`, and everyone else is told no meanwhile. The daily refresh is also
 * how a bad capture (half-rendered, a pop-up over it) is replaced without anyone acting.
 *
 * In-process, like the other tracker-facing caches: one API process answers these, and a
 * second would at worst grant a second claim.
 */
export class HeatmapSnapshotDemandService implements HeatmapSnapshotDemand {
  private readonly fresh = new Map<string, { until: number }>();
  private readonly claims = new Map<string, number>();

  constructor(
    private readonly checkedAt: Freshness = snapshotCheckedAt,
    private readonly now: () => number = Date.now,
  ) {}

  async snapshotNeeded(
    websiteId: string,
    pageUrl: string,
    pageKey: string | undefined,
    userAgent: string,
  ): Promise<boolean> {
    // The same page key and device bucket the snapshot itself is stored under.
    const path = heatmapPagePathForEvent(pageUrl, pageKey ? { page_key: pageKey } : undefined);
    const device = snapshotDeviceBucket(userAgent);
    const key = `${websiteId}\0${path}\0${device}`;
    const now = this.now();

    const cached = this.fresh.get(key);
    if (cached && cached.until > now) return false;

    const claimedAt = this.claims.get(key);
    if (claimedAt !== undefined && now - claimedAt < SNAPSHOT_CLAIM_MS) return false;

    const last = await this.checkedAt(websiteId, path, device);
    if (last && now - last.getTime() < SNAPSHOT_FRESH_MS) {
      this.remember(this.fresh, key, { until: now + Math.min(FRESH_CACHE_MS, SNAPSHOT_FRESH_MS - (now - last.getTime())) });
      return false;
    }

    // Again after the read: visitors arriving together all got past the check above
    // while it was in flight, and only the first of them may have the page.
    const raced = this.claims.get(key);
    if (raced !== undefined && this.now() - raced < SNAPSHOT_CLAIM_MS) return false;
    this.remember(this.claims, key, this.now());
    return true;
  }

  private remember<V>(map: Map<string, V>, key: string, value: V): void {
    if (map.size >= MAX_ENTRIES) map.clear();
    map.set(key, value);
  }
}
