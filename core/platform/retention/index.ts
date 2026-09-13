/**
 * Data retention.
 *
 * Retention owns the policy — how long each kind of data lives, including per-website
 * overrides — and delegates the actual deletion to each module through the
 * `RetentionPurge` port. `startDataRetentionCron` used to live here as a second
 * scheduling path; it had no callers, since `app/scheduler.ts` registers the
 * sweep with croner, so it was removed rather than left as a divergent way to do the
 * same thing.
 */
export type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionRunner,
  RetentionSiteSource,
  RetentionTarget,
} from "./interfaces";

/** Shared by every `RetentionPurge` implementation — see the file for why. */
export { affectedRows } from "./affected-rows";
