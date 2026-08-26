import type { Logger } from "../../platform/lib/logger";
import type { EventMap, EventName } from "./event-map";

/**
 * A subscriber callback. Receives the payload declared for its event in
 * `EventMap`. May be sync or async; the bus awaits the returned promise.
 */
export type EventHandler<K extends EventName> = (
  payload: EventMap[K],
) => Promise<void> | void;

/** Cancels a subscription. Calling it more than once is a no-op. */
export type Unsubscribe = () => void;

/**
 * Asynchronous, fire-and-forget communication between modules.
 *
 * Publishers announce facts; they do not learn who consumed them or whether
 * consumption succeeded. If you need an answer, call a module interface
 * directly instead — that is the synchronous path.
 *
 * This is an abstraction, not a queue. `InMemoryEventBus` is the current
 * implementation; a Kafka/Redpanda-backed one can be added behind the same
 * interface when durability or cross-process fan-out is actually needed. Code
 * that depends only on `EventBus` will not change when that happens.
 */
export interface EventBus {
  /**
   * Announce that something happened.
   *
   * Resolves once every handler has settled. A handler that throws is logged
   * and skipped — it cannot fail the publisher or prevent sibling handlers from
   * running, because the fact being announced has already happened and cannot
   * be un-happened by a broken consumer.
   */
  publish<K extends EventName>(type: K, payload: EventMap[K]): Promise<void>;

  /** Register a handler for one event type. */
  subscribe<K extends EventName>(type: K, handler: EventHandler<K>): Unsubscribe;
}

/**
 * Same-process `EventBus`.
 *
 * Delivery semantics — read these before relying on the bus for anything whose
 * loss would corrupt state:
 *
 * - **At-most-once.** No retries, no acknowledgements, no dead-letter queue. A
 *   handler that throws drops that delivery permanently.
 * - **Not durable.** Nothing is persisted. Events in flight when the process
 *   exits are gone. There is no replay and no offset to resume from.
 * - **Same process only.** Handlers registered in this process are the only
 *   consumers. Nothing crosses a process or host boundary.
 * - **Sequential per publish.** Handlers for one event run in registration
 *   order, each awaited before the next. Slow handlers delay `publish`.
 *
 * For events whose delivery must survive a crash, write the event to the
 * transactional outbox alongside the business data and let the outbox publisher
 * hand it to the bus after commit. See `infrastructure/outbox`.
 */
export class InMemoryEventBus implements EventBus {
  /**
   * Handlers keyed by event name. `Set` gives cheap unsubscribe and dedupes an
   * accidental double-registration of the same function reference.
   */
  private readonly handlers = new Map<string, Set<EventHandler<EventName>>>();

  private readonly log: Logger;

  constructor(logger: Logger) {
    this.log = logger.child({ category: "event_bus" });
  }

  async publish<K extends EventName>(type: K, payload: EventMap[K]): Promise<void> {
    const subscribers = this.handlers.get(type);
    if (!subscribers || subscribers.size === 0) return;

    // Snapshot: a handler may subscribe or unsubscribe during dispatch, and
    // mutating the live Set mid-iteration would skip or double-deliver.
    for (const handler of [...subscribers]) {
      try {
        await (handler as EventHandler<K>)(payload);
      } catch (err) {
        // Swallowed deliberately. The fact already happened; a broken consumer
        // must not fail the publisher or starve the remaining handlers.
        this.log.error({
          msg: "handler_failed",
          event: type,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  subscribe<K extends EventName>(type: K, handler: EventHandler<K>): Unsubscribe {
    let subscribers = this.handlers.get(type);
    if (!subscribers) {
      subscribers = new Set();
      this.handlers.set(type, subscribers);
    }
    subscribers.add(handler as EventHandler<EventName>);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const current = this.handlers.get(type);
      if (!current) return;
      current.delete(handler as EventHandler<EventName>);
      if (current.size === 0) this.handlers.delete(type);
    };
  }

  /** Handler count for an event. Diagnostics and tests only. */
  subscriberCount(type: EventName): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}
