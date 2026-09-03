# Seentics Core — Modular Monolith

A single deployable application composed of isolated domain modules. Modules talk
to each other through **explicit interfaces** when they need an answer, and through
**typed domain events** when they are announcing a fact.

## Layout

```
core/
├── index.ts                  Process entry: serve, migrate, health gate, signals
├── config.ts
├── app/
│   └── bootstrap.ts          Composition root — the only place the graph is wired
├── infrastructure/           Technical capability, swappable implementation
│   ├── events/               EventBus interface, typed EventMap, InMemoryEventBus
│   ├── outbox/               Transactional outbox for events that must not be lost
│   └── idempotency/          Applied-batch markers, so a retried flush cannot double-write
├── modules/                  Owns a table
│   ├── websites/             Websites, membership, public share links
│   ├── analytics/            Dashboard read models + the analytics_events writer
│   ├── ingest/               /collect buffering and the batch flush
│   ├── recordings/           Session replay capture, storage, playback
│   ├── heatmaps/
│   ├── funnels/
│   ├── automations/
│   ├── ai/                   Natural-language querying (owns ai_queries)
│   └── auth/                 Identity (owns users)
├── platform/                 Shared application concern, no business domain
│   ├── middleware/           Cross-cutting HTTP middleware
│   ├── validation/           Shared zod helpers
│   ├── lib/                  Shared utilities (s3, logger, geo, ids, types)
│   ├── scheduler.ts
│   ├── retention/            Data-retention policy; modules do their own deletes
│   ├── public-api/           The machine-facing API and the keys that open it
│   ├── internal/             Operational endpoints behind the global API key
│   └── http/                 Small composite routers (privacy, profiles, user branch)
└── db/                       Schema and migrations
```

**Placement rule.** Three questions, in order:

1. **Is it a business domain?** Then it is a module, and it owns its table. Auth owns
   `users`, so it is a module — but JWT *verification* is not a domain and lives in
   `platform/middleware/auth.ts`.
2. **Is it a technical capability whose implementation you would swap?** Then it is
   infrastructure. The event bus is in-memory today and could be Kafka tomorrow; the
   outbox could become a real queue. Code depending only on their interfaces would not
   change.
3. **Otherwise it is platform** — shared machinery with no domain of its own: middleware,
   validation, retention policy, the public API.

Owning a table does *not* decide this, though an earlier version of this document said it
did. `infrastructure` owns `outbox_events`, and `platform` owns `api_keys`; neither is a
business domain. What decides it is whether the concern *is* a domain, and whether you
would replace its implementation wholesale. `app/tests/table-ownership.test.ts` is the
authority on who may query what, and it lists both.

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
(writes) and `WebsitePublicSharing` (share links) rather than one `IWebsitesModule`
— six modules take `WebsiteQuery`, and none of them has any business being able to
delete a website. Their constructors say so.

**Split only where a consumer needs a strict subset, and name that consumer.** If you
cannot name one, it is one interface. Analytics originally had eight capability
interfaces grouped by subject matter; both of its consumers need essentially the whole
surface, so the split bought nothing and went unused. A privilege boundary
(`WebsiteQuery` vs `WebsiteMutations`, `HeatmapScreenshotCapture` vs
`HeatmapScreenshotMaintenance`) is a real reason to split. Taxonomy is not.

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
`modules/websites/tests/website.service.test.ts`, where the whole suite runs with no
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

### One website identifier

`websites.id` is the UUID primary key, and every `website_id` column holds it —
`website_members`, `funnels`, `goals`, `automations`, `analytics_events`,
`session_replays`, `heatmap_points`. Resolution happens once per request at the service
boundary; repositories receive an already-resolved id and never resolve for themselves.

This section used to describe a second identifier, `websites.site_id` — a short public
id in the tracker snippet, keying `analytics_events` and `session_replays`. That column
is gone, but code kept branching on the distinction long after: a `{ websiteId, uuid }`
pair whose two fields were assigned the same value, a per-domain table in the AI module
choosing between them, a cache warming "the other key" via
`ref === w.id ? w.id : w.id`, and a history query filtering
`website_id = uuid OR website_id = websiteId` — an OR of one value against itself, which
costs a BitmapOr instead of an index scan. All removed.

The lesson worth keeping is the one the old text ended on: both were `string`, so the
compiler could not tell them apart, and neither could it tell that they had stopped
being two things at all. A distinction carried in a type that cannot express it survives
its own deletion.

### Ports point inward

The website list embeds traffic figures, but `analytics_events` is analytics-owned.
Rather than have the websites module query that table, it declares the capability it
needs — `TrafficSummaryProvider`, in `modules/websites/interfaces/` — and analytics
implements it. The websites module never learns that `analytics_events` exists.

The consumer owns the port definition. That is what keeps the dependency arrow
pointing one way, and it is the difference between a modular monolith and a monolith
with folders.

## Known gaps

The two `lib/website-resolve` callers this section used to list are gone: `createTrackerRoutes`
is a factory now, so the tracker receives `TrackerWebsites` like anything else, and the
module itself has been deleted. The private-bus gap below it is closed too. Both are
recorded here only because the shapes are worth recognising if they come back — a
capability reached for through a module-level import because the router had no injection
point, and a service constructing its own `EventBus`.

### Event coverage

Every `EventMap` entry must have a real publisher, and every subscription must
actually be registered. Either half missing reads as a working integration point.

`analytics.batch_ingested` illustrated both failure modes. It had no publisher, so
ingest now publishes it after a durable write. It also *appeared* to have a
subscriber — but the `subscribe` call lived inside an `AutomationEventSubscriber.subscribeToIngest()`
that nothing ever called, and which by its own admission only incremented a counter:
it could not trigger an automation, because the event payload carries a site id and a
count while evaluation needs a visitor, a session and a trigger. That placeholder has
been removed rather than wired, since wiring it would have added a counter nobody
reads while still looking like a live integration.

So the event currently has a publisher and no consumer. That is a normal, honest
state — a fact worth announcing before anyone listens. What is not acceptable is the
reverse.

Three declarations were removed rather than left dangling; the reasoning is recorded
at the top of `event-map.ts` so they are not re-added on spec alone.

Still unpublished:

| Event | Blocked on |
|---|---|
| `funnel.step_reached` | ingest wiring — a step is reached in `collect-handlers` |
| `recording.completed` | the recordings engine takes no `EventBus` yet |

Consumers would have to be idempotent for anything delivered through the outbox, so
adding one is a design decision rather than a wiring task.

Nothing subscribes to most published events yet, which is fine — a fact with no
current consumer is still worth announcing. The exception to watch is the reverse:
a subscriber with no publisher.

### A private bus that swallows events

Closed. `legacyEvaluation()` and the `InMemoryEventBus` it constructed for itself are
gone; `AutomationEvaluationService` is built in `app/bootstrap.ts` and injected, so
`automation.action_executed` is published onto the real bus.

The failure mode is worth keeping in mind, because nothing about it is visible at the
call site: a service that constructs its own bus publishes successfully, to nobody. If a
module needs a bus, it takes one.

## Session recordings: what is and is not optimised

Playback fidelity is handled carefully — event ordering prefers rrweb's own
`data.timestamp` over the envelope `ts` (mixing them scrambles the timeline, since
`session_error` uses wall-clock), and page counts come from URL transitions rather
than FullSnapshots, which the tracker checkpoints every 60s.

Storage is where the cost is. A recording becomes one immutable S3 object per flush
window, and the playback endpoint presigns **every** chunk for the player:

| Session length | Objects at 10s (old) | at 30s (now) |
|---|---|---|
| 5 min | ~30 | ~10 |
| 1 hour | ~360 | ~120 |

Presigning is local HMAC, so it costs nothing server-side, but the player issues one
GET per chunk. Raising the window was the cheap 3x win; it is capped below at 5s.

**Compaction is built but not wired.** `uploadSessionBundleGzip`, `locateBundle` and
the `replay_storage: "bundle"` read branch all exist, and nothing calls the writer —
so chunk counts still grow linearly with session length. Wiring it needs two things:
a definition of when a session is finished, and a change of read precedence. Today
chunks win over the bundle, which makes compaction unsafe: a partial chunk delete
would leave the reader treating a surviving subset as the whole recording. Prefer the
bundle first and a partial delete becomes harmless.

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
