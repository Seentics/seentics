import type { AppConfig } from "../../config";
import type { LaneSpec } from "../ingest/interfaces";
import type { ConversionIngest, ConversionTrackerRow } from "./interfaces/conversions";

/**
 * Consented custom events from the tracker, on their way to the site's ad platforms.
 *
 * Its own lane so a slow platform or a burst of purchases cannot hold back pageviews. Rows are
 * small and bounded, so a count is a fair threshold. Applying a batch twice queues nothing
 * twice: the outbox is keyed on destination and event id.
 */
export function conversionsLane(ingest: () => ConversionIngest): LaneSpec {
  return {
    partitionOf: (row: { websiteId?: string }, websiteId) => row.websiteId ?? websiteId,
    apply: (batchId, _partitionKey, rows) => ingest().processEvents(batchId, rows as readonly ConversionTrackerRow[]),
    threshold: (cfg: AppConfig) => cfg.ingestQueue.maxErrorsBeforeForceFlush,
  };
}
