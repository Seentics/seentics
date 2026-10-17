import type { Context, Next } from "hono";
import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../app/tests/helpers/fake-db";
import { testConfig } from "../../../app/tests/helpers/test-config";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);
mock.module("../../../config", () => ({ env: () => testConfig() }));
// The session check has its own tests; here a header names the signed-in user.
mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: Context<{ Variables: { userId: string } }>, next: Next) => {
    const userId = c.req.header("X-Test-User");
    if (!userId) return c.json({ error: "Authorization required" }, 401);
    c.set("userId", userId);
    return next();
  },
  requireUser: (c: Context<{ Variables: { userId: string } }>) => c.get("userId") ?? null,
}));

let createAccountApiKeyRoutes: typeof import("../account-routes").createAccountApiKeyRoutes;

beforeAll(async () => {
  ({ createAccountApiKeyRoutes } = await import("../account-routes"));
});

const USER = "99999999-9999-4999-8999-999999999999";

/**
 * `analytics:apikeys.manage` was granted by the gateway's roles and checked nowhere, so a
 * custom team role that withheld it still let its holder list, mint and revoke account keys —
 * each of which carries the account's whole reach.
 */
describe("/user/agency/api-keys team permission", () => {
  const as = (perms: string) => ({ "X-Test-User": USER, "X-Team-Permissions": perms, "Content-Type": "application/json" });

  it("refuses listing, minting and revoking without apikeys.manage", async () => {
    const routes = createAccountApiKeyRoutes();
    const headers = as("analytics:dashboard.view,analytics:funnels.manage");
    expect((await routes.request("/", { headers })).status).toBe(403);
    expect((await routes.request("/", { method: "POST", headers, body: JSON.stringify({ name: "k" }) })).status).toBe(403);
    expect((await routes.request("/key-1", { method: "DELETE", headers })).status).toBe(403);
  });

  it("refuses an empty permission set — a team that grants nothing here", async () => {
    const routes = createAccountApiKeyRoutes();
    expect((await routes.request("/", { headers: as("") })).status).toBe(403);
  });

  it("keeps the static scope list open", async () => {
    const routes = createAccountApiKeyRoutes();
    expect((await routes.request("/scopes", { headers: as("") })).status).toBe(200);
  });

  it("lets apikeys.manage past the permission check", async () => {
    const routes = createAccountApiKeyRoutes();
    // Past the guard the request reaches validation, which is all this needs to show.
    const res = await routes.request("/", { method: "POST", headers: as("analytics:apikeys.manage"), body: "{}" });
    expect(res.status).toBe(400);
  });
});
