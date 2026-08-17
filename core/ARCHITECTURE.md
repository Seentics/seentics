# Seentics Core — Modular Monolith

A single deployable application composed of isolated domain modules. Modules talk
to each other through **explicit interfaces** when they need an answer, and through
**typed domain events** when they are announcing a fact.

## Layout

```
core/
├── app/
│   └── bootstrap.ts          Composition root — the only place the graph is wired
├── infrastructure/
│   ├── events/               EventBus interface, typed EventMap, InMemoryEventBus
│   └── outbox/               Transactional outbox for events that must not be lost
├── modules/
│   ├── websites/             Websites, membership, public share links
│   ├── analytics/            Ingestion write path + all dashboard read models
│   ├── recordings/           Session replay capture, storage, playback
│   ├── heatmaps/
│   ├── funnels/
│   └── automations/
├── db/                       Schema and migrations (shared; modules own their tables)
├── lib/                      Genuinely shared utilities (s3, logger, geo, ids)
├── middleware/               Cross-cutting HTTP middleware
└── index.ts                  HTTP server; mounts routes from the composed graph
```

Each module follows the same shape. Not every module needs every directory — an
empty `repositories/` that only re-exports is worse than no directory at all.

```
modules/<name>/
├── interfaces/     Public contracts. This is the module's API to its peers.
├── repositories/   Persistence. SQL lives here and nowhere else.
├── services/       Business logic. Coordinates repositories, publishes events.
├── validators/     Zod schemas for the HTTP surface.
├── routes.ts       HTTP handlers, exported as a factory that takes dependencies.
└── tests/
```

## The two communication paths

### Need an answer → interface

```ts
class AutomationService {
  constructor(private websites: WebsiteQuery) {}   // ← narrow interface, injected
}

const website = await this.websites.getById(websiteRef);
```

Consumers depend on the narrowest interface that covers what they use.
`modules/websites/interfaces/` exposes `WebsiteQuery` (reads), `WebsiteMutations`
(writes), `WebsitePublicSharing` (share links) and `WebsiteIngestionSettings`
(tracker config) rather than one `IWebsitesModule` — automations has no business
being able to delete a website, and its constructor should say so.

### Announcing a fact → event

```ts
await this.eventBus.publish("website.created", {
  websiteId, siteId, ownerId, url, occurredAt: new Date(),
});
```

Every event is declared in `infrastructure/events/event-map.ts`, keyed by its wire
name with the exact payload shape. `publish` is typed against that map, so a typo
in the name or a missing field is a compile error rather than a silently dropped
event. Names are `<module>.<fact_in_past_tense>` — facts that already happened,
never commands.

**Publishers do not learn who consumed an event or whether consumption succeeded.**
A handler that throws is logged and skipped; it cannot fail the publisher or starve
sibling handlers, because the fact has already happened and cannot be un-happened
by a broken consumer.

## The event bus is not Kafka

`InMemoryEventBus` is the current implementation. Its actual guarantees:

| | |
|---|---|
| Delivery | **At-most-once.** No retries, no acks, no dead-letter queue. |
| Durability | **None.** Events in flight when the process exits are gone. |
| Scope | **Same process only.** Nothing crosses a process boundary. |
| Ordering | Sequential per publish, in handler registration order. |

There are no partitions, offsets, consumer groups, retention, or replay. Code
depends on the `EventBus` *interface*, so a Kafka/Redpanda-backed implementation can
be added behind it when workload or reliability actually demands one — but adding
that implementation is the only thing that would make the guarantees above change.

## Events that must not be lost: the outbox

Publishing straight to the bus loses the event if the process dies between the
database COMMIT and the publish call. For events where that loss would leave state
inconsistent, write the event *inside* the business transaction:

```ts
await db.transaction(async (tx) => {
  const [row] = await tx.insert(websites).values(…).returning();
  await enqueueEvent(tx, "website", row.id, "website.created", { … });
});
```

`OutboxPublisher` polls unpublished rows and hands them to the bus after commit.
The trade-off is **at-least-once** instead of at-most-once: a crash between publish
and the published-marking replays the event, so **consumers of outboxed events must
be idempotent**. A row that keeps failing is retried up to `maxAttempts` and then
parked, so one poison payload cannot stall the queue — alert on `stats().parked`.

Use the outbox when losing the event breaks something. Skip it for high-volume
informational events (individual pageviews); the cost is a database write per event.

## Dependency direction

```
HTTP → routes → services → interfaces ← implementations → infrastructure
```

Business logic depends on interfaces, never on Postgres, S3, or Hono. That is what
makes services unit-testable with in-memory doubles — see
`tests/modules/websites/website.service.test.ts`, where the whole suite runs with no
database.

## Composition, not service location

`app/bootstrap.ts` is the only place that knows how the graph fits together.
Everything a module needs arrives through its constructor; nothing reaches back into
a registry at call time. A dependency cycle here is a compile error.

```ts
const websites = new WebsiteService(websiteRepository, trafficSummary, eventBus);
const analytics = new AnalyticsQueryService(websiteQuery);
```

Routes are factories (`createAnalyticsRoutes({ … })`) rather than module-level
singletons, so the same handlers can run against stubbed services in a test.

## Two patterns worth knowing before you change anything

### The two website identifiers

`websites.id` is the UUID primary key — it keys `website_members`, `funnels`,
`goals`, `automations`. `websites.site_id` is the short public id in the tracker
snippet — it keys `analytics_events` and `session_replays`.

Most API paths accept either and resolve to the pair. **Both are `string`, so
mixing them up is invisible to the compiler and shows up as an endpoint that
silently returns nothing.** Resolution happens once per request at the service
boundary; repositories receive already-resolved ids and never resolve for
themselves.

### Ports point inward

The website list embeds traffic figures, but `analytics_events` is analytics-owned.
Rather than have the websites module query that table, it declares the capability it
needs — `TrafficSummaryProvider`, in `modules/websites/interfaces/` — and analytics
implements it. The websites module never learns that `analytics_events` exists.

The consumer owns the port definition. That is what keeps the dependency arrow
pointing one way, and it is the difference between a modular monolith and a monolith
with folders.

## Known gaps

Two places still call `lib/website-resolve` directly instead of going through the
`WebsiteQuery` port, and both have the same cause: their only caller is the tracker
path, which is a module-level router not composed through `app/bootstrap.ts` and so
has nowhere to receive an injected port from.

| Where | Called by |
|---|---|
| `captureHeatmapScreenshot` in `modules/heatmaps/services/screenshot.service.ts` | `routes/tracker.ts` |
| the batch flush in `modules/recordings/services/recording-engine.service.ts` | `services/ingest/queues.ts` |

Both are marked in their own doc comments. Modularising ingest and the tracker is
what closes them — until then, do not copy the pattern into new code.

### Event coverage

Every `EventMap` entry must have a real publisher. An entry without one reads as a
working integration point to anyone who subscribes, which is worse than its absence
— `analytics.batch_ingested` had exactly that problem: automation evaluation
subscribed to it while nothing published it, so the whole wire was dead.

Three declarations were removed rather than left dangling; the reasoning is recorded
at the top of `event-map.ts` so they are not re-added on spec alone.

Still unpublished:

| Event | Blocked on |
|---|---|
| `funnel.step_reached` | ingest wiring — a step is reached in `collect-handlers` |
| `recording.completed` | the recordings engine takes no `EventBus` yet |

Nothing subscribes to most published events yet, which is fine — a fact with no
current consumer is still worth announcing. The exception to watch is the reverse:
a subscriber with no publisher.

### A private bus that swallows events

`legacyEvaluation()` in `modules/automations/services/evaluate.service.ts`
constructs its own `InMemoryEventBus`, so `automation.action_executed` published
through that path reaches nobody. It survives because the event that matters,
`automation.triggered`, goes through the outbox instead. The fix is to construct
`AutomationEvaluationService` in `app/bootstrap.ts` and inject it once the tracker
routes are composed.

## Adding a module

1. Write `interfaces/` first — the contract, split by capability. If an interface
   has more than about five methods, it is probably two interfaces.
2. Put SQL in `repositories/`, coordination in `services/`.
3. Export routes as a factory taking dependencies.
4. Declare any new events in `infrastructure/events/event-map.ts`.
5. Wire it in `app/bootstrap.ts`.
6. Test the service against in-memory fakes of your own interfaces.

## Future service extraction

A module interface can eventually be implemented by a remote client:

```
WebsiteQuery
    ├── WebsiteService          (in-process, today)
    └── RemoteWebsiteClient     (HTTP/gRPC, if ever needed)
```

Interfaces make extraction *easier*. They do not make distributed systems free —
network failures, timeouts, retries, idempotency, serialization, versioning and
distributed tracing all arrive with the first remote call. Extract when there is a
reason to, not because the seam exists.
