/**
 * One revenue transaction, by its event id — the order page behind a row of the revenue
 * dashboard's recent transactions.
 *
 * The dashboard's list is the latest 50 orders of the range, and the order page used to
 * look its id up in that list, so any older order read as "not found". This reads the one
 * order directly, in the same shape as a `recent_transactions` entry
 * (repositories/revenue.repository.ts), from the same two sources:
 *
 *   - the orders rollup (db/sql/039), which covers any range and already carries the
 *     order's attribution — where an order is found first;
 *   - raw events, for a Postgres without the rollups (and an order from today the rollup
 *     has not built yet), attributed by the same rules as the dashboard's raw query.
 *     Raw events are kept 31 days, so past that only the rollup has the order.
 */
import { analyticsReadSql as pgSql } from "../../../db";
import { referrerDomainSql } from "../lib/dimension-sql";
import { arrivalPageviewSql, channelCaseSql } from "../lib/traffic-channel";

/** A transaction as the order page renders it — a `recent_transactions` entry. */
export type RevenueTransaction = {
  id: string;
  occurred_at: string;
  value: number;
  currency: string;
  product_name?: string;
  order_id?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  country?: string;
  user_type?: "new" | "returning";
  items?: unknown[];
};

type TransactionRow = {
  id: string;
  occurred_at: string | Date;
  value: number;
  currency: string;
  product_name: string | null;
  order_id: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  country: string | null;
  user_type: string | null;
  items: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PURCHASE_TYPES = [
  "purchase", "order_completed", "checkout_completed", "ecommerce_purchase", "transaction",
];

/** The row into the response, with the same rounding and omissions as the dashboard's list. */
function shape(tx: TransactionRow): RevenueTransaction {
  return {
    id: String(tx.id),
    occurred_at: tx.occurred_at instanceof Date ? tx.occurred_at.toISOString() : String(tx.occurred_at),
    value: Math.round(Number(tx.value) * 100) / 100,
    currency: String(tx.currency || "USD"),
    ...(tx.product_name ? { product_name: tx.product_name } : {}),
    ...(tx.order_id ? { order_id: tx.order_id } : {}),
    ...(tx.source ? { source: tx.source } : {}),
    ...(tx.medium ? { medium: tx.medium } : {}),
    ...(tx.campaign ? { campaign: tx.campaign } : {}),
    ...(tx.country ? { country: tx.country } : {}),
    ...(tx.user_type === "new" || tx.user_type === "returning" ? { user_type: tx.user_type } : {}),
    ...(Array.isArray(tx.items) ? { items: tx.items } : {}),
  };
}

async function fromOrdersRollup(websiteId: string, eventId: string): Promise<TransactionRow | undefined> {
  // A Postgres without the rollups has no table at all (031 needs `hll`).
  const [exists] = await pgSql<{ ok: boolean }[]>`
    SELECT to_regclass('analytics_revenue_orders') IS NOT NULL AS ok
  `;
  if (!exists?.ok) return undefined;
  const [row] = await pgSql<TransactionRow[]>`
    SELECT event_id AS id, occurred_at,
           CASE WHEN abs(value) > 1e9 THEN 0.0 ELSE value END AS value,
           currency, product_name, order_id, source, medium, campaign, country, user_type,
           items
    FROM analytics_revenue_orders
    WHERE website_id = ${websiteId} AND kind = 'purchase' AND event_id = ${eventId}
    ORDER BY occurred_at DESC
    LIMIT 1
  `;
  return row;
}

async function fromRawEvents(websiteId: string, eventId: string): Promise<TransactionRow | undefined> {
  // `analytics_events.id` is a uuid; anything else cannot match and would only fail the cast.
  if (!UUID_RE.test(eventId)) return undefined;
  const u = (text: string) => pgSql.unsafe(text);
  const [row] = await pgSql<TransactionRow[]>`
    WITH p AS (
      SELECT
        id, session_id, occurred_at, country::text AS country, utm_source, utm_medium, utm_campaign,
        (SELECT CASE WHEN abs(v) > 1e9 THEN 0.0 ELSE v END FROM (SELECT COALESCE(
          CASE WHEN (properties->>'value')   ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (properties->>'value')::double precision   END,
          CASE WHEN (properties->>'revenue') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (properties->>'revenue')::double precision END,
          CASE WHEN (properties->>'amount')  ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (properties->>'amount')::double precision  END,
          CASE WHEN (properties->>'total')   ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (properties->>'total')::double precision   END,
          0.0
        ) AS v) parsed) AS value,
        COALESCE(NULLIF(TRIM(UPPER(properties->>'currency')), ''), 'USD') AS currency,
        LOWER(TRIM(COALESCE(properties->>'user_type', '')))                AS user_type,
        COALESCE(NULLIF(TRIM(properties->>'product_name'), ''), NULLIF(TRIM(properties->>'product'), ''),
                 NULLIF(TRIM(properties->>'name'), ''), '')                AS product_name,
        COALESCE(NULLIF(TRIM(properties->>'order_id'), ''), NULLIF(TRIM(properties->>'transaction_id'), ''),
                 id::text)                                                  AS order_id,
        properties->'items' AS items
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND id = ${eventId}::uuid
        AND (
          event_type = ANY(${PURCHASE_TYPES}::text[])
          OR (event_type = 'custom' AND lower(properties->>'name') = ANY(${PURCHASE_TYPES}::text[]))
        )
      LIMIT 1
    )
    SELECT
      p.id::text AS id, p.occurred_at, p.value, p.currency, p.product_name, p.order_id,
      COALESCE(NULLIF(TRIM(pa.attr_source), ''), NULLIF(TRIM(p.utm_source), ''), pa.attr_referrer_domain, 'direct') AS source,
      COALESCE(NULLIF(TRIM(pa.attr_medium), ''), NULLIF(TRIM(p.utm_medium), ''),
               CASE WHEN pa.attr_referrer_domain IS NOT NULL THEN pa.attr_channel END, 'none') AS medium,
      COALESCE(NULLIF(TRIM(pa.attr_campaign), ''), NULLIF(TRIM(p.utm_campaign), ''), '') AS campaign,
      p.country, p.user_type, p.items
    FROM p
    LEFT JOIN LATERAL (
      SELECT
        (array_agg(t.utm_source   ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1]  AS attr_source,
        (array_agg(t.utm_medium   ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1]  AS attr_medium,
        (array_agg(t.utm_campaign ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.has_utm))[1]  AS attr_campaign,
        (array_agg(t.channel      ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.external))[1] AS attr_channel,
        (array_agg(t.domain       ORDER BY t.occurred_at DESC, t.id DESC) FILTER (WHERE t.external))[1] AS attr_referrer_domain
      FROM (
        SELECT s.*, (s.has_referrer AND ${u(arrivalPageviewSql("s.channel", "s.ref_host", "s.page_host"))}) AS external
        FROM (
          SELECT ae.id, ae.occurred_at, ae.utm_source, ae.utm_medium, ae.utm_campaign,
                 (ae.utm_source IS NOT NULL AND length(trim(ae.utm_source)) > 0) AS has_utm,
                 (ae.referrer IS NOT NULL AND length(trim(ae.referrer)) > 0) AS has_referrer,
                 coalesce(ae.channel, ${u(channelCaseSql("ae"))}) AS channel,
                 ${u(referrerDomainSql("ae.referrer"))} AS ref_host,
                 ${u(referrerDomainSql("ae.page"))} AS page_host,
                 NULLIF(lower(trim(regexp_replace(regexp_replace(ae.referrer, '^https?://(www\\.)?', '', 'i'), '[/?#].*$', ''))), '') AS domain
          FROM analytics_events ae
          WHERE ae.website_id  = ${websiteId}
            AND ae.session_id  = p.session_id
            AND ae.event_type  = 'pageview'
            AND ae.occurred_at <= p.occurred_at
            AND ae.occurred_at >= p.occurred_at - interval '1 day'
        ) s
      ) t
    ) pa ON true
  `;
  return row;
}

/** The purchase with this event id on this website, or `null` when there is none. */
export async function getRevenueTransaction(
  websiteId: string,
  eventId: string,
): Promise<RevenueTransaction | null> {
  const row = (await fromOrdersRollup(websiteId, eventId)) ?? (await fromRawEvents(websiteId, eventId));
  return row ? shape(row) : null;
}
