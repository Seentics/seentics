import type { UsageCounter, UsageScope } from "../../../platform/usage";
import { countSince } from "../repositories/submission.repository";

/**
 * Form submissions this calendar month, across the user's websites.
 *
 * The key is part of the gateway's usage contract, and is what the `leads` plan limit is
 * measured against. A submission counts when it is stored, whether or not any destination
 * was connected.
 */
export class LeadUsageCounter implements UsageCounter {
  readonly key = "leads";

  countForUser(scope: UsageScope): Promise<number> {
    return countSince(scope.websiteUuids, scope.monthStart);
  }
}
