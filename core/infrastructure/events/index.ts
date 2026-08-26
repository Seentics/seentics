/**
 * Asynchronous module-to-module communication.
 *
 * Depend on the `EventBus` interface, never on `InMemoryEventBus` directly —
 * that is what lets the implementation change without touching module code.
 * The concrete bus is constructed once in `app/bootstrap.ts` and injected.
 */
export type { EventBus, EventHandler, Unsubscribe } from "./event-bus";
export { InMemoryEventBus } from "./event-bus";
export type { EventMap, EventName, EventPayload } from "./event-map";
