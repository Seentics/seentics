import { getRevenueTransaction as readRevenueTransaction } from "../repositories/revenue-transaction.repository";
import { requireAnalyticsAccess, type AnalyticsContext } from "./analytics-access";
import type { AnalyticsControllerDeps } from "./analytics-controller.types";

/**
 * `GET /revenue-transaction/:website_id?id=<event id>` — one order, for the order page.
 *
 * The id rides in the query rather than the path because every cacheable analytics GET
 * ends in `:website_id`: the cache middleware authorizes a hit by reading the website from
 * the last path segment (routes.ts).
 *
 * `read` is injectable for tests; production reads the database.
 */
export function getRevenueTransaction(
  deps: AnalyticsControllerDeps,
  read: typeof readRevenueTransaction = readRevenueTransaction,
) {
  return async (c: AnalyticsContext) => {
    const websiteRef = c.req.param("website_id");
    if (!websiteRef) return c.json({ error: "not found" }, 404);
    const denied = await requireAnalyticsAccess(c, deps, websiteRef);
    if (denied) return denied;
    const id = c.req.query("id")?.trim();
    if (!id || id.length > 200) return c.json({ error: "id is required" }, 400);
    const data = await read(websiteRef, id);
    return data ? c.json({ data }) : c.json({ error: "not found" }, 404);
  };
}
