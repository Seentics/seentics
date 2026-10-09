import { beforeAll, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { testConfig } from "../../../tests/helpers/test-config";
import type { AccountScope, VerifiedAccountKey } from "../../../../modules/api-keys/interfaces";
import type { AuthVars } from "../../../../platform/middleware/auth";

mock.module("../../../../db", fakeDbModule);
mock.module("../../../../platform/observability/logger", fakeLogger);
// Global to the whole run — see `testConfig` for why it must be complete.
mock.module("../../../../config", () => ({ env: () => testConfig() }));

let createManagementRoutes: typeof import("../routes").createManagementRoutes;

beforeAll(async () => {
  ({ createManagementRoutes } = await import("../routes"));
});

const KEY = "snt_acct_valid";

function app(scopes: AccountScope[] = ["websites:read", "websites:write"]) {
  const seen: { userId?: string } = {};
  const clients = new Hono<{ Variables: AuthVars }>();
  clients.get("/", (c) => {
    seen.userId = c.get("userId");
    return c.json({ data: [] });
  });
  clients.post("/", (c) => c.json({ data: {} }, 201));

  const verified: VerifiedAccountKey = { userId: "owner-1", apiKeyId: "key-1", scopes };
  const routes = createManagementRoutes({
    accountKeys: { verify: async (raw) => (raw === KEY ? verified : null) },
    websiteKeys: { create: async () => ({ secret: "snt_x" }) },
    embedTokens: {
      issue: async (websiteId: string) => ({ token: `embed-for-${websiteId}`, expiresAt: new Date("2026-10-09T09:00:00Z") }),
      verify: async () => null,
    },
    ownedWebsites: {
      getWebsite: async (ownerId: string, id: string) => (ownerId === "owner-1" && id === "site-1" ? ({ id } as never) : null),
    } as never,
    routers: { clients, websites: new Hono() },
  });
  return { routes, seen };
}

describe("management API auth", () => {
  it("refuses a request with no key", async () => {
    const res = await app().routes.request("/clients");
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("missing_api_key");
  });

  it("refuses a key that does not verify — a website key included", async () => {
    const res = await app().routes.request("/clients", { headers: { "X-API-Key": "snt_abc123_secret" } });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_api_key");
  });

  it("hands the key's owner to the mounted routers as userId", async () => {
    const { routes, seen } = app();
    const res = await routes.request("/clients", { headers: { "X-API-Key": KEY } });
    expect(res.status).toBe(200);
    expect(seen.userId).toBe("owner-1");
  });

  it("lets a read-only key read but not write", async () => {
    const { routes } = app(["websites:read"]);
    expect((await routes.request("/clients", { headers: { "X-API-Key": KEY } })).status).toBe(200);
    const write = await routes.request("/clients", { method: "POST", headers: { "X-API-Key": KEY } });
    expect(write.status).toBe(403);
    expect((await write.json()).required_scope).toBe("websites:write");
  });

  it("mints an embed token, with a ready iframe URL, only for a site the key's owner owns", async () => {
    const { routes } = app();
    const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };
    const own = await routes.request("/websites/site-1/embed-tokens", { method: "POST", headers, body: "{}" });
    expect(own.status).toBe(201);
    const body = (await own.json()).data;
    expect(body.token).toBe("embed-for-site-1");
    expect(body.embed_url).toContain("/embed/site-1?token=embed-for-site-1");
    const foreign = await routes.request("/websites/site-2/embed-tokens", { method: "POST", headers, body: "{}" });
    expect(foreign.status).toBe(404);
  });

  it("refuses an embed token lifetime outside 5 minutes to 30 days", async () => {
    const { routes } = app();
    const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };
    const res = await routes.request("/websites/site-1/embed-tokens", {
      method: "POST", headers, body: JSON.stringify({ expires_in_seconds: 60 }),
    });
    expect(res.status).toBe(400);
  });

  it("mints a website key only for a site the key's owner owns", async () => {
    const { routes } = app();
    const body = JSON.stringify({ name: "tenant dashboard" });
    const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };
    const own = await routes.request("/websites/site-1/api-keys", { method: "POST", headers, body });
    expect(own.status).toBe(201);
    const foreign = await routes.request("/websites/site-2/api-keys", { method: "POST", headers, body });
    expect(foreign.status).toBe(404);
  });
});
