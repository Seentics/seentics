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
import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId, sanitizeTimezone } from "./shared";

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

export async function getRevenueDashboard(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days, 30);
  const timezone = sanitizeTimezone(query.timezone);
  const { siteId } = await resolveSiteId(websiteParam);

  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const prevStart = new Date(start.getTime() - days * 86_400_000);
  const endIso = end.toISOString();
  const startIso = start.toISOString();
  const prevStartIso = prevStart.toISOString();

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
      WHERE website_id = ${siteId}
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
    cur_refunds AS (
      SELECT * FROM revenue_base
      WHERE occurred_at >= ${startIso} AND rev_type = 'refund'
    ),
    prior_purchases_raw AS (
      SELECT * FROM revenue_base
      WHERE occurred_at < ${startIso} AND rev_type = 'purchase'
    ),
    -- Same deduplication applied to the prior window for accurate period comparison.
    prior_purchases AS (
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

    -- ── Step 3: last UTM-carrying pageview in the purchase session ────────────────
    -- Finds the most-recent pageview with a non-empty utm_source before the purchase.
    -- Uses ix_analytics_pageview_session_occurred for the join.
    purchase_attribution AS (
      SELECT DISTINCT ON (p.id)
        p.id            AS purchase_id,
        ae.utm_source   AS attr_source,
        ae.utm_medium   AS attr_medium,
        ae.utm_campaign AS attr_campaign
      FROM cur_purchases p
      JOIN analytics_events ae
        ON ae.website_id  = ${siteId}
       AND ae.session_id  = p.session_id
       AND ae.event_type  = 'pageview'
       AND ae.utm_source  IS NOT NULL
       AND length(trim(ae.utm_source)) > 0
       AND ae.occurred_at <= p.occurred_at
      ORDER BY p.id, ae.occurred_at DESC
    ),

    -- ── Step 4: referrer domain fallback ─────────────────────────────────────────
    -- When no UTM is found in the session, use the referrer domain of the most recent
    -- pageview before the purchase.  This correctly attributes organic traffic from
    -- Google, Reddit, Twitter, etc. instead of incorrectly labelling it 'direct'.
    -- Regex strips the protocol, optional www., and everything after the first / ? #.
    purchase_referrer AS (
      SELECT DISTINCT ON (p.id)
        p.id AS purchase_id,
        NULLIF(
          lower(trim(
            regexp_replace(
              regexp_replace(ae.referrer, '^https?://(www\.)?', '', 'i'),
              '[/?#].*$', ''
            )
          )),
          ''
        ) AS attr_referrer_domain
      FROM cur_purchases p
      JOIN analytics_events ae
        ON ae.website_id  = ${siteId}
       AND ae.session_id  = p.session_id
       AND ae.event_type  = 'pageview'
       AND ae.referrer    IS NOT NULL
       AND length(trim(ae.referrer)) > 0
       AND ae.occurred_at <= p.occurred_at
      ORDER BY p.id, ae.occurred_at DESC
    ),

    -- ── Step 5: enrich purchases with final attribution ───────────────────────────
    -- Priority: session pageview UTM → purchase-event UTM → referrer domain → 'direct'
    -- When the source comes from the referrer (no UTM), medium is set to 'organic'
    -- to distinguish it from direct and UTM-tagged paid traffic.
    enriched AS (
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
          pr.attr_referrer_domain,
          'direct'
        ) AS final_source,
        COALESCE(
          NULLIF(TRIM(pa.attr_medium),   ''),
          NULLIF(TRIM(p.utm_medium),     ''),
          CASE WHEN pr.attr_referrer_domain IS NOT NULL THEN 'organic' END,
          'none'
        ) AS final_medium,
        COALESCE(
          NULLIF(TRIM(pa.attr_campaign), ''),
          NULLIF(TRIM(p.utm_campaign),   ''),
          ''
        ) AS final_campaign
      FROM cur_purchases p
      LEFT JOIN purchase_attribution pa ON pa.purchase_id = p.id
      LEFT JOIN purchase_referrer    pr ON pr.purchase_id = p.id
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
    session_cnt AS (
      SELECT COUNT(DISTINCT session_id)::int AS sessions
      FROM analytics_events
      WHERE website_id  = ${siteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id  IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    visitor_cnt AS (
      SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id  = ${siteId}
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
    by_source AS (
      SELECT final_source AS name,
             COALESCE(SUM(raw_value), 0)::double precision AS revenue,
             COUNT(*)::int                                  AS orders
      FROM enriched GROUP BY 1
    ),
    by_medium AS (
      SELECT final_medium AS name,
             COALESCE(SUM(raw_value), 0)::double precision AS revenue,
             COUNT(*)::int                                  AS orders
      FROM enriched GROUP BY 1
    ),
    by_campaign AS (
      SELECT COALESCE(NULLIF(final_campaign, ''), '(none)') AS name,
             COALESCE(SUM(raw_value), 0)::double precision   AS revenue,
             COUNT(*)::int                                    AS orders
      FROM enriched GROUP BY 1
    ),
    by_product AS (
      SELECT COALESCE(NULLIF(product_name, ''), '(unknown)') AS name,
             COALESCE(SUM(raw_value), 0)::double precision    AS revenue,
             COUNT(*)::int                                     AS orders
      FROM enriched GROUP BY 1
    ),
    by_country AS (
      SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS name,
             COALESCE(SUM(raw_value), 0)::double precision AS revenue,
             COUNT(*)::int                                  AS orders
      FROM enriched GROUP BY 1
    )

    -- ── Final projection: everything as JSON columns in a single row ──────────────
    SELECT
      (SELECT row_to_json(s) FROM summary_agg s)                                        AS summary,
      (SELECT refund_total   FROM refund_agg)                                            AS refund_total,
      (SELECT row_to_json(p) FROM prior_agg p)                                           AS prior,
      (SELECT sessions       FROM session_cnt)                                           AS sessions,
      (SELECT unique_visitors FROM visitor_cnt)                                          AS unique_visitors,
      (SELECT currency       FROM dom_currency)                                          AS dominant_currency,

      (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
       FROM (SELECT day, revenue, orders FROM daily_series ORDER BY day ASC) d)         AS daily,

      (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
       FROM (SELECT name, revenue, orders FROM by_source   ORDER BY revenue DESC LIMIT 25) s) AS by_source,

      (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
       FROM (SELECT name, revenue, orders FROM by_medium   ORDER BY revenue DESC LIMIT 25) s) AS by_medium,

      (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
       FROM (SELECT name, revenue, orders FROM by_campaign ORDER BY revenue DESC LIMIT 25) s) AS by_campaign,

      (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
       FROM (SELECT name, revenue, orders FROM by_product  ORDER BY revenue DESC LIMIT 25) s) AS by_product,

      (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
       FROM (SELECT name, revenue, orders FROM by_country  ORDER BY revenue DESC LIMIT 25) s) AS by_country,

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

  if (!row) {
    return emptyRevenueDashboard(siteId, days);
  }

  // ── Shape the response ────────────────────────────────────────────────────────
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
    website_id: siteId,
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
      prior_period: {
        total_revenue: Math.round(priorRevenue * 100) / 100,
        orders: priorOrders,
        change_pct: changePct,
      },
    },
    daily,
    by_source: toRows(row.by_source),
    by_medium: toRows(row.by_medium),
    by_campaign: toRows(row.by_campaign),
    by_product: toRows(row.by_product),
    by_country: toRows(row.by_country),
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
