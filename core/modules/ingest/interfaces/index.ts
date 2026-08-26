/**
 * Public contracts for the ingest module.
 *
 * `IngestSinks` is the notable one: ingest depends on four other modules, and
 * declaring those dependencies as a port is what keeps the dependency arrow
 * pointing outward instead of ingest importing everyone's internals.
 *
 * `TrackerWebsites` used to be declared here. It moved to `modules/websites` once the
 * implementation did — three modules consume it, so the provider owns the contract.
 */
export type {
  BatchQueueStore,
  IngestCategory,
  IngestFlusher,
  IngestQueue,
  IngestSinks,
  QueuedBatch,
} from "./ingest.interface";

/** The whole module surface, as a peer receives it at composition time. */
export type { IngestModule } from "./ingest.module";
