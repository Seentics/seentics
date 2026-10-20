import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { RevenueTransaction } from "../repositories/revenue-transaction.repository";

// Only the JWT middleware is faked, as in analytics-routes.test.ts; `X-Test-User` stands in
// for a verified token. The read is injected, so nothing here reaches a database.
mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: Context<{ Variables: { userId: string } }>, next: Next) => {
    const userId = c.req.header("X-Test-User");
    if (!userId) return c.json({ error: "Authorization required" }, 401);
    c.set("userId", userId);
    return next();
  },
  requireUser: (c: Context<{ Variables: { userId: string } }>) => c.get("userId") ?? null,
}));

const { getRevenueTransaction } = await import("../controllers/revenue-transaction.controller");
const { authMiddleware } = await import("../../../platform/middleware/auth");

const WEBSITE = "11111111-1111-4111-8111-111111111111";
const EVENT = "33333333-3333-4333-8333-333333333333";
const TX: RevenueTransaction = { id: EVENT, occurred_at: "2026-01-02T03:04:05.000Z", value: 42, currency: "USD" };

function app(found: RevenueTransaction | null = TX) {
  const reads: [string, string][] = [];
  const deps = {
    websites: { getRole: async (_ref: string, user: string) => (user === "owner" ? "owner" : null) },
  } as never;
  const routes = new Hono();
  routes.use("*", authMiddleware as never);
  routes.get(
    "/revenue-transaction/:website_id",
    getRevenueTransaction(deps, async (site, id) => {
      reads.push([site, id]);
      return found;
    }) as never,
  );
  return { routes, reads };
}

const get = (routes: Hono, path: string, user?: string) =>
  routes.request(path, { headers: user ? { "X-Test-User": user } : {} });

describe("GET /revenue-transaction/:website_id", () => {
  it("returns the one transaction, wrapped in `data`", async () => {
    const { routes, reads } = app();
    const res = await get(routes, `/revenue-transaction/${WEBSITE}?id=${EVENT}`, "owner");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: TX });
    expect(reads).toEqual([[WEBSITE, EVENT]]);
  });

  it("answers 404 for an id that is not one of the site's purchases", async () => {
    const { routes } = app(null);
    const res = await get(routes, `/revenue-transaction/${WEBSITE}?id=${EVENT}`, "owner");
    expect(res.status).toBe(404);
  });

  it("answers 400 without an id", async () => {
    const { routes, reads } = app();
    expect((await get(routes, `/revenue-transaction/${WEBSITE}`, "owner")).status).toBe(400);
    expect(reads).toEqual([]);
  });

  it("is guarded: 401 anonymous, 403 without a role, and never reads either way", async () => {
    const { routes, reads } = app();
    expect((await get(routes, `/revenue-transaction/${WEBSITE}?id=${EVENT}`)).status).toBe(401);
    expect((await get(routes, `/revenue-transaction/${WEBSITE}?id=${EVENT}`, "stranger")).status).toBe(403);
    expect(reads).toEqual([]);
  });
});
