import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { roleAtLeast } from "../websites/interfaces";
import type { ShopWebsites } from "./interfaces";
import { MAX_IMAGE_BYTES } from "./lib/images";
import type { OrderService } from "./services/order.service";
import type { StoreService } from "./services/store.service";
import {
  blacklistSchema,
  orderListSchema,
  orderPatchSchema,
  pageSchema,
  pageUpdateSchema,
  steadfastSchema,
  storeCreateSchema,
  storeUpdateSchema,
} from "./validators/shop.schema";

export type ShopRouteDeps = { stores: StoreService; orders: OrderService; websites: ShopWebsites };

type C = Context<{ Variables: AuthVars }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function body<T extends z.ZodTypeAny>(c: C, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  const raw = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, res: c.json({ error: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "invalid body" }, 400) };
}

const SLUG_TAKEN = { error: "slug_taken", message: "That address is already taken. Try another." };

/**
 * The dashboard's shop API (docs/shop.md). Every route but creating a store is scoped to the
 * store's website: viewers read, members and up write.
 */
export function createShopRoutes(deps: ShopRouteDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use(authMiddleware);

  async function access(c: C, write: boolean): Promise<{ websiteId: string; userId: string } | Response> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const websiteId = c.req.param("website_id") ?? "";
    if (!UUID.test(websiteId)) return c.json({ error: "not_found" }, 404);
    const role = await deps.websites.getRole(websiteId, userId);
    if (!role || (write && !roleAtLeast(role, "member"))) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);
    return { websiteId, userId };
  }

  routes.post("/stores", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const b = await body(c, storeCreateSchema);
    if (!b.ok) return b.res;
    const result = await deps.stores.create(userId, b.data);
    if (!result.ok) return c.json(SLUG_TAKEN, 409);
    return c.json({ data: result.value }, 201);
  });

  routes.get("/:website_id/store", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    return c.json({ data: await deps.stores.get(a.websiteId) });
  });

  routes.put("/:website_id/store", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const b = await body(c, storeUpdateSchema);
    if (!b.ok) return b.res;
    const result = await deps.stores.update(a.websiteId, b.data);
    if (result.ok) return c.json({ data: result.value });
    return result.error === "slug_taken" ? c.json(SLUG_TAKEN, 409) : c.json({ error: "not_found" }, 404);
  });

  routes.put("/:website_id/couriers/steadfast", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const b = await body(c, steadfastSchema);
    if (!b.ok) return b.res;
    const result = await deps.stores.setSteadfast(a.websiteId, b.data);
    if (result.ok) return c.json({ data: result.value });
    if (result.error === "invalid_credentials") return c.json({ error: "invalid_credentials", message: "Steadfast did not accept these keys." }, 400);
    if (result.error === "unavailable") return c.json({ error: "unavailable", message: "Credentials cannot be stored right now." }, 503);
    return c.json({ error: "not_found" }, 404);
  });

  // ── Pages ────────────────────────────────────────────────────────────────

  routes.get("/:website_id/pages", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    const pages = await deps.stores.pages(a.websiteId);
    return pages ? c.json({ data: pages }) : c.json({ error: "not_found" }, 404);
  });

  routes.post("/:website_id/pages", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const b = await body(c, pageSchema);
    if (!b.ok) return b.res;
    const result = await deps.stores.createPage(a.websiteId, b.data);
    if (result.ok) return c.json({ data: result.value }, 201);
    return result.error === "slug_taken" ? c.json(SLUG_TAKEN, 409) : c.json({ error: "not_found" }, 404);
  });

  routes.get("/:website_id/pages/:page_id", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    const id = c.req.param("page_id");
    const page = UUID.test(id) ? await deps.stores.page(a.websiteId, id) : null;
    return page ? c.json({ data: page }) : c.json({ error: "not_found" }, 404);
  });

  routes.put("/:website_id/pages/:page_id", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const id = c.req.param("page_id");
    if (!UUID.test(id)) return c.json({ error: "not_found" }, 404);
    const b = await body(c, pageUpdateSchema);
    if (!b.ok) return b.res;
    const result = await deps.stores.updatePage(a.websiteId, id, b.data);
    if (result.ok) return c.json({ data: result.value });
    return result.error === "slug_taken" ? c.json(SLUG_TAKEN, 409) : c.json({ error: "not_found" }, 404);
  });

  routes.delete("/:website_id/pages/:page_id", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const id = c.req.param("page_id");
    const done = UUID.test(id) && (await deps.stores.deletePage(a.websiteId, id));
    return done ? c.json({ data: { deleted: true } }) : c.json({ error: "not_found" }, 404);
  });

  for (const [path, status] of [["publish", "published"], ["unpublish", "draft"]] as const) {
    routes.post(`/:website_id/pages/:page_id/${path}`, async (c) => {
      const a = await access(c, true);
      if (a instanceof Response) return a;
      const id = c.req.param("page_id");
      const page = UUID.test(id) ? await deps.stores.setPageStatus(a.websiteId, id, status) : null;
      return page ? c.json({ data: page }) : c.json({ error: "not_found" }, 404);
    });
  }

  routes.post("/:website_id/images", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const declared = Number(c.req.header("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) return c.json({ error: "too_large", message: "Images can be up to 3 MB." }, 413);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return c.json({ error: "file required" }, 400);
    const result = await deps.stores.uploadImage(a.websiteId, new Uint8Array(await file.arrayBuffer()));
    if (result.ok) return c.json({ data: { url: result.url } }, 201);
    return result.error === "too_large"
      ? c.json({ error: "too_large", message: "Images can be up to 3 MB." }, 413)
      : c.json({ error: "not_an_image", message: "Upload a JPEG, PNG or WebP photo." }, 400);
  });

  // ── Orders ───────────────────────────────────────────────────────────────

  routes.get("/:website_id/orders", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    const q = orderListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.orders.list(a.websiteId, q.data) });
  });

  routes.get("/:website_id/orders/summary", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    const days = Math.min(365, Math.max(1, Number(c.req.query("days")) || 30));
    return c.json({ data: await deps.orders.summary(a.websiteId, days) });
  });

  routes.get("/:website_id/orders/:order_id", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    const id = c.req.param("order_id");
    const order = UUID.test(id) ? await deps.orders.get(a.websiteId, id) : null;
    return order ? c.json({ data: order }) : c.json({ error: "not_found" }, 404);
  });

  routes.patch("/:website_id/orders/:order_id", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const id = c.req.param("order_id");
    if (!UUID.test(id)) return c.json({ error: "not_found" }, 404);
    const b = await body(c, orderPatchSchema);
    if (!b.ok) return b.res;
    const order = await deps.orders.patch(a.websiteId, id, b.data, a.userId);
    if (order === "invalid_transition") return c.json({ error: "invalid_transition", message: "An order cannot move to that status from where it is." }, 409);
    return order ? c.json({ data: order }) : c.json({ error: "not_found" }, 404);
  });

  routes.post("/:website_id/orders/:order_id/recheck", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const id = c.req.param("order_id");
    const order = UUID.test(id) ? await deps.orders.recheck(a.websiteId, id) : null;
    return order ? c.json({ data: order }) : c.json({ error: "not_found" }, 404);
  });

  // ── Blacklist ────────────────────────────────────────────────────────────

  routes.get("/:website_id/blacklist", async (c) => {
    const a = await access(c, false);
    if (a instanceof Response) return a;
    return c.json({ data: await deps.orders.blacklist(a.websiteId) });
  });

  routes.post("/:website_id/blacklist", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const b = await body(c, blacklistSchema);
    if (!b.ok) return b.res;
    return c.json({ data: await deps.orders.addBlacklist(a.websiteId, b.data.phone, b.data.reason) }, 201);
  });

  routes.delete("/:website_id/blacklist/:entry_id", async (c) => {
    const a = await access(c, true);
    if (a instanceof Response) return a;
    const id = c.req.param("entry_id");
    const done = UUID.test(id) && (await deps.orders.removeBlacklist(a.websiteId, id));
    return done ? c.json({ data: { deleted: true } }) : c.json({ error: "not_found" }, 404);
  });

  return routes;
}
