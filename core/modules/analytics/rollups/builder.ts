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
import { pagePathSql, referrerDomainSql, withoutVersionSql } from "../lib/dimension-sql";
import { channelCaseSql } from "../lib/traffic-channel";

const log = baseLog.child({ category: "analytics_rollups" });

/** HyperLogLog parameters for every visitor sketch: ~1.2% typical error, ≤5 KB. */
const HLL_PARAMS = "13, 5";
const VISITOR_KEY = "coalesce(nullif(trim(visitor_id), ''), session_id)";

const DAY_MS = 86_400_000;
const dayBound = (day: string, offsetDays: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offsetDays * DAY_MS).toISOString();
const shiftDay = (day: string, offsetDays: number) => dayBound(day, offsetDays).slice(0, 10);

/** Rebuild every rollup row for one website and one UTC day. */
export async function rebuildWebsiteDay(websiteId: string, day: string): Promise<void> {
  const dayStart = dayBound(day, 0);
  const dayEnd = dayBound(day, 1);
  // Sessions are read with a day either side: one that started the evening before
  // must not look like it started today, and one that starts today may run past midnight.
  const scanFrom = dayBound(day, -1);
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
          AND occurred_at >= ${scanFrom} AND occurred_at < ${scanTo}
          AND session_id IS NOT NULL AND length(trim(session_id)) > 0
      ),
      started AS (
        SELECT session_id FROM ev
        GROUP BY session_id
        HAVING min(occurred_at) FILTER (WHERE event_type = 'pageview') >= ${dayStart}
           AND min(occurred_at) FILTER (WHERE event_type = 'pageview') < ${dayEnd}
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
        -- The dashboard's session rule (see traffic-summary / referrers): a known source
        -- wins over direct; in-site navigation never sets it.
        coalesce(max(e.ch) FILTER (WHERE e.event_type = 'pageview' AND e.ch NOT IN ('internal', 'direct')), 'direct'),
        coalesce(max(e.domain) FILTER (WHERE e.event_type = 'pageview' AND e.ch <> 'internal'), 'direct'),
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
        ('resolution', pv.resolution)
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
        ('exit_page', s.exit_path),
        ('path', array_to_json(s.path_seq)::text)
      ) AS d(dim, val)
      WHERE s.website_id = ${websiteId} AND s.day = ${day}::date AND d.val IS NOT NULL
      GROUP BY d.dim, d.val
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
 */
export async function buildStaleRollups(limit = 1000): Promise<{ rebuilt: number; ms: number }> {
  const t0 = performance.now();
  const stale = await sql<{ website_id: string; day: string; staled_at: Date }[]>`
    SELECT website_id, day::text AS day, staled_at
    FROM analytics_rollup_stale
    ORDER BY day, website_id
    LIMIT ${limit}
  `;
  if (stale.length === 0) return { rebuilt: 0, ms: 0 };

  const now = Date.now();
  const targets = new Map<string, { websiteId: string; day: string }>();
  const add = (websiteId: string, day: string) => targets.set(`${websiteId}|${day}`, { websiteId, day });
  for (const row of stale) {
    if (now - Date.parse(`${row.day}T00:00:00Z`) < 6 * 3_600_000) add(row.website_id, shiftDay(row.day, -1));
    add(row.website_id, row.day);
  }

  let rebuilt = 0;
  const failed = new Set<string>();
  for (const { websiteId, day } of [...targets.values()].sort((a, b) => a.day.localeCompare(b.day))) {
    try {
      await rebuildWebsiteDay(websiteId, day);
      rebuilt++;
    } catch (e) {
      // Left stale and retried next run; one bad day must not block the others.
      failed.add(`${websiteId}|${day}`);
      log.error({ msg: "rollup_rebuild_failed", website_id: websiteId, day, err: String(e) });
    }
  }

  for (const row of stale) {
    if (failed.has(`${row.website_id}|${row.day}`)) continue;
    await sql`
      DELETE FROM analytics_rollup_stale
      WHERE website_id = ${row.website_id} AND day = ${row.day}::date AND staled_at <= ${row.staled_at}
    `;
  }

  const ms = Math.round(performance.now() - t0);
  log.info({ msg: "rollups_built", website_days: rebuilt, stale: stale.length, ms });
  return { rebuilt, ms };
}
