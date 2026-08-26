/**
 * Transactional outbox — durable delivery for events that must not be lost.
 *
 * Publishing straight to the event bus is fine for most facts, but it loses the
 * event if the process dies between the database COMMIT and the publish call.
 * For events where that loss would leave state inconsistent, write the event
 * inside the business transaction with `enqueueEvent` and let `OutboxPublisher`
 * deliver it after commit.
 *
 * The trade-off is at-least-once delivery instead of at-most-once: a crash
 * between publish and the published-marking replays the event, so consumers of
 * outboxed events must be idempotent.
 */
export { enqueueEvent } from "./outbox-repository";
export type { OutboxWriter, PendingOutboxEvent } from "./outbox-repository";
export {
  claimPendingEvents,
  countFailed,
  countPending,
  markFailed,
  markPublished,
  prunePublished,
} from "./outbox-repository";
export { OutboxPublisher } from "./outbox-publisher";
export type { OutboxPublisherOptions, OutboxStore } from "./outbox-publisher";
export { postgresOutboxStore } from "./postgres-outbox-store";
