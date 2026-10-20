import { Hono } from "hono";
import type { AppConfig } from "../../config";
import { getClientIp } from "../../platform/http/client-ip";
import { log } from "../../platform/observability/logger";
import { isGlobalApiKeyValid } from "../../platform/security/global-key";
import type { AdContext } from "../integrations/interfaces";
import { renderNotFound, renderProductPage, renderStorePage, type RenderContext } from "./lib/render";
import type { OrderService } from "./services/order.service";
import type { StoreService } from "./services/store.service";
import { orderSubmitSchema } from "./validators/shop.schema";

/**
 * What the shop host serves, through the gateway (docs/shop.md, "Public"): the gateway maps
 * `seentics.shop/<store>[/<page>]`, `/i/<image>` and `POST /api/order` onto these, applies its
 * per-address and plan limits first, and sends the service key. Nothing here answers without it:
 * a caller who reached Core directly would skip every one of those limits.
 */

/** An order form is a few hundred bytes; the gateway refuses more than 16 KB before this. */
const MAX_ORDER_BYTES = 16 * 1024;

const html = (body: string, status: 200 | 404 = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Edits show within a minute; a stale copy is fine to serve while it refreshes.
      "cache-control": status === 200 ? "public, max-age=60, stale-while-revalidate=600" : "public, max-age=30",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });

export function createShopPublicRoutes(deps: { stores: StoreService; orders: OrderService; cfg: AppConfig; render: RenderContext }) {
  const routes = new Hono();

  routes.use("*", async (c, next) => {
    if (!isGlobalApiKeyValid(deps.cfg, c.req.header("X-API-Key"))) return c.json({ error: "Gateway authentication required" }, 401);
    return next();
  });

  routes.get("/stores/:store", async (c) => {
    const found = await deps.stores.publicStore(c.req.param("store").toLowerCase());
    return found ? html(renderStorePage(found.store, found.pages, deps.render)) : html(renderNotFound(), 404);
  });

  routes.get("/pages/:store/:page", async (c) => {
    const found = await deps.stores.publicPage(c.req.param("store").toLowerCase(), c.req.param("page").toLowerCase());
    return found ? html(renderProductPage(found.store, found.page, deps.render)) : html(renderNotFound(), 404);
  });

  routes.get("/images/:id", async (c) => {
    const image = await deps.stores.image(c.req.param("id"));
    if (!image) return c.text("not found", 404);
    return new Response(image.body as unknown as BodyInit, {
      headers: {
        "content-type": image.contentType,
        // Ids are random and never reused: a photo at an id never changes.
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  });

  /**
   * The order form's submit. Answers `{ ok, orderNumber, message }` or `{ ok: false, error }`,
   * with error codes the page shows in Bangla. A honeypot hit is answered as a success.
   */
  routes.post("/orders", async (c) => {
    const raw = await c.req.text();
    if (raw.length > MAX_ORDER_BYTES) return c.json({ ok: false, error: "invalid_order" }, 413);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return c.json({ ok: false, error: "invalid_order" }, 400);
    }
    const parsed = orderSubmitSchema.safeParse(json);
    if (!parsed.success) {
      const phone = parsed.error.issues.some((i) => i.path[0] === "phone");
      return c.json({ ok: false, error: phone ? "invalid_phone" : "invalid_order" }, 400);
    }
    const b = parsed.data;
    if (b.hp) return c.json({ ok: true, orderNumber: String(1000 + Math.floor(Math.random() * 9000)), message: "ok" });
    try {
      const result = await deps.orders.submit({
        pageId: b.pageId,
        name: b.name,
        phone: b.phone,
        address: b.address,
        area: b.area,
        district: b.district ?? null,
        quantity: b.quantity,
        option: b.option ?? null,
        note: b.note ?? null,
        anonymousId: b.anonymous_id || null,
        sessionId: b.session_id || null,
        // Kept as sent (the body is size-capped); the integrations module shapes it when the
        // Purchase is queued, as it does for every conversion.
        ad: (b.ad ?? null) as AdContext | null,
        pageUrl: b.page_url || null,
        clientIp: getClientIp(c, deps.cfg.trustProxy),
        userAgent: (c.req.header("user-agent") ?? "").slice(0, 500),
      });
      if (!result.ok) return c.json({ ok: false, error: "not_found" }, 404);
      return c.json({ ok: true, orderNumber: result.order.number, message: "ok" });
    } catch (err) {
      log.error({ msg: "shop_order_failed", err: String(err) });
      return c.json({ ok: false, error: "SERVICE_UNAVAILABLE" }, 503);
    }
  });

  return routes;
}
