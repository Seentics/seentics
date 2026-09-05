import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getCustomEventsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const endIso   = new Date().toISOString();
  const startIso = windowStartIso(days);

  type EventRow = { event_type: string; c: number; unique_visitors: number; unique_sessions: number };
  type UtmRow   = { label: string; visits: number; unique_visitors: number };

  const [rows, sourceRows, mediumRows, campaignRows] = await Promise.all([
    /*
     * Everything but pageviews, by type.
     *
     * `COLLATE "C"` on the three text keys, applied in a projection subquery so the
     * grouping and both `DISTINCT` sorts use it. The database runs `en_US.utf8`, and the
     * cost of this query is almost entirely text comparison — a sort of the window by
     * `event_type`, then a per-group sort of the visitor key and another of the session id
     * for the two `count(DISTINCT)`s. Under `C` those are byte comparisons: 33ms to 19ms on
     * 400k events, verified to return identical rows.
     *
     * Safe because collations are deterministic, so equality — which is all grouping and
     * `DISTINCT` need — is bytewise under either one. The only thing a collation changes is
     * *order*, and the ordering here is by count.
     *
     * The `<>` is not indexable and there is no point pretending otherwise: a partial index
     * on `event_type <> 'pageview'` was tried and the planner declined it, then measured
     * slower when forced, because the bitmap scan it prefers is already cheap. What is left
     * after the collation fix is the two distinct counts, which are the floor for this shape.
     */
    pgSql<EventRow[]>`
      SELECT
        event_type,
        count(*)::int                        AS c,
        count(DISTINCT vkey)::int            AS unique_visitors,
        count(DISTINCT sid)::int             AS unique_sessions
      FROM (
        SELECT
          event_type::text COLLATE "C"                                        AS event_type,
          coalesce(nullif(trim(visitor_id), ''), session_id) COLLATE "C"      AS vkey,
          session_id COLLATE "C"                                             AS sid
        FROM analytics_events
        WHERE website_id  = ${websiteId}
          AND event_type <> 'pageview'
          AND occurred_at >= ${startIso}
          AND occurred_at <= ${endIso}
      ) s
      GROUP BY event_type
      ORDER BY c DESC, event_type ASC
      LIMIT 100
    `,

    pgSql<UtmRow[]>`
      SELECT
        utm_source                                                                         AS label,
        count(*)::int                                                                      AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int            AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_source IS NOT NULL
        AND length(trim(utm_source)) > 0
      GROUP BY utm_source
      ORDER BY visits DESC, label ASC
      LIMIT 50
    `,

    pgSql<UtmRow[]>`
      SELECT
        utm_medium                                                                         AS label,
        count(*)::int                                                                      AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int            AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_medium IS NOT NULL
        AND length(trim(utm_medium)) > 0
      GROUP BY utm_medium
      ORDER BY visits DESC, label ASC
      LIMIT 50
    `,

    pgSql<UtmRow[]>`
      SELECT
        utm_campaign                                                                       AS label,
        count(*)::int                                                                      AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int            AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_campaign IS NOT NULL
        AND length(trim(utm_campaign)) > 0
      GROUP BY utm_campaign
      ORDER BY visits DESC, label ASC
      LIMIT 50
    `,
  ]);

  const eventPayload = rows.map((x) => ({
    event_type:          x.event_type,
    count:               x.c,
    description:         "",
    common_properties:   {},
    sample_properties:   {},
    sample_event:        {},
    unique_visitors:     Number(x.unique_visitors),
    unique_sessions:     Number(x.unique_sessions),
    engagement_rate:     0,
    expected_properties: [] as string[],
  }));

  const sources   = sourceRows.map((r)   => ({ source:   r.label, unique_visitors: Number(r.unique_visitors ?? 0), visits: Number(r.visits ?? 0) }));
  const mediums   = mediumRows.map((r)   => ({ medium:   r.label, unique_visitors: Number(r.unique_visitors ?? 0), visits: Number(r.visits ?? 0) }));
  const campaigns = campaignRows.map((r) => ({ campaign: r.label, unique_visitors: Number(r.unique_visitors ?? 0), visits: Number(r.visits ?? 0) }));

  return {
    website_id:       websiteId,
    events:           eventPayload,
    top_events:       eventPayload,
    utm_performance: {
      sources,
      mediums,
      campaigns,
      terms:           [] as { term:    string; unique_visitors: number; visits: number }[],
      content:         [] as { content: string; unique_visitors: number; visits: number }[],
      avg_ctr:         0,
      total_campaigns: campaigns.length,
      total_sources:   sources.length,
      total_mediums:   mediums.length,
    },
    total_events:      rows.length,
    total_occurrences: rows.reduce((a, x) => a + x.c, 0),
  };
}
