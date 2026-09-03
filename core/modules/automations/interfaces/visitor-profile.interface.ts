/**
 * The visitor-profile write path, as automations offers it to the ingest edge.
 *
 * Same reason as `AutomationTriggerWriter`: ingest builds the profile row out of a
 * `/collect` batch it has already parsed, and must hand it over without importing
 * `services/visitor-profile.service`. That import was a compile-time edge from ingest
 * straight into this module's internals — the barrel note here has named
 * `VisitorProfileWriter` as the intended seam since the profile write was added, and
 * this is it.
 *
 * The write is fire-and-forget by contract, not by accident: `/collect` exists to
 * accept analytics rows, and a profile failing must not fail that request. The
 * implementation swallows and logs, so callers get a promise that does not reject.
 */

/** One visitor's profile, as ingest has it after parsing a `/collect` batch. */
export type VisitorProfileWrite = {
  websiteId: string;
  /** The tracker's visitor id (`snc_vid`), which is what conditions are keyed on. */
  anonymousId: string;
  /** Set by `seentics.identify()`; left alone when absent so a later batch cannot clear it. */
  userId?: string | null;
  /** Traits from `seentics.identify()`. Merged into `properties`, not replacing it. */
  traits?: Record<string, unknown>;
  /** Pageviews in this batch, added to the running total. */
  pageViews: number;
  /** From `ingestMeta` — already resolved for the analytics rows. */
  country?: string | null;
  region?: string | null;
  city?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  language?: string | null;
};

export interface VisitorProfileWriter {
  /**
   * Upsert one visitor's profile.
   *
   * Resolves even when the write fails — see the note above. Counters advance rather
   * than being assigned, so calling twice for the same batch double-counts; ingest
   * calls it once per `/collect`.
   */
  upsert(profile: VisitorProfileWrite): Promise<void>;
}
