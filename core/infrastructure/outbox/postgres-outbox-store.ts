import {
  claimPendingEvents,
  countFailed,
  countPending,
  markFailed,
  markPublished,
  prunePublished,
} from "./outbox-repository";
import type { OutboxStore } from "./outbox-publisher";

/**
 * The production `OutboxStore`, backed by Postgres.
 *
 * Separate from `outbox-publisher.ts` on purpose: this module reaches the database
 * connection through `outbox-repository`, and keeping it out of the publisher's
 * import graph is what lets the publisher be unit-tested without one.
 */
export const postgresOutboxStore: OutboxStore = {
  claimPending: claimPendingEvents,
  markPublished,
  markFailed,
  countPending,
  countParked: countFailed,
  prunePublished,
};
