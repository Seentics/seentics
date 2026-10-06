/**
 * Builds the analytics rollups (db/sql/030_analytics_rollups.sql) from raw events.
 *
 * The dashboard reads these instead of `analytics_events`: benchmarked on a site with
 * 3.8M events, recomputing from raw rows took 3–20 s per report and several 90-day
 * reports timed out, while the rollups answer the same questions from a few thousand rows.
 *
 * Rebuilt one website-day at a time: ingest marks each website-day it writes as stale,
 * and `buildStaleRollups` recomputes those days, whole, from the raw events. A day's
 * rollups are therefore always exactly what a raw-event query over that day would say,
 * apart from HyperLogLog's ~1% on unique visitors — and a late or replayed event just
 * marks its day stale again. (Postgres's MATERIALIZED VIEW would have to refresh every
 * site's entire history at once, which is why these are plain tables.)
 *
 * A rebuild is idempotent and one transaction per website-day: delete that day's rows,
 * recompute them. Days are UTC.
 */
import { sql } from "../../../db";
import { log as baseLog } from "../../../platform/observability/logger";
import { coreMetrics } from "../../../platform/observability/observe";
import { pagePathSql, referrerDomainSql, withoutVersionSql } from "../lib/dimension-sql";
import { arrivalPageviewSql, channelCaseSql } from "../lib/traffic-channel";
import { rawEventsFrom } from "../lib/raw-window";
import { rebuildRevenueOrders } from "./revenue-orders";

const log = baseLog.child({ category: "analytics_rollups" });

/**
 * HyperLogLog parameters for every visitor sketch: log2m 15, ~0.6% typical error,
 * ≤20 KB. At 13 the estimate ran 2–4% low at real traffic — see
 * db/sql/032_rollup_visitor_precision.sql. Every sketch must share these: sketches
 * of different precisions cannot be unioned.
 */
const HLL_PARAMS = "15, 5";
const VISITOR_KEY = "coalesce(nullif(trim(visitor_id), ''), session_id)";
/** Most `path` rows kept per site-day — see the path insert in rebuildWebsiteDay. */
const PATHS_PER_DAY = 1000;

const DAY_MS = 86_400_000;
const dayBound = (day: string, offsetDays: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offsetDays * DAY_MS).toISOString();
const shiftDay = (day: string, offsetDays: number) => dayBound(day, offsetDays).slice(0, 10);

/** Rebuild every rollup row for one website and one UTC day. */
export async function rebuildWebsiteDay(websiteId: string, day: string): Promise<void> {
  const dayStart = dayBound(day, 0);
  const dayEnd = dayBound(day, 1);
  // Sessions are read from this day to the end of the next — one that starts today may
  // run past midnight. One that started the evening before must not look like it started
  // today: that is checked per session against the day before (`lookBack`), through the
  // (website, session, time) index, instead of reading the whole previous day — which
  // doubled the rows every rebuild of today read.
  const lookBack = dayBound(day, -1);
  const scanTo = dayBound(day, 2);
  const u = (text: string) => sql.unsafe(text);

  await sql.begin(async (tx) => {
    await tx`SET LOCAL TIME ZONE 'UTC'`;
    // Two builders must not rebuild the same website-day at once.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${websiteId}|${day}`}, 824631010))`;

    // ── Sessions that started on this day ──────────────────────────────────────
    await tx`DELETE FROM analytics_rollup_sessions WHERE website_id = ${websiteId} AND day = ${day}::date`;
    await tx`
      WITH ev AS (
        SELECT
          session_id, event_type, occurred_at, id,
          ${u(pagePathSql("page"))} AS path,
          coalesce(channel, ${u(channelCaseSql())}) AS ch,
          ${u(referrerDomainSql("referrer"))} AS domain,
          ${u(referrerDomainSql("page"))} AS page_host,
          nullif(trim(utm_source), '') AS utm_source,
          nullif(trim(utm_medium), '') AS utm_medium,
          nullif(trim(utm_campaign), '') AS utm_campaign,
          nullif(trim(country), '') AS country,
          nullif(trim(city), '') AS city,
          nullif(trim(device), '') AS device,
          ${u(withoutVersionSql("browser"))} AS browser,
          ${u(withoutVersionSql("os"))} AS os,
          nullif(trim(language), '') AS language,
          ${u(VISITOR_KEY)} AS vk
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND occurred_at >= ${dayStart} AND occurred_at < ${scanTo}
          AND session_id IS NOT NULL AND length(trim(session_id)) > 0
      ),
      started AS (
        SELECT g.session_id FROM (
          SELECT session_id FROM ev
          GROUP BY session_id
          HAVING min(occurred_at) FILTER (WHERE event_type = 'pageview') < ${dayEnd}
        ) g
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_events prev
          WHERE prev.website_id = ${websiteId} AND prev.session_id = g.session_id
            AND prev.event_type = 'pageview'
            AND prev.occurred_at >= ${lookBack} AND prev.occurred_at < ${dayStart}
        )
      )
      INSERT INTO analytics_rollup_sessions (
        website_id, day, session_id, visitor_key, started_at, ended_at, pageviews,
        landing_path, exit_path, path_seq, channel, referrer_domain,
        utm_source, utm_medium, utm_campaign, country, city, device, browser, os, language
      )
      SELECT
        ${websiteId}, ${day}::date, e.session_id,
        max(e.vk),
        min(e.occurred_at) FILTER (WHERE e.event_type = 'pageview'),
        -- Last activity of any kind: a session whose only later action was a click lasted that long.
        max(e.occurred_at),
        count(*) FILTER (WHERE e.event_type = 'pageview'),
        (array_agg(e.path ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.path ORDER BY e.occurred_at DESC, e.id DESC) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.path ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1:3],
        -- How the session arrived: its first pageview that was an arrival at all. In-site clicks,
        -- the site's own hosts and a payment or sign-in provider the visitor was sent to and came
        -- back from are not (lib/traffic-channel.ts). This used to be the alphabetically greatest
        -- channel and domain over every pageview, so a visit that came from Google and returned from
        -- checkout was credited to the checkout, and a visit that began direct to whatever it later
        -- returned from. A session with no arrival pageview (it began before the window) is direct.
        coalesce((array_agg(e.ch ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview' AND ${u(arrivalPageviewSql("e.ch", "e.domain", "e.page_host"))}))[1], 'direct'),
        coalesce((array_agg(e.domain ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview' AND ${u(arrivalPageviewSql("e.ch", "e.domain", "e.page_host"))}))[1], 'direct'),
        (array_agg(e.utm_source ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview' AND e.utm_source IS NOT NULL))[1],
        (array_agg(e.utm_medium ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview' AND e.utm_medium IS NOT NULL))[1],
        (array_agg(e.utm_campaign ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview' AND e.utm_campaign IS NOT NULL))[1],
        (array_agg(e.country ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.city ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.device ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.browser ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.os ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1],
        (array_agg(e.language ORDER BY e.occurred_at, e.id) FILTER (WHERE e.event_type = 'pageview'))[1]
      FROM ev e
      JOIN started USING (session_id)
      GROUP BY e.session_id
    `;

    // ── Daily rows ─────────────────────────────────────────────────────────────
    await tx`DELETE FROM analytics_rollup_daily WHERE website_id = ${websiteId} AND day = ${day}::date`;

    // Pageview dimensions: every pageview on this day, by the value it carried.
    await tx`
      INSERT INTO analytics_rollup_daily (website_id, day, dimension, value, pageviews, visitors)
      SELECT ${websiteId}, ${day}::date, d.dim, d.val, count(*),
             coalesce(hll_add_agg(hll_hash_text(pv.vk), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)}))
      FROM (
        SELECT
          CASE WHEN nullif(trim(page), '') IS NOT NULL THEN ${u(pagePathSql("page"))} END AS path,
          nullif(trim(country), '') AS country,
          nullif(trim(city), '') AS city,
          nullif(trim(device), '') AS device,
          ${u(withoutVersionSql("browser"))} AS browser,
          ${u(withoutVersionSql("os"))} AS os,
          nullif(trim(language), '') AS language,
          CASE WHEN screen_width IS NOT NULL AND screen_height IS NOT NULL
               THEN screen_width::text || 'x' || screen_height::text END AS resolution,
          nullif(trim(utm_source), '') AS utm_source,
          nullif(trim(utm_medium), '') AS utm_medium,
          nullif(trim(utm_campaign), '') AS utm_campaign,
          ${u(VISITOR_KEY)} AS vk
        FROM analytics_events
        WHERE website_id = ${websiteId} AND event_type = 'pageview'
          AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
      ) pv
      CROSS JOIN LATERAL (VALUES
        ('page', pv.path),
        ('country', pv.country),
        ('city', pv.city),
        ('country_city', CASE WHEN pv.country IS NOT NULL AND pv.city IS NOT NULL THEN pv.country || '|' || pv.city END),
        ('device', pv.device),
        ('browser', pv.browser),
        ('os', pv.os),
        ('language', pv.language),
        ('resolution', pv.resolution),
        -- Pageviews that carried any UTM tag, by page and tags: [path, source, medium, campaign].
        ('page_utm', CASE WHEN pv.path IS NOT NULL
                           AND coalesce(pv.utm_source, pv.utm_medium, pv.utm_campaign) IS NOT NULL
                          THEN json_build_array(pv.path, pv.utm_source, pv.utm_medium, pv.utm_campaign)::text END)
      ) AS d(dim, val)
      WHERE d.val IS NOT NULL
      GROUP BY d.dim, d.val
    `;

    // Session dimensions: sessions that started on this day, by how they arrived and
    // where they entered and left. Their pageviews are credited to the same value.
    await tx`
      INSERT INTO analytics_rollup_daily
        (website_id, day, dimension, value, pageviews, sessions, bounces, duration_s, visitors)
      SELECT ${websiteId}, ${day}::date, d.dim, d.val,
             sum(s.pageviews), count(*), count(*) FILTER (WHERE s.pageviews = 1),
             sum(greatest(0, extract(epoch FROM s.ended_at - s.started_at)))::bigint,
             coalesce(hll_add_agg(hll_hash_text(s.visitor_key), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)}))
      FROM analytics_rollup_sessions s
      CROSS JOIN LATERAL (VALUES
        ('channel', s.channel),
        ('referrer', s.referrer_domain),
        ('utm_source', s.utm_source),
        ('utm_medium', s.utm_medium),
        ('utm_campaign', s.utm_campaign),
        ('entry_page', s.landing_path),
        ('exit_page', s.exit_path)
      ) AS d(dim, val)
      WHERE s.website_id = ${websiteId} AND s.day = ${day}::date AND d.val IS NOT NULL
      GROUP BY d.dim, d.val
    `;

    // Paths (a session's first three pages), capped at the day's top PATHS_PER_DAY by
    // sessions. Three pages combine into far more values than any other dimension —
    // ~5,000 a day on a site with 200 pages, nearly all of them a single session — and
    // path analysis only ever shows the top 50 of a window. Uncapped, a 90-day read
    // scanned 380k rows and took 2 s; a path under the cap on a day cannot be near the
    // window's top 50, which each hold hundreds of sessions a day.
    await tx`
      INSERT INTO analytics_rollup_daily
        (website_id, day, dimension, value, pageviews, sessions, bounces, duration_s, visitors)
      SELECT ${websiteId}, ${day}::date, 'path', val, pageviews, sessions, bounces, duration_s, visitors
      FROM (
        SELECT array_to_json(s.path_seq)::text AS val,
               sum(s.pageviews) AS pageviews, count(*) AS sessions,
               count(*) FILTER (WHERE s.pageviews = 1) AS bounces,
               sum(greatest(0, extract(epoch FROM s.ended_at - s.started_at)))::bigint AS duration_s,
               coalesce(hll_add_agg(hll_hash_text(s.visitor_key), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)})) AS visitors
        FROM analytics_rollup_sessions s
        WHERE s.website_id = ${websiteId} AND s.day = ${day}::date AND s.path_seq IS NOT NULL
        GROUP BY 1
        ORDER BY sessions DESC, val
        LIMIT ${PATHS_PER_DAY}
      ) p
    `;

    // Site totals: pageviews and visitors from this day's pageviews; sessions, bounces
    // and duration from the sessions that started on it.
    await tx`
      INSERT INTO analytics_rollup_daily
        (website_id, day, dimension, value, pageviews, sessions, bounces, duration_s, visitors)
      SELECT ${websiteId}, ${day}::date, 'site', '', pv.n, s.n, s.bounces, s.duration, pv.visitors
      FROM (
        SELECT count(*) AS n,
               coalesce(hll_add_agg(hll_hash_text(${u(VISITOR_KEY)}), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)})) AS visitors
        FROM analytics_events
        WHERE website_id = ${websiteId} AND event_type = 'pageview'
          AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
      ) pv,
      (
        SELECT count(*) AS n, count(*) FILTER (WHERE pageviews = 1) AS bounces,
               coalesce(sum(greatest(0, extract(epoch FROM ended_at - started_at))), 0)::bigint AS duration
        FROM analytics_rollup_sessions WHERE website_id = ${websiteId} AND day = ${day}::date
      ) s
    `;

    // Non-pageview events: occurrences, the sessions they happened in, visitors.
    await tx`
      INSERT INTO analytics_rollup_daily (website_id, day, dimension, value, pageviews, sessions, visitors)
      SELECT ${websiteId}, ${day}::date, 'event', event_type, count(*), count(DISTINCT session_id),
             coalesce(hll_add_agg(hll_hash_text(${u(VISITOR_KEY)}), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)}))
      FROM analytics_events
      WHERE website_id = ${websiteId} AND event_type <> 'pageview'
        AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
      GROUP BY event_type
    `;

    // Legacy custom events (event_type 'custom', the name in properties) by that name,
    // which is what an event goal created for them matches.
    await tx`
      INSERT INTO analytics_rollup_daily (website_id, day, dimension, value, pageviews, sessions, visitors)
      SELECT ${websiteId}, ${day}::date, 'custom_name', properties->>'name', count(*), count(DISTINCT session_id),
             coalesce(hll_add_agg(hll_hash_text(${u(VISITOR_KEY)}), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)}))
      FROM analytics_events
      WHERE website_id = ${websiteId} AND event_type = 'custom'
        AND coalesce(properties->>'name', '') <> ''
        AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
      GROUP BY properties->>'name'
    `;

    // Event properties: per event type, property and value, how often. Stored in the
    // `value` column as type, key and value joined by U+001F. Kept to scalar values of
    // at most 100 characters, the top 20 values of each property, and values seen in at
    // least two sessions that day — which also leaves out one-off identifiers (emails,
    // order ids) that would otherwise outlive the raw events in the rollups.
    await tx`
      INSERT INTO analytics_rollup_daily (website_id, day, dimension, value, pageviews, sessions, visitors)
      SELECT ${websiteId}, ${day}::date, 'event_prop', event_type || chr(31) || key || chr(31) || val,
             n, sessions, hll_empty(${u(HLL_PARAMS)})
      FROM (
        SELECT event_type, key, val, count(*) AS n, count(DISTINCT session_id) AS sessions,
               row_number() OVER (PARTITION BY event_type, key ORDER BY count(*) DESC, val) AS rank
        FROM (
          SELECT e.event_type, p.key, p.value #>> '{}' AS val, e.session_id
          FROM analytics_events e
          CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(e.properties) = 'object' THEN e.properties ELSE '{}'::jsonb END) AS p(key, value)
          WHERE e.website_id = ${websiteId} AND e.event_type <> 'pageview'
            AND e.occurred_at >= ${dayStart} AND e.occurred_at < ${dayEnd}
            AND jsonb_typeof(p.value) IN ('string', 'number', 'boolean')
            AND length(p.value #>> '{}') BETWEEN 1 AND 100
            AND length(p.key) <= 64
        ) props
        GROUP BY event_type, key, val
        HAVING count(DISTINCT session_id) >= 2
      ) ranked
      WHERE rank <= 20
    `;

    // ── Hourly site totals ─────────────────────────────────────────────────────
    await tx`
      DELETE FROM analytics_rollup_hourly
      WHERE website_id = ${websiteId} AND hour >= ${dayStart} AND hour < ${dayEnd}
    `;
    await tx`
      INSERT INTO analytics_rollup_hourly (website_id, hour, pageviews, visitors)
      SELECT ${websiteId}, date_trunc('hour', occurred_at), count(*),
             coalesce(hll_add_agg(hll_hash_text(${u(VISITOR_KEY)}), ${u(HLL_PARAMS)}), hll_empty(${u(HLL_PARAMS)}))
      FROM analytics_events
      WHERE website_id = ${websiteId} AND event_type = 'pageview'
        AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
      -- By expression, not position: column 1 is the website id.
      GROUP BY date_trunc('hour', occurred_at)
    `;

    // ── Orders, for the revenue dashboard over any range ───────────────────────
    await rebuildRevenueOrders(tx, websiteId, day, dayStart, dayEnd);

    // ── First day each visitor was seen ────────────────────────────────────────
    await tx`
      INSERT INTO analytics_rollup_visitor_first_seen (website_id, visitor_key, first_day)
      SELECT DISTINCT ${websiteId}, ${u(VISITOR_KEY)}, ${day}::date
      FROM analytics_events
      WHERE website_id = ${websiteId} AND event_type = 'pageview'
        AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
        AND ${u(VISITOR_KEY)} IS NOT NULL
      ON CONFLICT (website_id, visitor_key)
        DO UPDATE SET first_day = least(analytics_rollup_visitor_first_seen.first_day, excluded.first_day)
    `;
  });
}

/**
 * Days of session rows kept: today and the two before it. A session row is a working
 * step — rebuildWebsiteDay deletes a day's rows and recreates them from raw events, and
 * only that day's rows feed its daily rollups — so an old row is never read again.
 * Ingest accepts timestamps up to 48 h back (platform/http/client-timestamp.ts), so live
 * rebuilds stay within these days; one further back recreates its rows from raw anyway.
 * Without this the table kept a row (~600 bytes, with session and visitor ids) for every
 * session ever — the largest analytics table in the 4 GB benchmark.
 */
const SESSION_ROW_DAYS = 3;
const PRUNE_EVERY_MS = 3_600_000;
let lastPrune = 0;

async function pruneSessionRows(): Promise<void> {
  if (Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = Date.now();
  const deleted = await sql`
    DELETE FROM analytics_rollup_sessions
    WHERE day < (now() AT TIME ZONE 'UTC')::date - ${SESSION_ROW_DAYS - 1}::int
  `;
  if (deleted.count) log.info({ msg: "rollup_session_rows_pruned", rows: deleted.count });
}

/**
 * Pacing: how soon a website-day may be rebuilt again.
 *
 * A rebuild recomputes the whole day from raw events, so its cost grows with the day's
 * traffic, and a busy site is marked stale by nearly every batch. Rebuilding it on every
 * 30 s run (and on every dashboard read, rollups/reads.ts) let one large site occupy the
 * builder and Postgres for most of each interval. A day is rebuilt again only after
 * REBUILD_COST_FACTOR times its last rebuild's duration — so the builder spends at most
 * ~1/REBUILD_COST_FACTOR of its time on any one site-day — and never sooner than
 * MIN_REBUILD_GAP_MS. A small site (rebuilds of a few ms) stays fresh as of each run; a
 * site whose day takes 2 s to rebuild is at most ~40 s behind. Realtime views read raw
 * events and are unaffected. Process-local: one builder per Core process.
 */
const REBUILD_COST_FACTOR = 20;
const MIN_REBUILD_GAP_MS = 5_000;
const LAST_REBUILD_MAX = 50_000;
const lastRebuild = new Map<string, { at: number; ms: number }>();

function rebuildDue(key: string, now: number): boolean {
  const last = lastRebuild.get(key);
  return !last || now - last.at >= Math.max(MIN_REBUILD_GAP_MS, last.ms * REBUILD_COST_FACTOR);
}

function recordRebuild(key: string, ms: number): void {
  if (lastRebuild.size >= LAST_REBUILD_MAX) lastRebuild.clear();
  lastRebuild.set(key, { at: Date.now(), ms });
}

/** For tests. */
export function resetRebuildPacingForTests(): void {
  lastRebuild.clear();
}

/**
 * Rebuild every website-day ingest has marked stale, oldest first.
 *
 * A stale day also stales the day before while sessions from it can still be running:
 * a session that started at 23:50 and continued at 00:10 belongs to yesterday, and its
 * new pageviews change yesterday's session rows. Past the first hours of a day that
 * cannot happen any more, so the previous day is only rebuilt then — otherwise every
 * run would redo yesterday for every active site.
 *
 * Only markers this run covered are cleared, and only if nothing re-staled them while
 * it ran; anything newer, or any day whose rebuild failed, waits for the next run.
 *
 * `websiteId` + `recentOnly` is the read path's refresh (rollups/reads.ts): just one
 * site's today and yesterday, so a dashboard is current as of the request.
 */
export async function buildStaleRollups(
  opts: { limit?: number; websiteId?: string; recentOnly?: boolean } = {},
): Promise<{ rebuilt: number; ms: number }> {
  const t0 = performance.now();
  const limit = opts.limit ?? 1000;
  // Rollups are optional: without the `hll` extension migration 031 never ran and the
  // tables do not exist. Do nothing then; the stale markers keep (one row per
  // website-day) and are built on the first run after the extension arrives.
  const [ready] = await sql<{ ok: boolean }[]>`SELECT to_regclass('analytics_rollup_daily') IS NOT NULL AS ok`;
  if (!ready?.ok) return { rebuilt: 0, ms: 0 };
  // The scheduled run only, not a dashboard read's refresh of one site.
  if (!opts.websiteId) await pruneSessionRows();

  const recentFrom = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
  const stale = await sql<{ website_id: string; day: string; staled_at: Date }[]>`
    SELECT website_id, day::text AS day, staled_at
    FROM analytics_rollup_stale
    WHERE (${opts.websiteId ?? null}::text IS NULL OR website_id = ${opts.websiteId ?? null})
      AND (${opts.recentOnly ?? false} = false OR day >= ${recentFrom}::date)
    ORDER BY day, website_id
    LIMIT ${limit}
  `;
  if (stale.length === 0) return { rebuilt: 0, ms: 0 };

  const now = Date.now();
  const rawFrom = await rawEventsFrom();
  const targets = new Map<string, { websiteId: string; day: string }>();
  const deferred = new Set<string>();
  const add = (websiteId: string, day: string) => {
    // A rebuild deletes the day's rollups and recomputes them from raw events. Past the
    // raw retention window those events are gone, so it would wipe the day's numbers.
    if (rawFrom && day < rawFrom) return;
    const key = `${websiteId}|${day}`;
    if (!rebuildDue(key, now)) {
      deferred.add(key);
      return;
    }
    targets.set(key, { websiteId, day });
  };
  for (const row of stale) {
    if (now - Date.parse(`${row.day}T00:00:00Z`) < 6 * 3_600_000) add(row.website_id, shiftDay(row.day, -1));
    add(row.website_id, row.day);
  }
  if (rawFrom && stale.some((row) => row.day < rawFrom)) {
    log.warn({ msg: "rollup_rebuild_skipped_past_raw_retention", raw_from: rawFrom });
  }

  let rebuilt = 0;
  const failed = new Set<string>();
  for (const { websiteId, day } of [...targets.values()].sort((a, b) => a.day.localeCompare(b.day))) {
    const started = performance.now();
    try {
      await rebuildWebsiteDay(websiteId, day);
      rebuilt++;
      const ms = performance.now() - started;
      recordRebuild(`${websiteId}|${day}`, ms);
      coreMetrics.rollupRebuild.record(ms, { outcome: "ok" });
    } catch (e) {
      coreMetrics.rollupRebuild.record(performance.now() - started, { outcome: "failed" });
      // Left stale and retried next run; one bad day must not block the others.
      failed.add(`${websiteId}|${day}`);
      log.error({ msg: "rollup_rebuild_failed", website_id: websiteId, day, err: String(e) });
    }
  }

  for (const row of stale) {
    const key = `${row.website_id}|${row.day}`;
    // A paced day keeps its marker and is built on a later run.
    if (failed.has(key) || deferred.has(key)) continue;
    await sql`
      DELETE FROM analytics_rollup_stale
      WHERE website_id = ${row.website_id} AND day = ${row.day}::date AND staled_at <= ${row.staled_at}
    `;
  }

  const ms = Math.round(performance.now() - t0);
  log.info({ msg: "rollups_built", website_days: rebuilt, stale: stale.length, ms });
  return { rebuilt, ms };
}
