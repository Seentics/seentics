import type { WebsiteQuery } from "../../modules/websites/interfaces";
import type { UsageCounter, UsageScope } from "./interfaces";

/** The report body. Keys come from the counters, so this stays an open record. */
export type UserResourceCounts = Record<string, number>;

/** Start of the current calendar month in UTC, matching the original SQL. */
function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-user usage, assembled from each module's own count.
 *
 * Replaces `getUserResourceCounts`, which held seven raw queries against six modules'
 * tables in shared code. The counters run in parallel exactly as those queries did, so
 * the request costs the same; what changed is who owns each number.
 */
export class UserUsageService {
  constructor(
    private readonly websites: WebsiteQuery,
    private readonly counters: readonly UsageCounter[],
  ) {}

  /**
   * Every counter's number for one user.
   *
   * A rejected counter yields 0 for its key rather than failing the report: this feeds
   * billing dashboards, and one module's outage should not blank the other six.
   */
  async countForUser(userId: string): Promise<UserResourceCounts> {
    const out: UserResourceCounts = {};
    for (const c of this.counters) out[c.key] = 0;

    // Kept from the original: a non-UUID would otherwise be interpolated into every
    // query. All-zeros is the right answer for a caller that passed nonsense.
    if (!UUID_RE.test(userId)) return out;

    const owned = await this.websites.listOwnedBy(userId);
    const scope: UsageScope = {
      userId,
      websiteUuids: owned.map((w) => w.id),
      websiteIds: owned.map((w) => w.id),
      monthStart: monthStartUtc(new Date()),
    };

    const results = await Promise.allSettled(
      this.counters.map((c) => c.countForUser(scope)),
    );
    results.forEach((r, i) => {
      const key = this.counters[i]!.key;
      out[key] = r.status === "fulfilled" ? Math.max(0, r.value) : 0;
    });
    return out;
  }
}
