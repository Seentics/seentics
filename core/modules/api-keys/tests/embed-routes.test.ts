import type { Context, Next } from "hono";
import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../app/tests/helpers/fake-db";
import { memoryEmbedLinks } from "../../../app/tests/helpers/memory-embed-links";
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

let createEmbedLinkRoutes: typeof import("../embed-routes").createEmbedLinkRoutes;

beforeAll(async () => {
  ({ createEmbedLinkRoutes } = await import("../embed-routes"));
});

const OWNER = "99999999-9999-4999-8999-999999999999";
const VIEWER = "88888888-8888-4888-8888-888888888888";
const SITE = "11111111-1111-4111-8111-111111111111";
const CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function setup() {
  const embedLinks = await memoryEmbedLinks();
  const routes = createEmbedLinkRoutes({
    embedLinks,
    websites: {
      getRole: async (id: string, userId: string) => (id !== SITE ? null : userId === OWNER ? "owner" : userId === VIEWER ? "viewer" : null),
      getById: async (id: string) => (id === SITE ? { id, ownerId: OWNER, name: "Acme" } : null),
    } as never,
    clients: { getClient: async (userId: string, id: string) => (userId === OWNER && id === CLIENT ? { id, name: "Client A" } : null) } as never,
  });
  const as = async (userId: string) => ({ "X-Test-User": userId, "Content-Type": "application/json" });
  return { routes, embedLinks, as };
}

describe("/user/agency/embed-links", () => {
  it("creates once (201), then returns the same link (200), in the agreed shape", async () => {
    const { routes, as } = await setup();
    const post = async (body: object) => routes.request("/", { method: "POST", headers: await as(OWNER), body: JSON.stringify(body) });
    const first = await post({ website_id: SITE });
    expect(first.status).toBe(201);
    const link = (await first.json()).data;
    expect(Object.keys(link).sort()).toEqual(["created_at", "embed_url", "id", "scope", "sections", "target_id", "target_name", "token"]);
    expect(link).toMatchObject({ scope: "website", target_id: SITE, target_name: "Acme" });
    expect(link.embed_url).toBe(`${testConfig().frontendUrl}/embed/${SITE}?token=${link.token}`);

    const second = await post({ website_id: SITE });
    expect(second.status).toBe(200);
    expect((await second.json()).data).toEqual(link);

    const client = (await (await post({ client_id: CLIENT })).json()).data;
    expect(client.scope).toBe("client");
    expect(client.embed_url).toBe(`${testConfig().frontendUrl}/embed/${CLIENT}?token=${client.token}&client=1`);
  });

  it("lists the owner's links", async () => {
    const { routes, as } = await setup();
    await routes.request("/", { method: "POST", headers: await as(OWNER), body: JSON.stringify({ website_id: SITE }) });
    await routes.request("/", { method: "POST", headers: await as(OWNER), body: JSON.stringify({ client_id: CLIENT }) });
    const res = await routes.request("/", { headers: await as(OWNER) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.map((l: { scope: string }) => l.scope).sort()).toEqual(["client", "website"]);
    expect((await (await routes.request("/", { headers: await as(VIEWER) })).json()).data).toEqual([]);
  });

  it("needs exactly one target, and the role to share it", async () => {
    const { routes, as } = await setup();
    const post = async (userId: string, body: object) => routes.request("/", { method: "POST", headers: await as(userId), body: JSON.stringify(body) });
    expect((await post(OWNER, {})).status).toBe(400);
    expect((await post(OWNER, { website_id: SITE, client_id: CLIENT })).status).toBe(400);
    expect((await post(VIEWER, { website_id: SITE })).status).toBe(403);
    expect((await post(VIEWER, { client_id: CLIENT })).status).toBe(403);
    expect((await routes.request("/", { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("revokes (204), after which creating gives a new token", async () => {
    const { routes, as } = await setup();
    const post = async () => (await (await routes.request("/", { method: "POST", headers: await as(OWNER), body: JSON.stringify({ website_id: SITE }) })).json()).data;
    const before = await post();
    expect((await routes.request(`/${before.id}`, { method: "DELETE", headers: await as(VIEWER) })).status).toBe(404);
    expect((await routes.request(`/${before.id}`, { method: "DELETE", headers: await as(OWNER) })).status).toBe(204);
    expect((await routes.request(`/${before.id}`, { method: "DELETE", headers: await as(OWNER) })).status).toBe(404);
    const after = await post();
    expect(after.id).not.toBe(before.id);
    expect(after.token).not.toBe(before.token);
  });
});

describe("embed link sections (dashboard)", () => {
  it("defaults to analytics, accepts a list on create, ignores it for an existing link", async () => {
    const { routes, as } = await setup();
    const post = async (body: object) => routes.request("/", { method: "POST", headers: await as(OWNER), body: JSON.stringify(body) });
    const site = (await (await post({ website_id: SITE })).json()).data;
    expect(site.sections).toEqual(["analytics"]);
    const client = (await (await post({ client_id: CLIENT, sections: ["heatmaps", "recordings"] })).json()).data;
    expect(client.sections).toEqual(["recordings", "heatmaps"]);
    const again = (await (await post({ client_id: CLIENT, sections: ["analytics"] })).json()).data;
    expect(again.sections).toEqual(["recordings", "heatmaps"]);
    expect((await post({ website_id: SITE, sections: [] })).status).toBe(400);
    expect((await post({ website_id: SITE, sections: ["funnels"] })).status).toBe(400);
  });

  it("PATCH changes sections and applies to the same token at once", async () => {
    const { routes, embedLinks, as } = await setup();
    const link = (await (await routes.request("/", { method: "POST", headers: await as(OWNER), body: JSON.stringify({ website_id: SITE }) })).json()).data;
    expect((await embedLinks.verify(link.token))?.sections).toEqual(["analytics"]); // warms the cache
    const patch = async (userId: string, id: string, body: object) => routes.request(`/${id}`, { method: "PATCH", headers: await as(userId), body: JSON.stringify(body) });
    const res = await patch(OWNER, link.id, { sections: ["analytics", "recordings"] });
    expect(res.status).toBe(200);
    const updated = (await res.json()).data;
    expect(updated).toMatchObject({ id: link.id, token: link.token, embed_url: link.embed_url, sections: ["analytics", "recordings"] });
    expect((await embedLinks.verify(link.token))?.sections).toEqual(["analytics", "recordings"]);
    expect((await patch(OWNER, link.id, { sections: [] })).status).toBe(400);
    expect((await patch(OWNER, link.id, { sections: ["nope"] })).status).toBe(400);
    expect((await patch(OWNER, link.id, {})).status).toBe(400);
    expect((await patch(VIEWER, link.id, { sections: ["analytics"] })).status).toBe(404);
    expect((await patch(OWNER, crypto.randomUUID(), { sections: ["analytics"] })).status).toBe(404);
    await routes.request(`/${link.id}`, { method: "DELETE", headers: await as(OWNER) });
    expect((await patch(OWNER, link.id, { sections: ["analytics"] })).status).toBe(404);
  });
});
