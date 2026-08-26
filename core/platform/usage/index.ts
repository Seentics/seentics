/**
 * Per-user usage reporting.
 *
 * Owns the report shape and resolves the scope; each module counts its own rows
 * through the `UsageCounter` port. See `interfaces/usage.interface.ts` for why this is
 * inverted the same way retention is.
 */
export { UserUsageService } from "./usage.service";
export type { UserResourceCounts } from "./usage.service";
export type { UsageCounter, UsageScope } from "./interfaces";
