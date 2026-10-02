import type { TransactionSql } from "postgres";
import { channelCaseSql } from "../lib/traffic-channel";

/**
 * One website-day's orders into `analytics_revenue_orders` (db/sql/039), for the
 * revenue dashboard to read over any range.
 *
 * The same rules as the dashboard's raw query (repositories/revenue.repository.ts),
 * which still serves a Postgres without the rollups and must stay in step with this:
 *
 *   - purchase-like event types (and the legacy `custom` shape with the name in
 *     properties) are purchases; `refund` / `refunded` are refunds;
 *   - the value is the first numeric of properties value → revenue → amount → total;
 *   - purchases are deduplicated by order id, preferring purchase > order_completed >
 *     ecommerce_purchase > transaction > checkout_completed, then the latest;
 *   - attribution is the session's last pageview with a UTM source before the purchase,
 *     else the purchase event's own UTM, else the last external referrer domain (its
 *     channel as the medium), else direct.
 *
 * Runs inside rebuildWebsiteDay's transaction, while the day's raw events exist (they
 * are kept 31 days; a day is rebuilt within its first two).
 */
export async function rebuildRevenueOrders(
  tx: TransactionSql,
  websiteId: string,
  day: string,
  dayStart: string,
  dayEnd: string,
): Promise<void> {
  const u = (text: string) => tx.unsafe(text);
  await tx`DELETE FROM analytics_revenue_orders WHERE website_id = ${websiteId} AND day = ${day}::date`;
  await tx`
    WITH base AS (
      SELECT
        id::text AS id,
        CASE WHEN event_type = 'custom'
             THEN lower(coalesce(nullif(trim(properties->>'name'), ''), 'custom'))
             ELSE event_type
        END AS event_type,
        session_id, visitor_id, occurred_at, country, utm_source, utm_medium, utm_campaign,
        COALESCE(
          CASE WHEN (properties->>'value')   ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (properties->>'value')::double precision   END,
          CASE WHEN (properties->>'revenue') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (properties->>'revenue')::double precision END,
          CASE WHEN (properties->>'amount')  ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (properties->>'amount')::double precision  END,
          CASE WHEN (properties->>'total')   ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (properties->>'total')::double precision   END,
          0.0
        ) AS raw_value,
        COALESCE(NULLIF(TRIM(UPPER(properties->>'currency')), ''), 'USD') AS currency,
        LOWER(TRIM(COALESCE(properties->>'user_type', '')))                AS user_type,
        COALESCE(NULLIF(TRIM(properties->>'product_name'), ''), NULLIF(TRIM(properties->>'product'), ''),
                 NULLIF(TRIM(properties->>'name'), ''), '')                AS product_name,
        COALESCE(NULLIF(TRIM(properties->>'order_id'), ''), NULLIF(TRIM(properties->>'transaction_id'), ''),
                 id::text)                                                  AS order_id,
        properties->'items' AS items_json
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND occurred_at >= ${dayStart} AND occurred_at < ${dayEnd}
        AND (
          event_type IN ('purchase', 'order_completed', 'checkout_completed', 'ecommerce_purchase',
                         'transaction', 'refund', 'refunded')
          OR (event_type = 'custom' AND lower(properties->>'name') IN (
                'purchase', 'order_completed', 'checkout_completed', 'ecommerce_purchase',
                'transaction', 'refund', 'refunded'))
        )
    ),
    typed AS (
      SELECT *, CASE WHEN event_type IN ('refund', 'refunded') THEN 'refund' ELSE 'purchase' END AS kind,
             COALESCE(NULLIF(TRIM(order_id), ''), id) AS order_key
      FROM base
    ),
    deduped AS (
      -- Refunds are kept one per event: two refunds of an order are two refunds.
      SELECT DISTINCT ON (kind, CASE WHEN kind = 'purchase' THEN order_key ELSE id END) *
      FROM typed
      ORDER BY kind, CASE WHEN kind = 'purchase' THEN order_key ELSE id END,
        CASE event_type
          WHEN 'purchase' THEN 1 WHEN 'order_completed' THEN 2 WHEN 'ecommerce_purchase' THEN 3
          WHEN 'transaction' THEN 4 WHEN 'checkout_completed' THEN 5 ELSE 6
        END,
        occurred_at DESC
    ),
    -- The purchase sessions' pageviews, read in one pass. Looked up per purchase, a
    -- compressed day was decompressed once per purchase: 2.8 s of a 3.6 s rebuild for
    -- 51 purchases. Materialised, the lookup below reads this small set instead.
    session_pv AS MATERIALIZED (
      SELECT ae.session_id, ae.id, ae.occurred_at, ae.utm_source, ae.utm_medium, ae.utm_campaign,
             (ae.utm_source IS NOT NULL AND length(trim(ae.utm_source)) > 0) AS has_utm,
             (ae.referrer IS NOT NULL AND length(trim(ae.referrer)) > 0) AS has_referrer,
             coalesce(ae.channel, ${u(channelCaseSql("ae"))}) AS channel,
             NULLIF(lower(trim(regexp_replace(regexp_replace(ae.referrer, '^https?://(www\.)?', '', 'i'), '[/?#].*$', ''))), '') AS domain
      FROM analytics_events ae
      WHERE ae.website_id = ${websiteId}
        AND ae.event_type = 'pageview'
        AND ae.occurred_at >= ${dayStart}::timestamptz - interval '1 day'
        AND ae.occurred_at < ${dayEnd}
        AND ae.session_id IN (SELECT session_id FROM deduped WHERE kind = 'purchase' AND session_id IS NOT NULL)
    )
    INSERT INTO analytics_revenue_orders (
      website_id, day, kind, order_key, event_id, event_type, occurred_at, value, currency,
      user_type, product_name, order_id, source, medium, campaign, country, visitor_key, items
    )
    SELECT
      ${websiteId}, ${day}::date, p.kind,
      CASE WHEN p.kind = 'purchase' THEN p.order_key ELSE p.id END,
      p.id, p.event_type, p.occurred_at, p.raw_value, p.currency, p.user_type, p.product_name, p.order_id,
      COALESCE(NULLIF(TRIM(pa.attr_source), ''), NULLIF(TRIM(p.utm_source), ''), pa.attr_referrer_domain, 'direct'),
      COALESCE(NULLIF(TRIM(pa.attr_medium), ''), NULLIF(TRIM(p.utm_medium), ''),
               CASE WHEN pa.attr_referrer_domain IS NOT NULL THEN pa.attr_channel END, 'none'),
      COALESCE(NULLIF(TRIM(pa.attr_campaign), ''), NULLIF(TRIM(p.utm_campaign), ''), ''),
      p.country,
      COALESCE(NULLIF(TRIM(p.visitor_id), ''), p.session_id),
      p.items_json
    FROM deduped p
    LEFT JOIN LATERAL (
      SELECT
        (array_agg(t.utm_source   ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1]  AS attr_source,
        (array_agg(t.utm_medium   ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1]  AS attr_medium,
        (array_agg(t.utm_campaign ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1]  AS attr_campaign,
        (array_agg(t.channel      ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.external))[1] AS attr_channel,
        (array_agg(t.domain       ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.external))[1] AS attr_referrer_domain
      FROM (
        SELECT s.*, (s.has_referrer AND s.channel <> 'internal') AS external
        FROM session_pv s
        WHERE s.session_id = p.session_id
          AND s.occurred_at <= p.occurred_at
          AND s.occurred_at >= p.occurred_at - interval '1 day'
      ) t
    ) pa ON p.kind = 'purchase'
  `;
}
