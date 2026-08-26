import type { AutomationTriggerQueued } from "../../../platform/lib/types";

/**
 * The ingest write path for automation triggers.
 *
 * Declared as a port for the same reason as `AnalyticsIngestWriter`: the ingest
 * module buffers trigger rows and must be able to hand them over without importing
 * `repositories/automation-batch.repository`. That import was the last compile-time
 * edge from ingest into this module's internals, and it is what made the flush path
 * untestable without a live database.
 *
 * The barrel note about `ingestAutomationTriggersBatch` staying a plain function
 * no longer applies — ingest has a composed graph now, so the function is wrapped
 * behind this interface.
 */
export interface AutomationTriggerWriter {
  /**
   * Persist queued triggers, exactly once.
   *
   * `batchId` is stable across redeliveries; the write records it and skips a repeat, so
   * the queue's retry cannot double-count a trigger that frequency caps are charged
   * against.
   */
  writeTriggers(batchId: string, rows: AutomationTriggerQueued[]): Promise<void>;
}
