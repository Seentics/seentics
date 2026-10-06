/**
 * Revenue & attribution analytics.
 *
 * Single CTE-chain query pattern (consistent with dashboard.ts, daily-stats.ts):
 *  1. Materialise raw purchase/refund events for current + prior window.
 *  2. Resolve per-purchase "last non-direct touch" attribution from session pageviews.
 *  3. Aggregate summary metrics, daily series, and all five attribution dimensions in one pass.
 *
 * Requires indexes from db/sql/004_revenue_indexes.sql for best performance.
 */
import { analyticsReadSql as pgSql } from "../../../db";
import { referrerDomainSql } from "../lib/dimension-sql";
import { arrivalPageviewSql, channelCaseSql } from "../lib/traffic-channel";
import { dashboardRows, rollupWindow, rollupsEnabled } from "../rollups/reads";
import { parseDays, sanitizeTimezone } from "./shared";
import { clampRawDays, RAW_EVENT_DAYS } from "../lib/raw-window";

function addSharePct(
  rows: Array<{ name: string; revenue: number; orders: number }>,
  totalRevenue: number,
) {
  return rows.map((r) => ({
    name: String(r.name),
    revenue: Math.round(Number(r.revenue) * 100) / 100,
    orders: Number(r.orders),
    share_pct:
      totalRevenue > 0
        ? Math.round((Number(r.revenue) / totalRevenue) * 1000) / 10
        : 0,
  }));
}

type MainRow = {
  summary: {
    total_revenue: number;
    orders: number;
    orders_with_value: number;
    unique_customers: number;
    new_cust_revenue: number | null;
  } | null;
  refund_total: number | null;
  prior: { prior_revenue: number; prior_orders: number } | null;
  sessions: number | null;
  unique_visitors: number | null;
  dominant_currency: string | null;
  daily: Array<{ day: string; revenue: number; orders: number }> | null;
  by_source: Array<{ name: string; revenue: number; orders: number }> | null;
  by_medium: Array<{ name: string; revenue: number; orders: number }> | null;
  by_campaign: Array<{ name: string; revenue: number; orders: number }> | null;
  by_product: Array<{ name: string; revenue: number; orders: number }> | null;
  by_country: Array<{ name: string; revenue: number; orders: number }> | null;
  recent_transactions: Array<{
    id: string;
    occurred_at: string;
    value: number;
    currency: string;
    product_name: string;
    order_id: string;
    source: string;
    medium: string;
    campaign: string;
    country: string | null;
    user_type: string | null;
    items: unknown;
  }> | null;
};

/** Most rows any one attribution breakdown returns. */
const DIMENSION_LIMIT = 25;

/**
 * The five attribution breakdowns, as data.
 *
 * Each was written out longhand three times — once as a CTE, once as a projection in the
 * final SELECT, once in the response mapping — and the five CTEs differed only in the
 * expression that produces `name`. That is ~60 of this file's lines saying the same thing
 * five times, and the failure mode it invites is a dimension added to two of the three
 * places.
 *
 * `expr` is static SQL written here, never anything a caller supplies, which is what
 * makes `sql.unsafe` below safe — the same pattern and the same reasoning as
 * `heatmaps/repositories/page-path-normalisation.ts`.
 */
const ATTRIBUTION_DIMENSIONS = [
  { key: "by_source", expr: "final_source" },
  { key: "by_medium", expr: "final_medium" },
  { key: "by_campaign", expr: "COALESCE(NULLIF(final_campaign, ''), '(none)')" },
  { key: "by_product", expr: "COALESCE(NULLIF(product_name, ''), '(unknown)')" },
  { key: "by_country", expr: "COALESCE(NULLIF(country, ''), 'Unknown')" },
] as const satisfies readonly { key: keyof MainRow; expr: string }[];

/**
 * `by_x AS (SELECT <expr> AS name, SUM(...), COUNT(*) FROM enriched GROUP BY 1)`, five times.
 *
 * Built once at module load rather than per request: the text never varies.
 */
const dimensionCtes = pgSql.unsafe(
  ATTRIBUTION_DIMENSIONS.map(
    (d) => `${d.key} AS (
      SELECT ${d.expr} AS name,
             COALESCE(SUM(raw_value), 0)::double precision AS revenue,
             COUNT(*)::int                                 AS orders
      FROM enriched GROUP BY 1
    )`,
  ).join(",\n    "),
);

/** The matching `json_agg` projections in the final SELECT, in the same order. */
const dimensionProjections = pgSql.unsafe(
  ATTRIBUTION_DIMENSIONS.map(
    (d) => `(SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
       FROM (SELECT name, revenue, orders FROM ${d.key} ORDER BY revenue DESC LIMIT ${DIMENSION_LIMIT}) s) AS ${d.key}`,
  ).join(",\n\n      "),
);


/**
 * The one query.
 *
 * Summary, prior period, refunds, sessions, visitors, currency, the daily series, five
 * attribution breakdowns and the recent transactions — as JSON columns on a single row,
 * from a single round trip. Splitting it into a query per section would be far easier to
 * read and would cost nine more round trips on a dashboard load, which is the trade this
 * file exists to make. `db/sql/004_revenue_indexes.sql` is what makes it fast.
 *
 * Separated from `getRevenueDashboard` so that reading the SQL and reading the
 * orchestration around it are two different acts.
 */
async function fetchRevenueRow(
  websiteId: string,
  startIso: string,
  endIso: string,
  prevStartIso: string,
  timezone: string,
  /** Site sessions and visitors from the rollups, when available — see session_cnt. */
  siteCounts: { sessions: number; visitors: number } | null = null,
  /**
   * Read orders from the orders rollup (db/sql/039) over these UTC calendar days instead
   * of from raw events. Raw events are kept 31 days; the rollup covers any range.
   */
  orders: { from: string; to: string; prevFrom: string; prevTo: string } | null = null,
): Promise<MainRow | undefined> {
  const scanRaw = siteCounts === null;
  // One query either way: each source's CTEs are gated by a bound boolean, which
  // Postgres evaluates once as a one-time filter, so the unused side costs nothing.
  const fromOrders = orders !== null;
  const w = orders ?? { from: "1970-01-01", to: "1970-01-01", prevFrom: "1970-01-01", prevTo: "1970-01-01" };
  const [row] = await pgSql<MainRow[]>`
    WITH
    -- ── Step 1: all revenue events spanning current + prior window ──────────────
    -- event_type is kept so we can apply deduplication priority in later steps.
    revenue_base AS (
      SELECT
        id::text,
        -- Legacy: seentics.track('purchase',…) was stored as event_type='custom' before ingest fix.
        -- Normalise here so all downstream CTEs see the semantic event name.
        CASE WHEN event_type = 'custom'
             THEN lower(coalesce(nullif(trim(properties->>'name'), ''), 'custom'))
             ELSE event_type
        END AS event_type,
        session_id,
        visitor_id,
        occurred_at,
        country,
        utm_source,
        utm_medium,
        utm_campaign,
        -- rev_type must use the same normalized event name as above so legacy
        -- custom refunds (event_type='custom', properties.name='refund') are
        -- classified as refunds, not purchases.
        CASE
          WHEN (CASE WHEN event_type = 'custom'
                     THEN lower(coalesce(nullif(trim(properties->>'name'), ''), 'custom'))
                     ELSE event_type
                END) IN ('refund', 'refunded') THEN 'refund'
          ELSE 'purchase'
        END AS rev_type,
        -- Extract numeric value from JSONB properties; try value → revenue → amount → total
        COALESCE(
          CASE WHEN (properties->>'value')   ~ '^-?[0-9]+(\.[0-9]+)?$'
               THEN (properties->>'value')::double precision   END,
          CASE WHEN (properties->>'revenue') ~ '^-?[0-9]+(\.[0-9]+)?$'
               THEN (properties->>'revenue')::double precision END,
          CASE WHEN (properties->>'amount')  ~ '^-?[0-9]+(\.[0-9]+)?$'
               THEN (properties->>'amount')::double precision  END,
          CASE WHEN (properties->>'total')   ~ '^-?[0-9]+(\.[0-9]+)?$'
               THEN (properties->>'total')::double precision   END,
          0.0
        ) AS raw_value,
        COALESCE(NULLIF(TRIM(UPPER(properties->>'currency')), ''), 'USD')   AS currency,
        LOWER(TRIM(COALESCE(properties->>'user_type', '')))                  AS user_type,
        COALESCE(
          NULLIF(TRIM(properties->>'product_name'), ''),
          NULLIF(TRIM(properties->>'product'), ''),
          NULLIF(TRIM(properties->>'name'), ''),
          ''
        ) AS product_name,
        COALESCE(
          NULLIF(TRIM(properties->>'order_id'), ''),
          NULLIF(TRIM(properties->>'transaction_id'), ''),
          id::text
        ) AS order_id,
        properties->'items' AS items_json
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND (
          event_type IN (
            'purchase', 'order_completed', 'checkout_completed',
            'ecommerce_purchase', 'transaction', 'refund', 'refunded'
          )
          OR (
            event_type = 'custom'
            AND lower(properties->>'name') IN (
              'purchase', 'order_completed', 'checkout_completed',
              'ecommerce_purchase', 'transaction', 'refund', 'refunded'
            )
          )
        )
        AND occurred_at >= ${prevStartIso}
        AND occurred_at <= ${endIso}
        AND ${!fromOrders}
    ),

    -- ── Step 2: partition into current / prior / refunds ─────────────────────────
    -- cur_purchases deduplicates by order_id to prevent double-counting when a site
    -- fires multiple event types for the same transaction (e.g. both 'purchase' and
    -- 'checkout_completed').  Priority: purchase > order_completed > ecommerce_purchase
    --                                  > transaction > checkout_completed.
    cur_purchases_raw AS (
      SELECT * FROM revenue_base
      WHERE occurred_at >= ${startIso} AND rev_type = 'purchase'
    ),
    cur_purchases AS (
      SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(order_id), ''), id))
        *
      FROM cur_purchases_raw
      ORDER BY
        COALESCE(NULLIF(TRIM(order_id), ''), id),
        CASE event_type
          WHEN 'purchase'           THEN 1
          WHEN 'order_completed'    THEN 2
          WHEN 'ecommerce_purchase' THEN 3
          WHEN 'transaction'        THEN 4
          WHEN 'checkout_completed' THEN 5
          ELSE 6
        END ASC,
        occurred_at DESC
    ),
    raw_refunds AS (
      SELECT * FROM revenue_base
      WHERE occurred_at >= ${startIso} AND rev_type = 'refund'
    ),
    prior_purchases_raw AS (
      SELECT * FROM revenue_base
      WHERE occurred_at < ${startIso} AND rev_type = 'purchase'
    ),
    -- Same deduplication applied to the prior window for accurate period comparison.
    raw_prior AS (
      SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(order_id), ''), id))
        *
      FROM prior_purchases_raw
      ORDER BY
        COALESCE(NULLIF(TRIM(order_id), ''), id),
        CASE event_type
          WHEN 'purchase'           THEN 1
          WHEN 'order_completed'    THEN 2
          WHEN 'ecommerce_purchase' THEN 3
          WHEN 'transaction'        THEN 4
          WHEN 'checkout_completed' THEN 5
          ELSE 6
        END ASC,
        occurred_at DESC
    ),

    -- ── Steps 3–4: each purchase's session touch, in one lookup ───────────────────
    -- The session's pageviews before the purchase are read once per purchase (one
    -- index probe, LATERAL below), and from them:
    --
    --   - the most recent pageview with a non-empty utm_source: its source, medium and
    --     campaign, together (the same row — hence the id tie-break);
    --   - failing that, the referrer domain of the most recent pageview that arrived
    --     from outside the site (Google, Reddit, …), with that pageview's channel as
    --     the medium. Internal pageviews are skipped: on a multi-page visit the latest
    --     referrer is the site's own previous page, which credited the site itself as
    --     its top revenue source. The regex strips protocol, www. and path.
    --
    -- These were two CTEs joined back to the purchases. Postgres estimated each at one
    -- row (they are ~10k on a busy site), joined them by nested loop and compared 43
    -- million pairs: 8 s for 90 days on a site with 10k purchases.
    --
    -- The lower bound on occurred_at lets each probe prune to the one or two monthly
    -- partitions the session can be in; a session idles out after 30 minutes, so a day
    -- before the purchase loses nothing real.

    -- ── Step 5: enrich purchases with final attribution ───────────────────────────
    -- Priority: session pageview UTM → purchase-event UTM → referrer domain → 'direct'
    -- When the source comes from the referrer (no UTM), medium is that pageview's
    -- channel, which distinguishes search, social and plain referral traffic.
    raw_enriched AS (
      SELECT
        p.id,
        p.occurred_at,
        p.raw_value,
        p.currency,
        p.user_type,
        p.product_name,
        p.order_id,
        p.country,
        p.visitor_id,
        p.session_id,
        p.items_json,
        COALESCE(
          NULLIF(TRIM(pa.attr_source),   ''),
          NULLIF(TRIM(p.utm_source),     ''),
          pa.attr_referrer_domain,
          'direct'
        ) AS final_source,
        COALESCE(
          NULLIF(TRIM(pa.attr_medium),   ''),
          NULLIF(TRIM(p.utm_medium),     ''),
          CASE WHEN pa.attr_referrer_domain IS NOT NULL THEN pa.attr_channel END,
          'none'
        ) AS final_medium,
        COALESCE(
          NULLIF(TRIM(pa.attr_campaign), ''),
          NULLIF(TRIM(p.utm_campaign),   ''),
          ''
        ) AS final_campaign
      FROM cur_purchases p
      LEFT JOIN LATERAL (
        SELECT
          (array_agg(t.utm_source   ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1] AS attr_source,
          (array_agg(t.utm_medium   ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1] AS attr_medium,
          (array_agg(t.utm_campaign ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1] AS attr_campaign,
          (array_agg(t.channel      ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.external))[1] AS attr_channel,
          (array_agg(t.domain       ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.external))[1] AS attr_referrer_domain
        FROM (
          SELECT s.*, (s.has_referrer AND ${pgSql.unsafe(arrivalPageviewSql("s.channel", "s.ref_host", "s.page_host"))}) AS external
          FROM (
            SELECT ae.id, ae.occurred_at, ae.utm_source, ae.utm_medium, ae.utm_campaign,
                   (ae.utm_source IS NOT NULL AND length(trim(ae.utm_source)) > 0) AS has_utm,
                   (ae.referrer IS NOT NULL AND length(trim(ae.referrer)) > 0) AS has_referrer,
                   coalesce(ae.channel, ${pgSql.unsafe(channelCaseSql("ae"))}) AS channel,
                   ${pgSql.unsafe(referrerDomainSql("ae.referrer"))} AS ref_host,
                   ${pgSql.unsafe(referrerDomainSql("ae.page"))} AS page_host,
                   NULLIF(lower(trim(regexp_replace(regexp_replace(ae.referrer, '^https?://(www\.)?', '', 'i'), '[/?#].*$', ''))), '') AS domain
            FROM analytics_events ae
            WHERE ae.website_id  = ${websiteId}
              AND ae.session_id  = p.session_id
              AND ae.event_type  = 'pageview'
              AND ae.occurred_at <= p.occurred_at
              AND ae.occurred_at >= p.occurred_at - interval '1 day'
          ) s
        ) t
      ) pa ON true
    ),

    -- ── The same three sets from the orders rollup (db/sql/039) ───────────────────
    -- The builder already deduplicated each day's purchases and attributed them
    -- (rollups/revenue-orders.ts); an order seen on two days is deduplicated here.
    orders_cur AS (
      SELECT DISTINCT ON (order_key)
        event_id AS id, occurred_at, value AS raw_value, currency, user_type, product_name,
        order_id, country, visitor_key AS visitor_id, NULL::text AS session_id, items AS items_json,
        source AS final_source, medium AS final_medium, campaign AS final_campaign
      FROM analytics_revenue_orders
      WHERE ${fromOrders} AND website_id = ${websiteId} AND kind = 'purchase'
        AND day BETWEEN ${w.from}::date AND ${w.to}::date
      ORDER BY order_key,
        CASE event_type
          WHEN 'purchase' THEN 1 WHEN 'order_completed' THEN 2 WHEN 'ecommerce_purchase' THEN 3
          WHEN 'transaction' THEN 4 WHEN 'checkout_completed' THEN 5 ELSE 6
        END, occurred_at DESC
    ),
    orders_refunds AS (
      SELECT value AS raw_value FROM analytics_revenue_orders
      WHERE ${fromOrders} AND website_id = ${websiteId} AND kind = 'refund'
        AND day BETWEEN ${w.from}::date AND ${w.to}::date
    ),
    orders_prior AS (
      SELECT DISTINCT ON (order_key) value AS raw_value
      FROM analytics_revenue_orders
      WHERE ${fromOrders} AND website_id = ${websiteId} AND kind = 'purchase'
        AND day BETWEEN ${w.prevFrom}::date AND ${w.prevTo}::date
      ORDER BY order_key,
        CASE event_type
          WHEN 'purchase' THEN 1 WHEN 'order_completed' THEN 2 WHEN 'ecommerce_purchase' THEN 3
          WHEN 'transaction' THEN 4 WHEN 'checkout_completed' THEN 5 ELSE 6
        END, occurred_at DESC
    ),

    -- Whichever source is live; the other side is empty.
    enriched AS (
      SELECT id, occurred_at, raw_value, currency, user_type, product_name, order_id,
             country::text, visitor_id, session_id, items_json, final_source, final_medium, final_campaign
      FROM raw_enriched
      UNION ALL
      SELECT id, occurred_at, raw_value, currency, user_type, product_name, order_id,
             country, visitor_id, session_id, items_json, final_source, final_medium, final_campaign
      FROM orders_cur
    ),
    cur_refunds AS (
      SELECT raw_value FROM raw_refunds UNION ALL SELECT raw_value FROM orders_refunds
    ),
    prior_purchases AS (
      SELECT raw_value FROM raw_prior UNION ALL SELECT raw_value FROM orders_prior
    ),

    -- ── Step 5: scalar aggregations ───────────────────────────────────────────────
    dom_currency AS (
      SELECT COALESCE(MAX(currency), 'USD') AS currency
      FROM (
        SELECT currency, COUNT(*) AS n FROM enriched GROUP BY currency ORDER BY n DESC LIMIT 1
      ) sub
    ),
    summary_agg AS (
      SELECT
        COALESCE(SUM(raw_value), 0)::double precision                                                  AS total_revenue,
        COUNT(*)::int                                                                                   AS orders,
        COUNT(*) FILTER (WHERE raw_value > 0)::int                                                     AS orders_with_value,
        COUNT(DISTINCT COALESCE(NULLIF(TRIM(visitor_id), ''), session_id))::int                        AS unique_customers,
        COALESCE(SUM(raw_value) FILTER (WHERE user_type = 'new'), 0)::double precision                 AS new_cust_revenue
      FROM enriched
    ),
    refund_agg AS (
      SELECT COALESCE(SUM(raw_value), 0)::double precision AS refund_total FROM cur_refunds
    ),
    prior_agg AS (
      SELECT
        COALESCE(SUM(raw_value), 0)::double precision AS prior_revenue,
        COUNT(*)::int                                  AS prior_orders
      FROM prior_purchases
    ),
    -- Site-wide sessions and visitors, for revenue per session / per visitor. Two
    -- distinct counts over every event in the window — ~18 s on a 3.8M-event site — so
    -- when the rollups hold them (siteCounts) they are passed in, and the bound
    -- \`scanRaw = false\` becomes a one-time filter that skips both scans entirely.
    session_cnt AS (
      SELECT COUNT(DISTINCT session_id)::int AS sessions
      FROM analytics_events
      WHERE ${scanRaw}
        AND website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id  IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    visitor_cnt AS (
      SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE ${scanRaw}
        AND website_id  = ${websiteId}
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
    ),

    -- ── Step 6: time series (timezone-aware) ──────────────────────────────────────
    daily_series AS (
      SELECT
        date_trunc('day', occurred_at AT TIME ZONE ${timezone})::date::text AS day,
        COALESCE(SUM(raw_value), 0)::double precision                       AS revenue,
        COUNT(*)::int                                                        AS orders
      FROM enriched
      GROUP BY 1
    ),

    -- ── Step 7: attribution dimension breakdowns ──────────────────────────────────
    ${dimensionCtes}

    -- ── Final projection: everything as JSON columns in a single row ──────────────
    SELECT
      (SELECT row_to_json(s) FROM summary_agg s)                                        AS summary,
      (SELECT refund_total   FROM refund_agg)                                            AS refund_total,
      (SELECT row_to_json(p) FROM prior_agg p)                                           AS prior,
      coalesce(${siteCounts?.sessions ?? null}::int, (SELECT sessions FROM session_cnt))             AS sessions,
      coalesce(${siteCounts?.visitors ?? null}::int, (SELECT unique_visitors FROM visitor_cnt))      AS unique_visitors,
      (SELECT currency       FROM dom_currency)                                          AS dominant_currency,

      (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
       FROM (SELECT day, revenue, orders FROM daily_series ORDER BY day ASC) d)         AS daily,

      ${dimensionProjections},

      (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
       FROM (
         SELECT
           id,
           occurred_at,
           raw_value    AS value,
           currency,
           product_name,
           order_id,
           final_source AS source,
           final_medium AS medium,
           final_campaign AS campaign,
           country,
           user_type,
           items_json   AS items
         FROM enriched
         ORDER BY occurred_at DESC
         LIMIT 50
       ) t)                                                                              AS recent_transactions
  `;
  return row;
}

export async function getRevenueDashboard(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const timezone = sanitizeTimezone(query.timezone);

  // With the rollups, orders come from the orders rollup (db/sql/039) and any range
  // works, comparison included. dashboardRows refreshes today's rollups first, orders
  // among them, so the newest purchase is counted.
  if (rollupsEnabled()) {
    const days = parseDays(query.days, 30);
    const siteCounts = await dashboardRows(websiteId, days)
      .then(({ agg, sess }) => ({ sessions: sess.session_cnt, visitors: agg.uv }));
    const w = rollupWindow(days);
    const row = await fetchRevenueRow(
      websiteId, `${w.from}T00:00:00Z`, new Date().toISOString(), `${w.prevFrom}T00:00:00Z`,
      timezone, siteCounts, w,
    );
    return row ? shapeRevenueDashboard(websiteId, days, row, true) : emptyRevenueDashboard(websiteId, days);
  }

  // Without them, from raw events, which are kept 31 days.
  const days = clampRawDays(parseDays(query.days, RAW_EVENT_DAYS));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const prevStart = new Date(start.getTime() - days * 86_400_000);
  const siteCounts = null;

  const row = await fetchRevenueRow(
    websiteId,
    start.toISOString(),
    end.toISOString(),
    prevStart.toISOString(),
    timezone,
    siteCounts,
  );

  // The prior period reaches back twice the range. Past the raw-event window (31 days,
  // lib/raw-window.ts) part of it is gone, and comparing against a half-empty period
  // reports growth that never happened — so the comparison is left out instead.
  const priorComplete = prevStart.getTime() >= end.getTime() - RAW_EVENT_DAYS * 86_400_000;

  return row ? shapeRevenueDashboard(websiteId, days, row, priorComplete) : emptyRevenueDashboard(websiteId, days);
}

/**
 * The wide single row into the response the dashboard renders.
 *
 * Pure, and lifted out of `getRevenueDashboard` for that reason: it was ~105 lines
 * trailing a 400-line query, so the two halves — one that talks to Postgres and one that
 * does arithmetic — could only be read, and only be changed, together.
 *
 * The rounding here is contract rather than presentation. Currency amounts go to the
 * cent, revenue-per-session to four places because it is routinely under a cent, and
 * share percentages to one. `refund_total` and `new_customer_revenue_pct` are omitted
 * rather than zeroed, which a client distinguishes from "zero refunds".
 */
function shapeRevenueDashboard(websiteId: string, days: number, row: MainRow, priorComplete: boolean) {
const s = row.summary ?? {
  total_revenue: 0,
  orders: 0,
  orders_with_value: 0,
  unique_customers: 0,
  new_cust_revenue: null,
};

const totalRevenue      = Number(s.total_revenue ?? 0);
const orders            = Number(s.orders ?? 0);
const ordersWithValue   = Number(s.orders_with_value ?? 0);
const uniqueCustomers   = Number(s.unique_customers ?? 0);
const newCustRevenue    = s.new_cust_revenue != null ? Number(s.new_cust_revenue) : null;
const refundTotal       = Number(row.refund_total ?? 0);
const sessions          = Number(row.sessions ?? 0);
const uniqueVisitors    = Number(row.unique_visitors ?? 0);
const currency          = String(row.dominant_currency ?? "USD");

const prior        = row.prior ?? { prior_revenue: 0, prior_orders: 0 };
const priorRevenue = Number(prior.prior_revenue ?? 0);
const priorOrders  = Number(prior.prior_orders ?? 0);
const changePct    =
  priorRevenue > 0
    ? Math.round(((totalRevenue - priorRevenue) / priorRevenue) * 1000) / 10
    : 0;

const dataQuality: "full" | "partial" | "no_revenue" =
  orders === 0
    ? "no_revenue"
    : ordersWithValue < orders
      ? "partial"
      : "full";

const aov  = orders > 0 ? totalRevenue / orders : 0;
const rps  = sessions > 0 ? totalRevenue / sessions : 0;
const arpu = uniqueVisitors > 0 ? totalRevenue / uniqueVisitors : 0;

const newCustRevenuePct =
  newCustRevenue != null && totalRevenue > 0
    ? Math.round((newCustRevenue / totalRevenue) * 1000) / 10
    : undefined;

const daily = (row.daily ?? []).map((d) => ({
  date: String(d.day),
  revenue: Math.round(Number(d.revenue) * 100) / 100,
  orders: Number(d.orders),
}));

const toRows = (arr: typeof row.by_source) =>
  addSharePct(arr ?? [], totalRevenue);

const dataNote =
  dataQuality === "no_revenue"
    ? "No purchase events found in this period. Send seentics.track('purchase', { value, currency, ... }) from your checkout flow to populate this dashboard."
    : dataQuality === "partial"
      ? "Some purchase events are missing a numeric `value` property. Add value: <number> to your seentics.track('purchase', ...) calls for complete revenue reporting."
      : undefined;

return {
  website_id: websiteId,
  days,
  data_quality: dataQuality,
  ...(dataNote ? { data_note: dataNote } : {}),
  summary: {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    currency,
    orders,
    aov: Math.round(aov * 100) / 100,
    sessions,
    revenue_per_session: Math.round(rps * 10000) / 10000,
    arpu: Math.round(arpu * 100) / 100,
    unique_customers: uniqueCustomers,
    ...(refundTotal > 0 ? { refund_total: Math.round(refundTotal * 100) / 100 } : {}),
    ...(newCustRevenuePct !== undefined ? { new_customer_revenue_pct: newCustRevenuePct } : {}),
    ...(priorComplete ? {
      prior_period: {
        total_revenue: Math.round(priorRevenue * 100) / 100,
        orders: priorOrders,
        change_pct: changePct,
      },
    } : {}),
  },
  daily,
  ...Object.fromEntries(
    ATTRIBUTION_DIMENSIONS.map((d) => [d.key, toRows(row[d.key])]),
  ),
  recent_transactions: (row.recent_transactions ?? []).map((tx) => ({
    id: String(tx.id),
    occurred_at: String(tx.occurred_at),
    value: Math.round(Number(tx.value) * 100) / 100,
    currency: String(tx.currency || "USD"),
    ...(tx.product_name ? { product_name: tx.product_name } : {}),
    ...(tx.order_id ? { order_id: tx.order_id } : {}),
    ...(tx.source ? { source: tx.source } : {}),
    ...(tx.medium ? { medium: tx.medium } : {}),
    ...(tx.campaign ? { campaign: tx.campaign } : {}),
    ...(tx.country ? { country: tx.country } : {}),
    ...(tx.user_type === "new" || tx.user_type === "returning"
      ? { user_type: tx.user_type as "new" | "returning" }
      : {}),
    ...(Array.isArray(tx.items) ? { items: tx.items } : {}),
  })),
};
}

function emptyRevenueDashboard(websiteId: string, days: number) {
  return {
    website_id: websiteId,
    days,
    data_quality: "no_revenue" as const,
    data_note:
      "No purchase events found. Send seentics.track('purchase', { value, currency, ... }) from your checkout flow to populate this dashboard.",
    summary: {
      total_revenue: 0,
      currency: "USD",
      orders: 0,
      aov: 0,
      sessions: 0,
      revenue_per_session: 0,
      arpu: 0,
      unique_customers: 0,
      prior_period: { total_revenue: 0, orders: 0, change_pct: 0 },
    },
    daily: [] as { date: string; revenue: number; orders: number }[],
    by_source: [] as { name: string; revenue: number; orders: number; share_pct: number }[],
    by_medium: [] as { name: string; revenue: number; orders: number; share_pct: number }[],
    by_campaign: [] as { name: string; revenue: number; orders: number; share_pct: number }[],
    by_product: [] as { name: string; revenue: number; orders: number; share_pct: number }[],
    by_country: [] as { name: string; revenue: number; orders: number; share_pct: number }[],
    recent_transactions: [],
  };
}
