/**
 * TTL cache, in-flight dedup and timing for the dashboard's analytics reads.
 *
 * Every read in this module recomputes its aggregate from raw `analytics_events`; there
 * are no rollup tables. A 30-day dashboard therefore scans a month of rows and runs
 * `count(DISTINCT …)` over them, and it does that on every load — and then again on the
 * client's refresh interval, per open tab, per viewer. Nothing was reusing anything.
 *
 * Three things happen here, and all three matter for a different reason:
 *
 * - **Cache.** Repeat reads of the same (website, range, filters) come back without
 *   touching Postgres. The window is short, so the dashboard stays live; it only
 *   collapses the *repeats*, which is nearly all of the traffic.
 * - **In-flight dedup.** Concurrent identical reads share one query rather than each
 *   starting their own. Several panels ask for overlapping data at once and every tab
 *   refreshes on a timer, so without this a cold cache means a thundering herd against a
 *   database that has very little headroom to absorb one.
 * - **Timing.** Each miss is measured and slow ones are logged. There was no query
 *   instrumentation anywhere in the codebase, so "the dashboard is slow" could not be
 *   attributed to a specific read. Now it can.
 *
 * Deliberately in-process rather than Redis. There is one `analytics` container and no
 * `replicas:` key, so a shared cache would buy nothing today, while a Redis container
 * would take memory from a box where Postgres is already capped. The day core runs more
 * than one replica, this is the seam to swap — everything else calls `cachedRead`.
 *
 * SAFETY: the cache key is the website, never the user. That is correct only because
 * authorization happens in the controller, before the service is reached — a cache
 * consulted ahead of an access check would serve one tenant's analytics to another.
 * Keep it that way.
 */

import { env } from "../../../config";
import { MemoryCache } from "../../../platform/cache/memory-cache";
import { log as baseLog } from "../../../platform/observability/logger";

const log = baseLog.child({ category: "analytics_read" });

/** A read slower than this is worth a line in the log on its own. */
const SLOW_READ_MS = 750;

/**
 * How a read participates. `"shared"` stores the value for `analyticsCache.sharedTtlMs`;
 * `"none"` still deduplicates and times it, but keeps nothing — which is what realtime
 * wants, and what every read falls back to when the cache is off.
 */
export type CacheKind = "shared" | "none";

type Settings = { enabled: boolean; sharedTtlMs: number; maxEntries: number };

/**
 * Resolved once, not per read.
 *
 * `env()` rebuilds the entire config object on every call — re-parsing every variable and
 * re-running the production URL validations — so calling it from a request path would put
 * that work on every panel of every dashboard load. `undefined` means not yet resolved,
 * `null` means resolution failed and the cache stays off; unit tests construct these
 * services without `DATABASE_URL`, and a read is not the place to discover that.
 */
let settings: Settings | null | undefined;

function resolveSettings(): Settings | null {
  if (settings !== undefined) return settings;
  try {
    const cfg = env();
    settings = {
      enabled: cfg.analyticsCache.enabled,
      sharedTtlMs: cfg.analyticsCache.sharedTtlMs,
      maxEntries: cfg.analyticsCache.maxEntries,
    };
  } catch {
    settings = null;
  }
  return settings;
}

let cache: MemoryCache<unknown> | null = null;

/**
 * Reads currently running, by key. Holds the promise rather than the value, which is the
 * whole point: a second caller arriving mid-flight awaits the first one's query instead
 * of issuing its own.
 */
const inFlight = new Map<string, Promise<unknown>>();

function store(s: Settings): MemoryCache<unknown> | null {
  if (!s.enabled) return null;
  if (!cache) cache = new MemoryCache<unknown>(s.maxEntries);
  return cache;
}

/**
 * Stable key for a query object.
 *
 * `JSON.stringify` alone is not enough: the filters object is built from URL parameters,
 * so the same filter set can arrive with its keys in a different order and would then
 * miss a cache entry it should have hit. Sorting the keys makes the key depend on the
 * query's content rather than on how it happened to be assembled.
 */
function stableKey(op: string, websiteId: string, query: unknown): string {
  const q =
    query && typeof query === "object"
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(query as Record<string, unknown>)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          ),
        )
      : JSON.stringify(query ?? null);
  return `${op}\0${websiteId}\0${q}`;
}

/**
 * Run an analytics read through the cache, deduplicating concurrent identical calls and
 * recording how long the underlying query took.
 *
 * Deduplication and timing happen for every `kind`, including `"none"` and with the cache
 * disabled: duplicated work is the problem and storing the answer is only one way to
 * avoid it. Two callers asking the same question at the same moment should ask the
 * database once whatever the cache policy is.
 */
export async function cachedRead<T>(
  op: string,
  websiteId: string,
  query: unknown,
  kind: CacheKind,
  run: () => Promise<T>,
): Promise<T> {
  const s = resolveSettings();
  const ttlMs = kind === "shared" && s ? s.sharedTtlMs : 0;
  const c = ttlMs > 0 && s ? store(s) : null;
  const key = stableKey(op, websiteId, query);

  if (c) {
    const hit = c.get(key);
    if (hit !== undefined) return hit as T;
  }

  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const started = Date.now();
  const promise = run()
    .then((value) => {
      const ms = Date.now() - started;
      if (ms >= SLOW_READ_MS) {
        log.warn({ msg: "analytics_read_slow", op, website_id: websiteId, ms });
      } else {
        log.debug({ msg: "analytics_read", op, website_id: websiteId, ms });
      }
      // `undefined` is indistinguishable from a miss in `MemoryCache.get`, so storing it
      // would produce an entry that can never be read back.
      if (c && value !== undefined) c.set(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Drop expired entries. Called from the module's scheduler, not per request. */
export function sweepAnalyticsReadCache(): void {
  cache?.sweepExpired();
}

/** Testing seam — the cache is process-global and would otherwise leak between cases. */
export function resetAnalyticsReadCache(): void {
  cache = null;
  settings = undefined;
  inFlight.clear();
}
