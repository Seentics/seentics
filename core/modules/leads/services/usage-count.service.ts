import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/** Contacts across the user's websites. The key is part of the gateway's usage contract. */
export class LeadUsageCounter implements UsageCounter {
  readonly key = "leads";

  async countForUser(scope: UsageScope): Promise<number> {
    if (scope.websiteUuids.length === 0) return 0;
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c
      FROM contacts
      WHERE website_id = ANY(${scope.websiteUuids as string[]}::uuid[])
    `;
    return rows[0]?.c ?? 0;
  }
}
