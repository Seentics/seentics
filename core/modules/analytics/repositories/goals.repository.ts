import { sql as pgSql } from "../../../db";
import { parseDays } from "./shared";

export async function getGoalsStats(websiteId: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [siteUvRows, rows] = await Promise.all([
    pgSql<{ uv: number }[]>`
      SELECT
        COALESCE(
          count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)),
          0
        )::int AS uv
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
    `,
    pgSql<
      {
        id: string;
        name: string;
        goal_type: string;
        target: string;
        completions: number;
        unique_visitors: number;
      }[]
    >`
      WITH
      -- Two separate indexable passes instead of one OR-ed join predicate.
      -- Pageview goals: exact path equality after trailing-slash normalization
      -- (so '/a' no longer matches '/about'; '/pricing/' matches '/pricing'; root '/' works).
      pageview_hits AS (
        SELECT
          g.id AS goal_id,
          ae.id AS event_id,
          coalesce(nullif(trim(ae.visitor_id), ''), ae.session_id) AS vkey
        FROM goals g
        JOIN analytics_events ae
          ON ae.website_id = ${websiteId}
          AND ae.event_type = 'pageview'
          AND ae.occurred_at >= ${startIso}
          AND ae.occurred_at <= ${endIso}
          AND coalesce(nullif(rtrim(ae.page, '/'), ''), '/')
              = coalesce(nullif(rtrim(g.identifier, '/'), ''), '/')
        WHERE g.website_id = ${websiteId}::uuid
          AND g."type" = 'pageview'
      ),
      -- Event/click goals: matched on event_type = identifier (new data), plus the
      -- legacy shape event_type='custom' with the name in properties.
      --
      -- Two branches unioned, not one OR-ed join predicate. An OR spanning two different
      -- columns is not indexable, so the planner read *every* event in the window and
      -- re-evaluated both sides of the OR once per goal: 100k events x 6 goals of
      -- condition evaluation on a 7-day window, and it grows with the product of the two.
      -- Split, each branch takes ix_analytics_site_type_occurred and touches only the rows
      -- of the types it cares about. Measured on 400k events: 29.8ms to 5.8ms, and the rows
      -- read fell from 100,809 to 10,080.
      --
      -- UNION ALL rather than UNION: an event can only satisfy one branch, because the
      -- second requires event_type = 'custom' and the first would then need a goal whose
      -- identifier is literally 'custom'. Deduplicating would cost a sort for nothing.
      event_hits AS (
        SELECT
          g.id AS goal_id,
          ae.id AS event_id,
          coalesce(nullif(trim(ae.visitor_id), ''), ae.session_id) AS vkey
        FROM goals g
        JOIN analytics_events ae
          ON ae.website_id = ${websiteId}
          AND ae.event_type = g.identifier
          AND ae.occurred_at >= ${startIso}
          AND ae.occurred_at <= ${endIso}
        WHERE g.website_id = ${websiteId}::uuid
          AND (g."type" = 'event' OR g."type" = 'click')
        UNION ALL
        SELECT
          g.id AS goal_id,
          ae.id AS event_id,
          coalesce(nullif(trim(ae.visitor_id), ''), ae.session_id) AS vkey
        FROM goals g
        JOIN analytics_events ae
          ON ae.website_id = ${websiteId}
          AND ae.event_type = 'custom'
          AND coalesce(ae.properties->>'name', '') = g.identifier
          AND ae.occurred_at >= ${startIso}
          AND ae.occurred_at <= ${endIso}
        WHERE g.website_id = ${websiteId}::uuid
          AND (g."type" = 'event' OR g."type" = 'click')
      ),
      hits AS (
        SELECT * FROM pageview_hits
        UNION ALL
        SELECT * FROM event_hits
      )
      SELECT
        g.id::text AS id,
        g.name AS name,
        g."type" AS goal_type,
        g.identifier AS target,
        count(h.event_id)::int AS completions,
        count(DISTINCT h.vkey) FILTER (WHERE h.event_id IS NOT NULL)::int AS unique_visitors
      FROM goals g
      LEFT JOIN hits h ON h.goal_id = g.id
      WHERE g.website_id = ${websiteId}::uuid
      GROUP BY g.id, g.name, g."type", g.identifier
      ORDER BY min(g.created_at) ASC
    `,
  ]);
  const siteUv = siteUvRows[0]?.uv ?? 0;
  const denom = siteUv > 0 ? siteUv : 0;

  return {
    website_id: websiteId,
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
