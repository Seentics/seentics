import type { UsageCounter, UsageScope } from "../../../platform/usage";

/**
 * How many websites the user owns.
 *
 * No query: the scope was built from `listOwnedBy`, so the count is already known.
 * The original ran a separate `COUNT(*)` against `websites` for this.
 */
export class WebsiteUsageCounter implements UsageCounter {
  readonly key = "websites";

  async countForUser(scope: UsageScope): Promise<number> {
    return scope.websiteUuids.length;
  }
}
