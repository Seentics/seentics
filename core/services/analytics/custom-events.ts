import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getCustomEventsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const endIso   = new Date().toISOString();
  const startIso = new Date(Date.now() - days * 86400000).toISOString();

  type EventRow = { event_type: string; c: number; unique_visitors: number; unique_sessions: number };
  type UtmRow   = { label: string; visits: number; unique_visitors: number };

  const [rows, sourceRows, mediumRows, campaignRows] = await Promise.all([
    pgSql<EventRow[]>`
      SELECT
        event_type,
        count(*)::int                                                                     AS c,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int           AS unique_visitors,
        count(DISTINCT session_id)::int                                                   AS unique_sessions
      FROM analytics_events
      WHERE website_id  = ${siteId}
        AND event_type <> 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
      GROUP BY event_type
      ORDER BY c DESC
      LIMIT 100
    `,

    pgSql<UtmRow[]>`
      SELECT
        utm_source                                                                         AS label,
        count(*)::int                                                                      AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int            AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${siteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_source IS NOT NULL
        AND length(trim(utm_source)) > 0
      GROUP BY utm_source
      ORDER BY visits DESC
      LIMIT 50
    `,

    pgSql<UtmRow[]>`
      SELECT
        utm_medium                                                                         AS label,
        count(*)::int                                                                      AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int            AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${siteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_medium IS NOT NULL
        AND length(trim(utm_medium)) > 0
      GROUP BY utm_medium
      ORDER BY visits DESC
      LIMIT 50
    `,

    pgSql<UtmRow[]>`
      SELECT
        utm_campaign                                                                       AS label,
        count(*)::int                                                                      AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int            AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${siteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_campaign IS NOT NULL
        AND length(trim(utm_campaign)) > 0
      GROUP BY utm_campaign
      ORDER BY visits DESC
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
    website_id:       siteId,
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
