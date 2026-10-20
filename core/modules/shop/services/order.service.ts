import { log } from "../../../platform/observability/logger";
import type {
  BlacklistEntry,
  CourierRecord,
  Order,
  OrderPurchaseSink,
  OrderStatus,
  OrderSubmission,
  PurchaseTrigger,
  RiskLevel,
  SessionPresence,
} from "../interfaces";
import { e164Digits } from "../lib/phone";
import { priceOrder } from "../lib/pricing";
import { scoreOrder } from "../lib/risk";
import { type SteadfastKeys, steadfastFraudCheck } from "../lib/steadfast";
import type { OrderRecord, OrderRepository } from "../repositories/order.repository";
import type { ShopRepository, StoreRecord } from "../repositories/shop.repository";

const order_log = log.child({ category: "shop" });

/** A courier's answer for a phone is reused this long per store. */
const COURIER_CACHE_MS = 24 * 3_600_000;
/** Meta takes events up to seven days old; an order confirmed later is sent as happening now. */
const MAX_EVENT_AGE_MS = 7 * 86_400_000;

const STATUS_RANK: Record<OrderStatus, number> = { new: 0, confirmed: 1, shipped: 2, delivered: 3, returned: -1, cancelled: -1, fake: -1 };
const DEAD: ReadonlySet<OrderStatus> = new Set(["returned", "cancelled", "fake"]);

/** Where an order may go next. A closed order (cancelled, fake, returned) can only be reopened. */
const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled", "fake"],
  confirmed: ["shipped", "delivered", "cancelled", "fake"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  returned: ["new"],
  cancelled: ["new"],
  fake: ["new"],
};

export const canMove = (from: OrderStatus, to: OrderStatus): boolean => NEXT[from].includes(to);

/**
 * Whether reaching `status` is the moment this store tells the ad platforms about a Purchase.
 *
 * `placed` fires at submit, except for a high-risk order when the store holds those back
 * (`autoBlockHighRisk`): that one fires when the seller confirms it by hand. `confirmed` fires on
 * the first move to confirmed or beyond (a seller who skips straight to shipped still counts).
 * `delivered` fires on delivery alone.
 */
export function purchaseDue(trigger: PurchaseTrigger, status: OrderStatus, ctx: { atSubmit: boolean; risk: RiskLevel; holdHighRisk: boolean }): boolean {
  if (DEAD.has(status)) return false;
  if (trigger === "placed") {
    if (ctx.atSubmit) return !(ctx.holdHighRisk && ctx.risk === "high");
    return STATUS_RANK[status] >= STATUS_RANK.confirmed;
  }
  if (trigger === "confirmed") return STATUS_RANK[status] >= STATUS_RANK.confirmed;
  return status === "delivered";
}

/** Gets a store's opened Steadfast keys; the store service owns the sealing. */
export type CourierKeys = (store: StoreRecord) => SteadfastKeys | null;

export type SubmitResult = { ok: true; order: Order } | { ok: false; error: "not_found" };

/**
 * Orders: the buyer's submit, the seller's list and status changes, the risk label on each, and
 * the verified Purchase the ad platforms are told about once the order is real.
 */
export class OrderService {
  constructor(
    private readonly shops: ShopRepository,
    private readonly orders: OrderRepository,
    private readonly purchases: OrderPurchaseSink,
    private readonly sessions: SessionPresence,
    private readonly courierKeys: CourierKeys,
    private readonly send: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The buyer pressed "order". Prices come from the page as it is now, not from the browser. */
  async submit(s: OrderSubmission): Promise<SubmitResult> {
    const found = await this.shops.pageWithStore(s.pageId);
    if (!found || found.page.status !== "published") return { ok: false, error: "not_found" };
    const { page, store } = found;
    const option = page.options && s.option && page.options.values.includes(s.option) ? s.option : null;
    const priced = priceOrder(page, store, s.quantity, s.area);
    const at = this.now();
    const { risk, steadfast } = await this.assess(store, { id: null, phone: s.phone, address: s.address, anonymousId: s.anonymousId, clientIp: s.clientIp, at });
    const number = await this.shops.takeOrderNumber(store.websiteId);
    const order = await this.orders.insert({
      websiteId: store.websiteId,
      number,
      pageId: page.id,
      pageSlug: page.slug,
      productName: page.productName,
      option,
      ...priced,
      customerName: s.name,
      phone: s.phone,
      address: s.address,
      area: s.area,
      district: s.district,
      note: s.note,
      risk,
      courier: { steadfast },
      sessionId: s.sessionId,
      anonymousId: s.anonymousId,
      clientIp: s.clientIp,
      userAgent: s.userAgent,
      ad: s.ad,
      pageUrl: s.pageUrl ?? page.url,
    }, at);
    order_log.info({ msg: "shop_order_placed", website_id: store.websiteId, order: number, risk: risk.level });
    if (purchaseDue(store.purchaseEventOn, "new", { atSubmit: true, risk: risk.level, holdHighRisk: store.autoBlockHighRisk })) {
      await this.sendPurchase(order).catch((err) => order_log.error({ msg: "shop_purchase_enqueue_failed", order_id: order.id, err: String(err) }));
    }
    return { ok: true, order: this.public(order) };
  }

  /** The risk label, from this seller's own records and (when connected) the courier's. */
  private async assess(store: StoreRecord, o: { id: string | null; phone: string; address: string; anonymousId: string | null; clientIp: string | null; at: Date }) {
    const [facts, steadfast] = await Promise.all([this.orders.riskFacts(store.websiteId, o), this.courier(store, o.phone)]);
    return { risk: scoreOrder({ phone: o.phone, address: o.address, courier: steadfast, ...facts }, o.at), steadfast };
  }

  /** Steadfast's record for a phone, from the day's cache or asked fresh. Never throws, never blocks long. */
  private async courier(store: StoreRecord, phone: string): Promise<CourierRecord | null> {
    const keys = this.courierKeys(store);
    if (!keys) return null;
    try {
      const cached = await this.orders.cachedCourier(store.websiteId, phone, "steadfast", COURIER_CACHE_MS);
      if (cached !== undefined) return cached;
      const fresh = await steadfastFraudCheck(keys, phone, this.send);
      await this.orders.saveCourier(store.websiteId, phone, "steadfast", fresh);
      return fresh;
    } catch (err) {
      order_log.warn({ msg: "shop_courier_check_failed", website_id: store.websiteId, err: String(err) });
      return null;
    }
  }

  /** Queue the order's one Purchase; skipped when no destination sends purchases. */
  private async sendPurchase(order: OrderRecord): Promise<void> {
    const created = Date.parse(order.createdAt);
    const at = this.now().getTime();
    const queued = await this.purchases.enqueueOrderPurchase({
      websiteId: order.websiteId,
      orderId: order.id,
      value: order.total,
      currency: "BDT",
      phone: e164Digits(order.phone),
      occurredAt: at - created > MAX_EVENT_AGE_MS ? at : created,
      url: order.pageUrl ?? "",
      visitorId: order.anonymousId,
      ip: order.clientIp ?? "",
      userAgent: order.userAgent ?? "",
      ad: order.ad,
    });
    if (queued > 0) {
      await this.orders.setConversion(order.websiteId, [order.id], "queued", this.now());
      order.conversion = { status: "queued", event: "Purchase", at: this.now().toISOString() };
    }
  }

  async list(websiteId: string, q: { status?: OrderStatus; risk?: RiskLevel; q: string; page: number; limit: number }) {
    const { items, total } = await this.orders.list(websiteId, q);
    return { items: await this.decorate(websiteId, items), page: q.page, limit: q.limit, total };
  }

  async get(websiteId: string, id: string): Promise<Order | null> {
    const order = await this.orders.get(websiteId, id);
    return order ? (await this.decorate(websiteId, [order]))[0]! : null;
  }

  summary(websiteId: string, days: number) {
    return this.orders.summary(websiteId, days);
  }

  /**
   * The seller moved an order on, or wrote a note. Moving it to the store's trigger queues the
   * Purchase (once: an order already queued or sent is not sent again); moving an order that was
   * never sent to cancelled, fake or returned marks it skipped.
   */
  async patch(websiteId: string, id: string, change: { status?: OrderStatus; note?: string | null }, by: string): Promise<Order | null | "invalid_transition"> {
    let order = await this.orders.get(websiteId, id);
    if (!order) return null;
    if (change.status !== undefined && change.status !== order.status && !canMove(order.status, change.status)) return "invalid_transition";
    if (change.note !== undefined) order = (await this.orders.setNote(websiteId, id, change.note)) ?? order;
    if (change.status !== undefined && change.status !== order.status) {
      order = (await this.orders.setStatus(websiteId, id, change.status, by, this.now())) ?? order;
      const store = await this.shops.storeByWebsite(websiteId);
      const pending = order.conversion.status === "not_sent" || order.conversion.status === "skipped";
      if (store && pending) {
        if (purchaseDue(store.purchaseEventOn, order.status, { atSubmit: false, risk: order.risk.level, holdHighRisk: store.autoBlockHighRisk })) {
          await this.sendPurchase(order).catch((err) => order_log.error({ msg: "shop_purchase_enqueue_failed", order_id: id, err: String(err) }));
        } else if (DEAD.has(order.status) && order.conversion.status === "not_sent") {
          await this.orders.setConversion(websiteId, [id], "skipped", null);
          order.conversion = { status: "skipped", event: null, at: null };
        }
      }
    }
    return (await this.decorate(websiteId, [order]))[0]!;
  }

  /** Score again: the seller asked, or something about the number changed (the blacklist). */
  async recheck(websiteId: string, id: string): Promise<Order | null> {
    const store = await this.shops.storeByWebsite(websiteId);
    const order = await this.orders.get(websiteId, id);
    if (!store || !order) return null;
    const { risk, steadfast } = await this.assess(store, {
      id: order.id, phone: order.phone, address: order.address, anonymousId: order.anonymousId, clientIp: order.clientIp, at: new Date(order.createdAt),
    });
    const updated = await this.orders.setRisk(websiteId, id, risk, steadfast ?? order.courier.steadfast);
    return updated ? (await this.decorate(websiteId, [updated]))[0]! : null;
  }

  // ── Blacklist ────────────────────────────────────────────────────────────

  blacklist(websiteId: string): Promise<BlacklistEntry[]> {
    return this.orders.blacklist(websiteId);
  }

  async addBlacklist(websiteId: string, phone: string, reason: string | null): Promise<BlacklistEntry> {
    const entry = await this.orders.addBlacklist(websiteId, phone, reason);
    await this.rescorePhone(websiteId, phone);
    return entry;
  }

  async removeBlacklist(websiteId: string, id: string): Promise<boolean> {
    const phone = await this.orders.removeBlacklist(websiteId, id);
    if (phone) await this.rescorePhone(websiteId, phone);
    return phone !== null;
  }

  /** The number's open orders, scored again: cheap, and the label is right the moment the list changes. */
  private async rescorePhone(websiteId: string, phone: string): Promise<void> {
    const store = await this.shops.storeByWebsite(websiteId);
    if (!store) return;
    for (const o of await this.orders.openOrdersFor(websiteId, phone)) {
      const facts = await this.orders.riskFacts(websiteId, { id: o.id, phone: o.phone, address: o.address, anonymousId: o.anonymousId, clientIp: o.clientIp, at: new Date(o.createdAt) });
      await this.orders.setRisk(websiteId, o.id, scoreOrder({ phone: o.phone, address: o.address, courier: o.courier.steadfast, ...facts }, this.now()), o.courier.steadfast);
    }
  }

  // ── Presentation ─────────────────────────────────────────────────────────

  /** Replay presence, and queued Purchases' delivery read back from the outbox. */
  private async decorate(websiteId: string, orders: OrderRecord[]): Promise<Order[]> {
    const sessions = orders.map((o) => o.sessionId).filter((s): s is string => !!s && s !== "anon");
    const queued = orders.filter((o) => o.conversion.status === "queued").map((o) => o.id);
    const [recorded, states] = await Promise.all([
      sessions.length ? this.sessions.recorded(websiteId, sessions).catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
      queued.length ? this.purchases.orderPurchaseStatus(websiteId, queued).catch(() => new Map<string, "queued" | "sent" | "failed">()) : Promise.resolve(new Map<string, "queued" | "sent" | "failed">()),
    ]);
    for (const state of ["sent", "failed"] as const) {
      const ids = queued.filter((id) => states.get(id) === state);
      if (ids.length) await this.orders.setConversion(websiteId, ids, state, this.now());
    }
    return orders.map((o) => {
      const state = states.get(o.id);
      const conversion = state && state !== "queued" ? { status: state, event: "Purchase" as const, at: this.now().toISOString() } : o.conversion;
      return this.public({ ...o, conversion, hasReplay: !!o.sessionId && recorded.has(o.sessionId) });
    });
  }

  private public(o: OrderRecord): Order {
    const { websiteId: _w, anonymousId: _a, clientIp: _i, userAgent: _u, ad: _ad, pageUrl: _p, ...order } = o;
    return order;
  }
}
