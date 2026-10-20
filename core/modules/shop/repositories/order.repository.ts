import { sql } from "../../../db";
import type { AdContext } from "../../integrations/interfaces";
import type { BlacklistEntry, ConversionState, CourierRecord, Order, OrderStatus, Risk, RiskLevel } from "../interfaces";
import { normalizeAddress } from "../lib/risk";
import { iso } from "./shop.repository";

/** Orders, the blacklist and the courier lookups' cache: SQL for those tables lives here. */

type OrderRow = {
  id: string; website_id: string; number: number; page_id: string | null; page_slug: string | null; product_name: string;
  option: string | null; quantity: number; unit_price: number; delivery_charge: number; total: number; customer_name: string;
  phone: string; address: string; area: "inside_dhaka" | "outside_dhaka"; district: string | null; note: string | null;
  status: OrderStatus; history: Array<{ status: OrderStatus; at: string; by: string | null }>; seller_note: string | null;
  risk_level: RiskLevel; risk_score: number; risk_reasons: Risk["reasons"]; risk_checked_at: unknown;
  courier: { steadfast?: CourierRecord | null }; conversion_status: ConversionState; conversion_at: unknown;
  page_url: string | null; session_id: string | null; anonymous_id: string | null; client_ip: string | null; user_agent: string | null;
  ad: AdContext | null; created_at: unknown; updated_at: unknown;
};

/** An order with what only the server uses: who sent it, from where, with which ad ids. */
export type OrderRecord = Order & {
  websiteId: string;
  anonymousId: string | null;
  clientIp: string | null;
  userAgent: string | null;
  ad: AdContext | null;
  pageUrl: string | null;
};

function toOrder(r: OrderRow): OrderRecord {
  return {
    id: r.id,
    websiteId: r.website_id,
    number: String(r.number),
    pageId: r.page_id,
    pageSlug: r.page_slug,
    productName: r.product_name,
    option: r.option,
    quantity: r.quantity,
    unitPrice: r.unit_price,
    deliveryCharge: r.delivery_charge,
    total: r.total,
    customerName: r.customer_name,
    phone: r.phone,
    address: r.address,
    area: r.area,
    district: r.district,
    note: r.note,
    status: r.status,
    risk: { level: r.risk_level, score: r.risk_score, reasons: Array.isArray(r.risk_reasons) ? r.risk_reasons : [], checkedAt: iso(r.risk_checked_at) },
    courier: { steadfast: r.courier?.steadfast ?? null },
    conversion: {
      status: r.conversion_status,
      event: r.conversion_status === "not_sent" || r.conversion_status === "skipped" ? null : "Purchase",
      at: r.conversion_at == null ? null : iso(r.conversion_at),
    },
    sessionId: r.session_id,
    hasReplay: false,
    history: Array.isArray(r.history) ? r.history : [],
    sellerNote: r.seller_note,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    anonymousId: r.anonymous_id,
    clientIp: r.client_ip,
    userAgent: r.user_agent,
    ad: r.ad,
    pageUrl: r.page_url,
  };
}

export type NewOrder = Omit<OrderRecord, "id" | "number" | "status" | "history" | "sellerNote" | "createdAt" | "updatedAt" | "conversion" | "hasReplay"> & { number: number };

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

export class OrderRepository {
  async insert(o: NewOrder, now: Date): Promise<OrderRecord> {
    const history = [{ status: "new", at: now.toISOString(), by: null }];
    const [row] = await sql<OrderRow[]>`
      INSERT INTO shop_orders (website_id, number, page_id, page_slug, product_name, option, quantity, unit_price, delivery_charge, total,
        customer_name, phone, address, address_key, area, district, note, history, risk_level, risk_score, risk_reasons, risk_checked_at, courier,
        page_url, session_id, anonymous_id, client_ip, user_agent, ad, created_at, updated_at)
      VALUES (${o.websiteId}::uuid, ${o.number}, ${o.pageId}::uuid, ${o.pageSlug}, ${o.productName}, ${o.option}, ${o.quantity}, ${o.unitPrice},
        ${o.deliveryCharge}, ${o.total}, ${o.customerName}, ${o.phone}, ${o.address}, ${normalizeAddress(o.address)}, ${o.area}, ${o.district}, ${o.note},
        ${JSON.stringify(history)}::jsonb, ${o.risk.level}, ${o.risk.score}, ${JSON.stringify(o.risk.reasons)}::jsonb, ${o.risk.checkedAt}::timestamptz,
        ${JSON.stringify({ steadfast: o.courier.steadfast })}::jsonb, ${o.pageUrl}, ${o.sessionId}, ${o.anonymousId}, ${o.clientIp},
        ${o.userAgent}, ${o.ad ? JSON.stringify(o.ad) : null}::jsonb, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
      RETURNING *`;
    return toOrder(row!);
  }

  async get(websiteId: string, id: string): Promise<OrderRecord | null> {
    const [row] = await sql<OrderRow[]>`SELECT * FROM shop_orders WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid`;
    return row ? toOrder(row) : null;
  }

  async list(websiteId: string, q: { status?: OrderStatus; risk?: RiskLevel; q: string; page: number; limit: number }): Promise<{ items: OrderRecord[]; total: number }> {
    const term = q.q.replace(/^#/, "");
    const like = likePattern(term);
    const digits = term.replace(/\D/g, "");
    const rows = await sql<(OrderRow & { total_count: number })[]>`
      SELECT *, count(*) OVER ()::int AS total_count FROM shop_orders
      WHERE website_id = ${websiteId}::uuid
        AND (${q.status ?? null}::text IS NULL OR status = ${q.status ?? null})
        AND (${q.risk ?? null}::text IS NULL OR risk_level = ${q.risk ?? null})
        AND (${term} = '' OR customer_name ILIKE ${like} OR (${digits} <> '' AND (phone LIKE ${`%${digits}%`} OR number::text = ${digits})))
      ORDER BY created_at DESC
      LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
    return { items: rows.map(toOrder), total: rows[0]?.total_count ?? 0 };
  }

  async summary(websiteId: string, days: number): Promise<{ byStatus: Record<string, number>; byRisk: Record<string, number>; revenueBdt: number; confirmedBdt: number }> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await sql<{ status: OrderStatus; risk_level: RiskLevel; n: number; total: number }[]>`
      SELECT status, risk_level, count(*)::int AS n, COALESCE(sum(total), 0)::int AS total FROM shop_orders
      WHERE website_id = ${websiteId}::uuid AND created_at >= ${since}::timestamptz GROUP BY status, risk_level`;
    const byStatus: Record<string, number> = { new: 0, confirmed: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0, fake: 0 };
    const byRisk: Record<string, number> = { safe: 0, check: 0, high: 0 };
    let revenueBdt = 0;
    let confirmedBdt = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + r.n;
      byRisk[r.risk_level] = (byRisk[r.risk_level] ?? 0) + r.n;
      if (r.status === "delivered") revenueBdt += r.total;
      if (r.status === "confirmed" || r.status === "shipped" || r.status === "delivered") confirmedBdt += r.total;
    }
    return { byStatus, byRisk, revenueBdt, confirmedBdt };
  }

  /** A status change, appended to the history, only when the status really changes. */
  async setStatus(websiteId: string, id: string, status: OrderStatus, by: string | null, now: Date): Promise<OrderRecord | null> {
    const entry = JSON.stringify([{ status, at: now.toISOString(), by }]);
    const [row] = await sql<OrderRow[]>`
      UPDATE shop_orders SET status = ${status}, history = history || ${entry}::jsonb, updated_at = NOW()
      WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid AND status <> ${status} RETURNING *`;
    return row ? toOrder(row) : null;
  }

  async setNote(websiteId: string, id: string, note: string | null): Promise<OrderRecord | null> {
    const [row] = await sql<OrderRow[]>`UPDATE shop_orders SET seller_note = ${note}, updated_at = NOW() WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid RETURNING *`;
    return row ? toOrder(row) : null;
  }

  async setRisk(websiteId: string, id: string, risk: Risk, steadfast: CourierRecord | null): Promise<OrderRecord | null> {
    const [row] = await sql<OrderRow[]>`
      UPDATE shop_orders SET risk_level = ${risk.level}, risk_score = ${risk.score}, risk_reasons = ${JSON.stringify(risk.reasons)}::jsonb,
        risk_checked_at = ${risk.checkedAt}::timestamptz, courier = courier || ${JSON.stringify({ steadfast })}::jsonb, updated_at = NOW()
      WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid RETURNING *`;
    return row ? toOrder(row) : null;
  }

  async setConversion(websiteId: string, ids: readonly string[], status: ConversionState, at: Date | null): Promise<void> {
    if (ids.length === 0) return;
    await sql`UPDATE shop_orders SET conversion_status = ${status}, conversion_at = ${at ? at.toISOString() : null}::timestamptz
      WHERE website_id = ${websiteId}::uuid AND id = ANY(${ids as string[]}::uuid[])`;
  }

  /** Open orders (not delivered, returned, cancelled or fake) from a phone, for re-scoring when the blacklist changes. */
  async openOrdersFor(websiteId: string, phone: string): Promise<OrderRecord[]> {
    const rows = await sql<OrderRow[]>`
      SELECT * FROM shop_orders WHERE website_id = ${websiteId}::uuid AND phone = ${phone} AND status IN ('new', 'confirmed', 'shipped')
      ORDER BY created_at DESC LIMIT 50`;
    return rows.map(toOrder);
  }

  /** What the risk score needs about this number and this order's neighbours. */
  async riskFacts(websiteId: string, o: { id: string | null; phone: string; address: string; anonymousId: string | null; clientIp: string | null; at: Date }) {
    const day = new Date(o.at.getTime() - 86_400_000).toISOString();
    const hour = new Date(o.at.getTime() - 3_600_000).toISOString();
    const at = o.at.toISOString();
    const self = o.id ?? "00000000-0000-0000-0000-000000000000";
    const addr = normalizeAddress(o.address);
    const [h] = await sql<{ delivered: number; returned: number; fake: number; cancelled: number; same_phone: number }[]>`
      SELECT
        count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
        count(*) FILTER (WHERE status = 'returned')::int AS returned,
        count(*) FILTER (WHERE status = 'fake')::int AS fake,
        count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        count(*) FILTER (WHERE created_at > ${day}::timestamptz AND created_at <= ${at}::timestamptz)::int AS same_phone
      FROM shop_orders WHERE website_id = ${websiteId}::uuid AND phone = ${o.phone} AND id <> ${self}::uuid`;
    const [a] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM shop_orders
      WHERE website_id = ${websiteId}::uuid AND phone <> ${o.phone} AND id <> ${self}::uuid
        AND created_at > ${day}::timestamptz AND created_at <= ${at}::timestamptz
        AND address_key = ${addr} AND ${addr} <> ''`;
    const [dv] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM shop_orders
      WHERE website_id = ${websiteId}::uuid AND created_at > ${hour}::timestamptz AND created_at <= ${at}::timestamptz AND id <> ${self}::uuid
        AND ((${o.anonymousId}::text IS NOT NULL AND anonymous_id = ${o.anonymousId}) OR (${o.clientIp}::text IS NOT NULL AND client_ip = ${o.clientIp}))`;
    const [b] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM shop_blacklist WHERE website_id = ${websiteId}::uuid AND phone = ${o.phone}`;
    return {
      history: { delivered: h?.delivered ?? 0, returned: h?.returned ?? 0, fake: h?.fake ?? 0, cancelled: h?.cancelled ?? 0 },
      recentSamePhone: h?.same_phone ?? 0,
      recentSameAddress: a?.n ?? 0,
      // This order included.
      recentSameDevice: (dv?.n ?? 0) + 1,
      blacklisted: (b?.n ?? 0) > 0,
    };
  }

  // ── Blacklist ────────────────────────────────────────────────────────────

  async blacklist(websiteId: string): Promise<BlacklistEntry[]> {
    const rows = await sql<{ id: string; phone: string; reason: string | null; created_at: unknown }[]>`
      SELECT id, phone, reason, created_at FROM shop_blacklist WHERE website_id = ${websiteId}::uuid ORDER BY created_at DESC`;
    return rows.map((r) => ({ id: r.id, phone: r.phone, reason: r.reason, createdAt: iso(r.created_at) }));
  }

  async addBlacklist(websiteId: string, phone: string, reason: string | null): Promise<BlacklistEntry> {
    const [r] = await sql<{ id: string; phone: string; reason: string | null; created_at: unknown }[]>`
      INSERT INTO shop_blacklist (website_id, phone, reason) VALUES (${websiteId}::uuid, ${phone}, ${reason})
      ON CONFLICT (website_id, phone) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, shop_blacklist.reason)
      RETURNING id, phone, reason, created_at`;
    return { id: r!.id, phone: r!.phone, reason: r!.reason, createdAt: iso(r!.created_at) };
  }

  async removeBlacklist(websiteId: string, id: string): Promise<string | null> {
    const [r] = await sql<{ phone: string }[]>`DELETE FROM shop_blacklist WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid RETURNING phone`;
    return r?.phone ?? null;
  }

  // ── Courier cache ────────────────────────────────────────────────────────

  async cachedCourier(websiteId: string, phone: string, courier: string, maxAgeMs: number): Promise<CourierRecord | null | undefined> {
    const since = new Date(Date.now() - maxAgeMs).toISOString();
    const [r] = await sql<{ result: CourierRecord | { none: true } }[]>`
      SELECT result FROM shop_courier_checks WHERE website_id = ${websiteId}::uuid AND phone = ${phone} AND courier = ${courier} AND checked_at > ${since}::timestamptz`;
    if (!r) return undefined;
    return "none" in r.result ? null : r.result;
  }

  async saveCourier(websiteId: string, phone: string, courier: string, result: CourierRecord | null): Promise<void> {
    await sql`
      INSERT INTO shop_courier_checks (website_id, phone, courier, result, checked_at)
      VALUES (${websiteId}::uuid, ${phone}, ${courier}, ${JSON.stringify(result ?? { none: true })}::jsonb, NOW())
      ON CONFLICT (website_id, phone, courier) DO UPDATE SET result = EXCLUDED.result, checked_at = NOW()`;
  }
}
