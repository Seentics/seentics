import { beforeAll, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { memoryEmbedLinks } from "../../../tests/helpers/memory-embed-links";
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
const CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN = "22222222-2222-4222-8222-222222222222";

async function app(scopes: AccountScope[] = ["websites:read", "websites:write"]) {
  const embedLinks = await memoryEmbedLinks();
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
    embedLinks,
    clients: { getClient: async (ownerId: string, id: string) => (ownerId === "owner-1" && id === CLIENT ? ({ id, name: "Client A" } as never) : null) } as never,
    ownedWebsites: {
      getWebsite: async (ownerId: string, id: string) => (ownerId === "owner-1" && id === SITE ? ({ id, name: "Acme" } as never) : null),
    } as never,
    routers: { clients, websites: new Hono() },
  });
  return { routes, seen, embedLinks };
}

describe("management API auth", () => {
  it("refuses a request with no key", async () => {
    const res = await (await app()).routes.request("/clients");
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("missing_api_key");
  });

  it("refuses a key that does not verify — a website key included", async () => {
    const res = await (await app()).routes.request("/clients", { headers: { "X-API-Key": "snt_abc123_secret" } });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_api_key");
  });

  it("hands the key's owner to the mounted routers as userId", async () => {
    const { routes, seen } = await app();
    const res = await routes.request("/clients", { headers: { "X-API-Key": KEY } });
    expect(res.status).toBe(200);
    expect(seen.userId).toBe("owner-1");
  });

  it("lets a read-only key read but not write", async () => {
    const { routes } = await app(["websites:read"]);
    expect((await routes.request("/clients", { headers: { "X-API-Key": KEY } })).status).toBe(200);
    const write = await routes.request("/clients", { method: "POST", headers: { "X-API-Key": KEY } });
    expect(write.status).toBe(403);
    expect((await write.json()).required_scope).toBe("websites:write");
  });

  it("makes embed links idempotently, for the key's own website and client only", async () => {
    const { routes } = await app();
    const headers = { "X-API-Key": KEY };
    for (const [path, id, scope] of [["websites", SITE, "website"], ["clients", CLIENT, "client"]] as const) {
      const first = await routes.request(`/${path}/${id}/embed-link`, { method: "POST", headers });
      expect(first.status).toBe(201);
      const link = (await first.json()).data;
      expect(link).toMatchObject({ scope, target_id: id });
      expect(link.embed_url).toContain(`/embed/${id}?token=${link.token}`);
      expect(link.embed_url.endsWith("&client=1")).toBe(scope === "client");
      const again = await routes.request(`/${path}/${id}/embed-link`, { method: "POST", headers });
      expect(again.status).toBe(200);
      expect((await again.json()).data).toEqual(link);
      expect((await routes.request(`/${path}/${FOREIGN}/embed-link`, { method: "POST", headers })).status).toBe(404);
      expect((await routes.request(`/${path}/not-a-uuid/embed-link`, { method: "POST", headers })).status).toBe(404);
    }
  });

  it("revokes an embed link with DELETE, and the token stops verifying", async () => {
    const { routes, embedLinks } = await app();
    const headers = { "X-API-Key": KEY };
    const link = (await (await routes.request(`/websites/${SITE}/embed-link`, { method: "POST", headers })).json()).data;
    expect(await embedLinks.verify(link.token)).not.toBeNull();
    expect((await routes.request(`/websites/${SITE}/embed-link`, { method: "DELETE", headers })).status).toBe(204);
    expect(await embedLinks.verify(link.token)).toBeNull();
    expect((await routes.request(`/websites/${SITE}/embed-link`, { method: "DELETE", headers })).status).toBe(404);
    const next = (await (await routes.request(`/websites/${SITE}/embed-link`, { method: "POST", headers })).json()).data;
    expect(next.token).not.toBe(link.token);
  });

  it("needs the write scope for embed links", async () => {
    const { routes } = await app(["websites:read"]);
    const res = await routes.request(`/websites/${SITE}/embed-link`, { method: "POST", headers: { "X-API-Key": KEY } });
    expect(res.status).toBe(403);
  });

  it("takes sections on create and changes them with PATCH, the token unchanged", async () => {
    const { routes, embedLinks } = await app();
    const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };
    for (const [path, id] of [["websites", SITE], ["clients", CLIENT]] as const) {
      const url = `/${path}/${id}/embed-link`;
      expect((await routes.request(url, { method: "PATCH", headers, body: JSON.stringify({ sections: ["analytics"] }) })).status).toBe(404); // no link yet
      const made = await routes.request(url, { method: "POST", headers, body: JSON.stringify({ sections: ["recordings", "analytics"] }) });
      expect(made.status).toBe(201);
      const link = (await made.json()).data;
      expect(link.sections).toEqual(["analytics", "recordings"]);
      const patched = await routes.request(url, { method: "PATCH", headers, body: JSON.stringify({ sections: ["heatmaps"] }) });
      expect(patched.status).toBe(200);
      expect((await patched.json()).data).toMatchObject({ token: link.token, sections: ["heatmaps"] });
      expect((await embedLinks.verify(link.token))?.sections).toEqual(["heatmaps"]);
      for (const body of [{}, { sections: [] }, { sections: ["x"] }, "not json"]) {
        const bad = await routes.request(url, { method: "PATCH", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
        expect(bad.status).toBe(400);
      }
      expect((await routes.request(`/${path}/${FOREIGN}/embed-link`, { method: "PATCH", headers, body: JSON.stringify({ sections: ["analytics"] }) })).status).toBe(404);
    }
    const bareDefault = await routes.request(`/websites/${SITE}/embed-link`, { method: "POST", headers: { "X-API-Key": KEY } });
    expect(bareDefault.status).toBe(200);
    // PATCH needs the write scope.
    const ro = await app(["websites:read"]);
    expect((await ro.routes.request(`/websites/${SITE}/embed-link`, { method: "PATCH", headers, body: JSON.stringify({ sections: ["analytics"] }) })).status).toBe(403);
  });
});
