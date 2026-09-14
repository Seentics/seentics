import type { AppConfig } from "../../config";
import type { LaneSpec } from "../ingest/interfaces";
import type { ErrorIngest, ErrorTrackerEvent } from "./interfaces";

/**
 * Uncaught frontend errors.
 *
 * Its own lane rather than a passenger on `analytics`, for the reason the lanes exist at
 * all: this consumer does two writes per batch, one of them an upsert with a conflict
 * clause, and a site in a throwing loop must not be able to delay another site's
 * pageviews behind it.
 *
 * A row-count threshold is enough here — unlike heatmaps, every field is bounded by the
 * tracker schema, so the widest possible row is a few kilobytes and a count is a fair
 * proxy for bytes.
 */
export function errorsLane(ingest: () => ErrorIngest): LaneSpec {
  return {
    partitionOf: (row: { websiteId?: string }, websiteId) => row.websiteId ?? websiteId,
    apply: (batchId, _partitionKey, rows) =>
      ingest().processEvents(batchId, rows as readonly ErrorTrackerEvent[]),
    threshold: (cfg: AppConfig) => cfg.ingestQueue.maxErrorsBeforeForceFlush,
  };
}
