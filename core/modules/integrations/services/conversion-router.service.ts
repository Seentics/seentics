import { log } from "../../../platform/observability/logger";
import type {
  AdContext,
  ConversionIngest,
  ConversionOrderInput,
  ConversionKind,
  ConversionLeadInput,
  ConversionPayload,
  ConversionTrackerRow,
} from "../interfaces/conversions";
import {
  currencyOf,
  fbcOf,
  fbpOf,
  gaClientIdOf,
  hashEmail,
  liFatIdOf,
  hashId,
  hashPhone,
  kindOf,
  matchKeysFor,
  orderIdOf,
  platformEventFor,
  ttclidOf,
  ttpOf,
  valueOf,
  withDefaults,
} from "../lib/conversion-match";
import { adContextOf } from "../lib/ad-context";
import { enabledDestinations, enqueueConversions, orderPurchaseStates, type DestinationRow, type QueuedConversion } from "../repositories/conversion.repository";

/** How long a website's destinations are trusted from memory. A change shows within this. */
const DESTINATION_CACHE_MS = 30_000;

/** One event, before it is shaped for each destination. */
type Candidate = {
  websiteId: string;
  kind: ConversionKind;
  name: string;
  eventId: string;
  occurredAt: number;
  url: string;
  visitorId: string | null;
  value: number | null;
  currency: string | null;
  orderId: string | null;
  email: string | null;
  phone: string | null;
  ip: string;
  userAgent: string;
  ad: AdContext | null;
};

/**
 * Turns consented events into queued conversions, one per destination that sends them.
 *
 * Only ever given consented data: ingest routes only batches from identified visitors, and the
 * lead sink only leads whose consent box was ticked. Email and phone are hashed here, before
 * anything is stored.
 */
export class ConversionRouter implements ConversionIngest {
  private cache = new Map<string, { at: number; rows: DestinationRow[] }>();

  constructor(private readonly kick: () => void, private readonly now: () => number = Date.now) {}

  private async destinations(websiteIds: string[]): Promise<Map<string, DestinationRow[]>> {
    const out = new Map<string, DestinationRow[]>();
    const missing: string[] = [];
    for (const id of websiteIds) {
      const hit = this.cache.get(id);
      if (hit && this.now() - hit.at < DESTINATION_CACHE_MS) out.set(id, hit.rows);
      else missing.push(id);
    }
    if (missing.length) {
      const rows = await enabledDestinations(missing);
      for (const id of missing) {
        const mine = rows.filter((r) => r.website_id === id);
        this.cache.set(id, { at: this.now(), rows: mine });
        out.set(id, mine);
      }
    }
    return out;
  }

  /** Forget a website's destinations, so a change made in the dashboard applies at once. */
  invalidate(websiteId: string): void {
    this.cache.delete(websiteId);
  }

  private async route(candidates: readonly Candidate[]): Promise<number> {
    if (candidates.length === 0) return 0;
    const byWebsite = await this.destinations([...new Set(candidates.map((c) => c.websiteId))]);
    const queued: QueuedConversion[] = [];
    for (const c of candidates) {
      for (const d of byWebsite.get(c.websiteId) ?? []) {
        const config = withDefaults(d.platform, d.config);
        const platformEvent = platformEventFor(config, c.kind, c.name);
        if (!platformEvent) continue;
        const email = hashEmail(c.email);
        const phone = hashPhone(c.phone);
        const fbc = fbcOf(c.ad);
        const fbp = fbpOf(c.ad);
        const gaClientId = gaClientIdOf(c.ad);
        const ttclid = d.platform === "tiktok" ? ttclidOf(c.ad) : null;
        const ttp = d.platform === "tiktok" ? ttpOf(c.ad) : null;
        const liFatId = d.platform === "linkedin" ? liFatIdOf(c.ad) : null;
        const payload: ConversionPayload = {
          event_id: c.eventId,
          platform_event: platformEvent,
          occurred_at: c.occurredAt,
          url: c.url.slice(0, 2000),
          value: c.value,
          currency: c.currency,
          order_id: c.orderId,
          email_sha256: email,
          phone_sha256: phone,
          external_id_sha256: hashId(c.visitorId),
          client_id: gaClientId ?? c.visitorId,
          ip: c.ip || null,
          user_agent: c.userAgent ? c.userAgent.slice(0, 500) : null,
          fbc: d.platform === "meta" ? fbc : null,
          fbp: d.platform === "meta" ? fbp : null,
          ttclid,
          ttp,
          li_fat_id: liFatId,
        };
        queued.push({
          destinationId: d.id,
          websiteId: c.websiteId,
          kind: c.kind,
          eventName: c.name,
          visitorId: c.visitorId,
          occurredAt: c.occurredAt,
          payload,
          matchKeys: matchKeysFor(d.platform, { email, phone, ip: payload.ip, ua: payload.user_agent, fbc, fbp, gaClientId, clk: c.ad?.clk, ttclid, ttp, liFatId }),
        });
      }
    }
    const n = await enqueueConversions(queued);
    if (n > 0) this.kick();
    return n;
  }

  /** The `conversions` lane: consented custom events from the tracker. */
  async processEvents(_batchId: string, rows: readonly ConversionTrackerRow[]): Promise<number> {
    const candidates: Candidate[] = [];
    for (const r of rows) {
      const kind = kindOf(r.name);
      if (!kind) continue;
      const p = r.properties;
      const value = valueOf(p);
      const orderId = kind === "purchase" ? orderIdOf(p) : null;
      const ownId = typeof p.event_id === "string" && p.event_id.trim() ? p.event_id.trim() : null;
      candidates.push({
        websiteId: r.websiteId,
        kind,
        name: r.name,
        // A purchase is identified by its order id, exactly as given: a browser pixel that
        // sends the same id as its eventID (GA4: transaction_id) is then the same purchase to
        // the platform, and a resent batch is the same row here. Anything else by its own
        // `event_id` or its place in the batch.
        eventId: orderId ?? ownId ?? `evt:${r.fallbackId}`,
        occurredAt: r.occurredAt,
        url: r.url,
        visitorId: r.visitorId,
        value,
        currency: currencyOf(p, value !== null),
        orderId,
        email: typeof p.email === "string" ? p.email : null,
        phone: typeof p.phone === "string" ? p.phone : null,
        ip: r.ip,
        userAgent: r.userAgent,
        ad: adContextOf(r.ad),
      });
    }
    try {
      return await this.route(candidates);
    } catch (err) {
      // Thrown back so the ingest worker retries the batch: nothing is queued twice (the
      // outbox's key), and a conversion dropped here would be lost for good.
      log.error({ msg: "conversions_route_failed", err: err instanceof Error ? err.message : "unknown" });
      throw err;
    }
  }

  /** A consented lead from a popup form, with the email and phone it gave. */
  async enqueueLead(lead: ConversionLeadInput): Promise<number> {
    return this.route([{
      websiteId: lead.websiteId,
      kind: "lead",
      name: "lead",
      eventId: `lead:${lead.submissionId}`,
      occurredAt: lead.occurredAt,
      url: lead.pageUrl,
      visitorId: lead.visitorId,
      value: null,
      currency: null,
      orderId: null,
      email: lead.email,
      phone: lead.phone,
      ip: lead.ip,
      userAgent: lead.userAgent,
      ad: lead.ad,
    }]);
  }

  /**
   * A shop order the seller confirmed (or that was delivered, or placed: the store chooses), as
   * one Purchase per destination. Keyed `order:<id>`, so however often the order moves back and
   * forth it is one Purchase to the platform. Its consent is the buyer's order itself: they gave
   * their number to be called and shipped to, on a page that says the store uses Seentics.
   */
  async enqueueOrderPurchase(order: ConversionOrderInput): Promise<number> {
    return this.route([{
      websiteId: order.websiteId,
      kind: "purchase",
      name: "purchase",
      eventId: `order:${order.orderId}`,
      occurredAt: order.occurredAt,
      url: order.url,
      visitorId: order.visitorId,
      value: order.value,
      currency: order.currency,
      orderId: order.orderId,
      email: null,
      phone: order.phone,
      ip: order.ip,
      userAgent: order.userAgent,
      ad: adContextOf(order.ad),
    }]);
  }

  /** Where each order's Purchase stands, by order id: pending anywhere is queued, else failed anywhere is failed. */
  async orderPurchaseStatus(websiteId: string, orderIds: readonly string[]): Promise<Map<string, "queued" | "sent" | "failed">> {
    return orderPurchaseStates(websiteId, orderIds);
  }
}
