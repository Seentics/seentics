# Seentics Core — Modular Monolith

A single deployable application composed of isolated domain modules. Modules talk
to each other through **explicit interfaces**, injected at composition time — never
through a registry, a singleton, or an event bus.

## Layout

```
core/
├── index.ts                  Process entry: serve, migrate, health gate, signals
├── config.ts
├── app/
│   └── bootstrap.ts          Composition root — the only place the graph is wired
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
│   ├── idempotency/          Applied-batch markers, so a retried flush cannot double-write
│   ├── lib/                  Shared utilities (s3, logger, geo, ids, types)
│   ├── scheduler.ts
│   ├── retention/            Data-retention policy; modules do their own deletes
│   ├── public-api/           The machine-facing API and the keys that open it
│   ├── internal/             Operational endpoints behind the global API key
│   └── http/                 Small composite routers (privacy, profiles, user branch)
└── db/                       Schema and migrations
```

**Placement rule.** Two questions, in order:

1. **Is it a business domain?** Then it is a module, and it owns its table. Auth owns
   `users`, so it is a module — but JWT *verification* is not a domain and lives in
   `platform/middleware/auth.ts`.
2. **Otherwise it is platform** — shared machinery with no domain of its own: middleware,
   validation, retention policy, the public API, the applied-batch markers.

There used to be a third tier, `infrastructure/`, for "a technical capability whose
implementation you would swap". It held three things. Two of them — an in-memory event bus
and a transactional outbox — were removed once it was measured what they did: thirteen
publish sites, one subscriber, and that subscriber invalidated a cache. The third,
`idempotency/`, is not swappable at all; it is a marker row in a Postgres table, and by the
tier's own criterion it never belonged there. A directory tier is an expensive way to carry
one bit of information, and that bit was wrong for the only thing left in it.

Owning a table does *not* decide placement, though an earlier version of this document said
it did. `platform` owns `api_keys` and `ingest_applied_batches`; neither is a business
domain. `app/tests/table-ownership.test.ts` is the authority on who may query what.

Each module follows the same shape. Not every module needs every directory — an
empty `repositories/` that only re-exports is worse than no directory at all.

```
modules/<name>/
├── interfaces/     Public contracts. This is the module's API to its peers.
├── repositories/   Persistence. SQL lives here and nowhere else.
├── services/       Business logic. Coordinates repositories.
├── validators/     Zod schemas for the HTTP surface.
├── routes.ts       HTTP handlers, exported as a factory that takes dependencies.
└── tests/
```

## How modules talk

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

### Announcing a fact → a direct call

There is no event bus. A module that needs to tell another module something calls it,
through a narrow injected function or interface:

```ts
new WebsiteService(repository, analytics, (websiteId) => cached.invalidate(websiteId));
```

This is the one place the previous design's decoupling was actually load-bearing, and it
is worth knowing what it cost. A `website.updated` fact travelled: repository → a row in a
transactional outbox table → a publisher polling that table once a second → an in-memory
event bus → a subscriber in `websites/init.ts` → `cached.invalidate()`. Four moving parts
and a database table, inside one process, to deliver one function call.

Thirteen call sites published events. **One** subscriber existed. Ten of the thirteen
announced facts to nobody at all, and the three that were consumed were all consumed by
that one cache invalidation — which has a five-minute TTL behind it, so losing one costs
five minutes of staleness and never needed the outbox's durability guarantee.

If a genuine second consumer of a fact ever appears — automations reacting to ingest is the
plausible one — reintroduce a bus then, for that fact, with a subscriber that exists. The
seam is one constructor parameter wide.

## Dependency direction

```
HTTP → routes → services → interfaces ← implementations → platform
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
const websites = new WebsiteService(websiteRepository, trafficSummary, onWebsiteChanged);
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
point.

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
