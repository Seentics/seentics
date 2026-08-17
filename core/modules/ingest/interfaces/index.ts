/**
 * Public contracts for the ingest module.
 *
 * `IngestSinks` is the notable one: ingest depends on four other modules, and
 * declaring those dependencies as a port is what keeps the dependency arrow
 * pointing outward instead of ingest importing everyone's internals.
 */
export type {
  IngestFlusher,
  IngestQueue,
  IngestSinks,
} from "./ingest.interface";
