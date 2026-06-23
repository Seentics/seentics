import { and, desc, eq, gte, lte, sql as dsql } from "drizzle-orm";
import { analyticsEvents, db, sql as pgSql } from "../../db";
import { countDistinctVisitorsSql, parseDays, resolveSiteId } from "./shared";

export async function getCustomEventsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  type UtmRow = { visits: number; unique_visitors: number; label: string };

  const [rows, sourceRows, mediumRows, campaignRows] = await Promise.all([
    db
      .select({
        eventType: analyticsEvents.eventType,
        c: dsql<number>`count(*)::int`,
        uniqueVisitors: countDistinctVisitorsSql(),
        uniqueSessions: dsql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, siteId),
          gte(analyticsEvents.occurredAt, start),
          lte(analyticsEvents.occurredAt, end),
          dsql`${analyticsEvents.eventType} <> 'pageview'`,
        ),
      )
      .groupBy(analyticsEvents.eventType)
      .orderBy(desc(dsql`count(*)`))
      .limit(100),

    pgSql<UtmRow[]>`
      SELECT
        utm_source AS label,
        count(*)::int AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
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
        utm_medium AS label,
        count(*)::int AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
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
        utm_campaign AS label,
        count(*)::int AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
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
    event_type: x.eventType,
    count: x.c,
    description: "",
    common_properties: {},
    sample_properties: {},
    sample_event: {},
    unique_visitors: Number(x.uniqueVisitors),
    unique_sessions: Number(x.uniqueSessions),
    engagement_rate: 0,
    expected_properties: [] as string[],
  }));

  const mapSrc  = (r: UtmRow) => ({ source:   r.label, unique_visitors: Number(r.unique_visitors ?? 0), visits: Number(r.visits ?? 0) });
  const mapMed  = (r: UtmRow) => ({ medium:   r.label, unique_visitors: Number(r.unique_visitors ?? 0), visits: Number(r.visits ?? 0) });
  const mapCamp = (r: UtmRow) => ({ campaign: r.label, unique_visitors: Number(r.unique_visitors ?? 0), visits: Number(r.visits ?? 0) });

  const sources   = sourceRows.map(mapSrc);
  const mediums   = mediumRows.map(mapMed);
  const campaigns = campaignRows.map(mapCamp);

  return {
    website_id: siteId,
    events: eventPayload,
    top_events: eventPayload,
    utm_performance: {
      sources,
      mediums,
      campaigns,
      terms:   [] as { term:    string; unique_visitors: number; visits: number }[],
      content: [] as { content: string; unique_visitors: number; visits: number }[],
      avg_ctr:          0,
      total_campaigns:  campaigns.length,
      total_sources:    sources.length,
      total_mediums:    mediums.length,
    },
    total_events:      rows.length,
    total_occurrences: rows.reduce((a, x) => a + x.c, 0),
  };
}
