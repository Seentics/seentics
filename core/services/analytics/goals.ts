import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getGoalsStats(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId, uuid } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const siteUvRows = await pgSql<{ uv: number }[]>`
    SELECT
      COALESCE(
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)),
        0
      )::int AS uv
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND occurred_at <= ${endIso}
  `;
  const siteUv = siteUvRows[0]?.uv ?? 0;
  const denom = siteUv > 0 ? siteUv : 0;

  const rows = await pgSql<
    {
      id: string;
      name: string;
      goal_type: string;
      target: string;
      completions: number;
      unique_visitors: number;
    }[]
  >`
    SELECT
      g.id::text AS id,
      g.name AS name,
      g."type" AS goal_type,
      g.identifier AS target,
      count(ae.id)::int AS completions,
      count(
        DISTINCT coalesce(nullif(trim(ae.visitor_id), ''), ae.session_id)
      ) FILTER (WHERE ae.id IS NOT NULL)::int AS unique_visitors
    FROM goals g
    LEFT JOIN analytics_events ae
      ON ae.website_id = ${siteId}
      AND ae.occurred_at >= ${startIso}
      AND ae.occurred_at <= ${endIso}
      AND (
        (
          g."type" = 'pageview'
          AND ae.event_type = 'pageview'
          AND (
            ae.page = g.identifier
            OR strpos(lower(coalesce(ae.page, '')), lower(g.identifier)) > 0
          )
        )
        OR (
          (g."type" = 'event' OR g."type" = 'click')
          AND (
            -- New data: ingest promotes data.name to event_type (e.g. 'button_click')
            ae.event_type = g.identifier
            -- Legacy data: stored as event_type='custom' with name in properties
            OR (ae.event_type = 'custom' AND coalesce(ae.properties->>'name', '') = g.identifier)
          )
        )
      )
    WHERE g.website_id = ${uuid}::uuid
    GROUP BY g.id, g.name, g."type", g.identifier
    ORDER BY min(g.created_at) ASC
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    goals: rows.map((r) => {
      const uv = Number(r.unique_visitors ?? 0);
      const rate = denom > 0 ? Math.round((uv / denom) * 1000) / 10 : 0;
      return {
        id: r.id,
        name: r.name,
        goal_type: r.goal_type,
        target: r.target,
        completions: Number(r.completions ?? 0),
        unique_visitors: uv,
        conversion_rate: rate,
      };
    }),
  };
}
