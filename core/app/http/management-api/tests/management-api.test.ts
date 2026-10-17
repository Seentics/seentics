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
const SITE = "11111111-1111-4111-8111-111111111111";

function app(scopes: AccountScope[] = ["websites:read", "websites:write"]) {
  const seen: { userId?: string } = {};
  const websites = new Hono<{ Variables: AuthVars }>();
  websites.get("/", (c) => {
    seen.userId = c.get("userId");
    return c.json({ data: [] });
  });
  websites.post("/", (c) => c.json({ data: {} }, 201));

  const verified: VerifiedAccountKey = { userId: "owner-1", apiKeyId: "key-1", scopes };
  const routes = createManagementRoutes({
    accountKeys: { verify: async (raw) => (raw === KEY ? verified : null) },
    websites,
  });
  return { routes, seen };
}

describe("management API auth", () => {
  it("refuses a request with no key", async () => {
    const res = await app().routes.request("/websites");
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("missing_api_key");
  });

  it("refuses a key that does not verify — a website key included", async () => {
    const res = await app().routes.request("/websites", { headers: { "X-API-Key": "snt_abc123_secret" } });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_api_key");
  });

  it("hands the key's owner to the mounted router as userId", async () => {
    const { routes, seen } = app();
    const res = await routes.request("/websites", { headers: { "X-API-Key": KEY } });
    expect(res.status).toBe(200);
    expect(seen.userId).toBe("owner-1");
  });

  it("lets a read-only key read but not write", async () => {
    const { routes } = app(["websites:read"]);
    expect((await routes.request("/websites", { headers: { "X-API-Key": KEY } })).status).toBe(200);
    const write = await routes.request("/websites", { method: "POST", headers: { "X-API-Key": KEY } });
    expect(write.status).toBe(403);
    expect((await write.json()).required_scope).toBe("websites:write");
  });

  // Clients and embed links moved to the agency workspace (/api/v1/agency).
  it("no longer serves clients or embed links", async () => {
    const { routes } = app();
    const headers = { "X-API-Key": KEY };
    expect((await routes.request("/clients", { headers })).status).toBe(404);
    expect((await routes.request(`/websites/${SITE}/embed-link`, { method: "POST", headers })).status).toBe(404);
  });
});
