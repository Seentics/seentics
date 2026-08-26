/**
 * Data retention.
 *
 * Retention owns the policy — how long each kind of data lives, including per-website
 * overrides — and delegates the actual deletion to each module through the
 * `RetentionPurge` port. `startDataRetentionCron` used to live here as a second
 * scheduling path; it had no callers, since `platform/scheduler.ts` registers the
 * sweep with croner, so it was removed rather than left as a divergent way to do the
 * same thing.
 */
export { RetentionService } from "./retention.service";
export type { DataCleanupStats } from "./retention.service";
export type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionRunner,
  RetentionSiteSource,
  RetentionTarget,
} from "./interfaces";
export type { WebsiteRetentionOverride } from "./overrides";
export { fetchRetentionOverrides } from "./overrides";
