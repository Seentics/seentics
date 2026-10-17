import { Hono, type Context, type Next } from "hono";
import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../app/tests/helpers/fake-db";
import { testConfig } from "../../../app/tests/helpers/test-config";
import { MemoryClientPortal, MemoryWhiteLabel, fakeClientDirectory, type FakeClient } from "./support/memory-agency";

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

let routesMod: typeof import("../routes");
let services: {
  PortalAccessService: typeof import("../services/portal-access.service").PortalAccessService;
  ClientUserService: typeof import("../services/client-user.service").ClientUserService;
  WhiteLabelService: typeof import("../services/white-label.service").WhiteLabelService;
};

beforeAll(async () => {
  routesMod = await import("../routes");
  services = {
    PortalAccessService: (await import("../services/portal-access.service")).PortalAccessService,
    ClientUserService: (await import("../services/client-user.service")).ClientUserService,
    WhiteLabelService: (await import("../services/white-label.service")).WhiteLabelService,
  };
});

const OWNER = "99999999-9999-4999-8999-999999999999";
const OTHER_OWNER = "88888888-8888-4888-8888-888888888888";
const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FRONTEND = "https://app.seentics.test";

let dashboard: ReturnType<typeof import("../routes").createAgencyDashboardRoutes>;
let portalRoutes: ReturnType<typeof import("../routes").createPortalRoutes>;
let rateLimited = false;

beforeEach(() => {
  const clients: FakeClient[] = [
    { id: CLIENT_A, ownerId: OWNER, name: "Client A", company: "A Co", status: "active",
      featuresEnabled: { analytics: true, heatmaps: false, replays: true, funnels: true, automations: true, errors: true },
      websites: [{ id: "11111111-1111-4111-8111-111111111111", ownerId: OWNER, clientId: CLIENT_A, name: "A shop", url: "a.shop" }] },
    { id: FOREIGN, ownerId: OTHER_OWNER, name: "Theirs", company: "", status: "active", featuresEnabled: {}, websites: [] },
  ];
  const store = new MemoryClientPortal();
  const whiteLabel = new services.WhiteLabelService(new MemoryWhiteLabel());
  const portal = new services.PortalAccessService({
    tokens: store.portalTokens,
    clients: fakeClientDirectory(clients),
    branding: whiteLabel,
    clientUsers: store.clientUsers,
    accountActive: async () => true,
  });
  const clientUsers = new services.ClientUserService(store.clientUsers, fakeClientDirectory(clients), portal);
  dashboard = routesMod.createAgencyDashboardRoutes({ whiteLabel, clientUsers, portal });
  rateLimited = false;
  portalRoutes = routesMod.createPortalRoutes({
    portal,
    config: () => ({
      frontendUrl: FRONTEND,
      trustProxy: false,
      rateLimit: { ...testConfig().rateLimit, enabled: rateLimited },
    }),
  });
});

const as = (userId: string) => ({ "X-Test-User": userId, "Content-Type": "application/json" });
const call = (method: string, path: string, body?: unknown, userId = OWNER) =>
  dashboard.request(path, { method, headers: as(userId), body: body === undefined ? undefined : JSON.stringify(body) });
const validate = (body: unknown, ip = "203.0.113.9") =>
  portalRoutes.request("/validate", { method: "POST", headers: { "Content-Type": "application/json", "x-seentics-peer-ip": ip }, body: JSON.stringify(body) });

describe("auth", () => {
  it("every dashboard route needs a session", async () => {
    for (const [method, path] of [
      ["GET", "/white-label"], ["PATCH", "/white-label"], ["GET", "/client-users"], ["POST", "/client-users"],
      ["GET", `/client-users/${CLIENT_A}`], ["DELETE", `/client-users/${CLIENT_A}`],
      ["POST", `/client-users/${CLIENT_A}/revoke`], ["POST", `/client-users/${CLIENT_A}/resend`],
      ["POST", `/clients/${CLIENT_A}/portal-token`], ["DELETE", `/clients/${CLIENT_A}/portal-token`],
    ] as const) {
      expect((await dashboard.request(path, { method })).status).toBe(401);
    }
  });

  it("claims nothing else under /clients", async () => {
    expect((await call("GET", `/clients/${CLIENT_A}`)).status).toBe(404);
  });

  it("shares the /user/agency mount with the clients router without shadowing either", async () => {
    // As user-branch.ts mounts them: the websites module's agency router first, then this one.
    const clientsRouter = new Hono();
    clientsRouter.get("/clients/:clientId", (c) => c.json({ from: "clients" }));
    clientsRouter.post("/clients", (c) => c.json({ from: "clients" }, 201));
    const user = new Hono();
    user.route("/agency", clientsRouter);
    user.route("/agency", dashboard);
    const req = (method: string, path: string) => user.request(path, { method, headers: as(OWNER) });
    expect(await (await req("GET", `/agency/clients/${CLIENT_A}`)).json()).toEqual({ from: "clients" });
    expect((await req("POST", "/agency/clients")).status).toBe(201);
    expect((await req("POST", `/agency/clients/${CLIENT_A}/portal-token`)).status).toBe(201);
    expect((await req("GET", "/agency/white-label")).status).toBe(200);
  });
});

describe("/white-label", () => {
  it("GET returns the defaults until saved, in the shape the dashboard reads", async () => {
    const res = await call("GET", "/white-label");
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      user_id: OWNER, brand_name: "", logo_url: "", primary_color: "#6366f1", support_email: "",
      footer_text: "", hide_seentics: false, updated_at: null,
    });
  });

  it("PATCH saves, normalises, merges, and is per owner", async () => {
    const res = await call("PATCH", "/white-label", {
      brand_name: "  Northwind ", logo_url: "https://cdn.nw.example/logo.png", primary_color: "#ABC",
      support_email: "Help@NW.example", hide_seentics: true,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({
      brand_name: "Northwind", logo_url: "https://cdn.nw.example/logo.png", primary_color: "#aabbcc",
      support_email: "Help@NW.example", hide_seentics: true,
    });
    const merged = (await (await call("PATCH", "/white-label", { footer_text: "Made by Northwind", logo_url: null })).json()).data;
    expect(merged).toMatchObject({ brand_name: "Northwind", footer_text: "Made by Northwind", logo_url: "" });
    expect((await (await call("GET", "/white-label", undefined, OTHER_OWNER)).json()).data.brand_name).toBe("");
  });

  it("PATCH refuses unsafe or malformed values", async () => {
    for (const body of [
      { logo_url: "http://cdn.example/logo.png" },
      { logo_url: "javascript:alert(1)" },
      { logo_url: "data:image/png;base64,AAAA" },
      { logo_url: "https://user:pass@cdn.example/logo.png" },
      { logo_url: `https://cdn.example/${"a".repeat(1100)}.png` },
      { primary_color: "red" },
      { primary_color: "#12345" },
      { primary_color: "#1234567" },
      { brand_name: "x".repeat(81) },
      { brand_name: "evil\u0000name" },
      { footer_text: "y".repeat(201) },
      { support_email: "not-an-email" },
      { custom_domain: "stats.example" },
      { hide_seentics: "yes" },
      { user_id: OTHER_OWNER },
    ]) {
      const res = await call("PATCH", "/white-label", body);
      expect([res.status, body]).toEqual([400, body]);
      expect((await res.json()).error).toBe("validation_error");
    }
    expect((await call("GET", "/white-label")).status).toBe(200);
    expect((await (await call("GET", "/white-label")).json()).data.updated_at).toBeNull();
  });
});

describe("/client-users", () => {
  it("POST invites and shows the link once; list, get, revoke, resend, delete", async () => {
    const created = await call("POST", "/client-users", { client_id: CLIENT_A, email: "Jane@A.co", name: "Jane" });
    expect(created.status).toBe(201);
    const { client_user, link } = (await created.json()).data;
    expect(Object.keys(client_user).sort()).toEqual(["client_id", "created_at", "email", "id", "last_seen_at", "link_expires_at", "name", "status", "updated_at"]);
    expect(client_user).toMatchObject({ client_id: CLIENT_A, email: "jane@a.co", name: "Jane", status: "invited", last_seen_at: null });
    expect(Object.keys(link).sort()).toEqual(["client_id", "created_at", "expires_at", "id", "portal_url", "token"]);
    expect(link.portal_url).toBe(`${testConfig().frontendUrl}/client-portal/${link.token}`);
    expect(client_user.link_expires_at).toBe(link.expires_at);

    const listed = (await (await call("GET", `/client-users?client_id=${CLIENT_A}`)).json()).data;
    expect(listed.map((u: { id: string }) => u.id)).toEqual([client_user.id]);
    // A token is never listed again.
    expect(JSON.stringify(listed)).not.toContain(link.token);
    expect((await (await call("GET", "/client-users", undefined, OTHER_OWNER)).json()).data).toEqual([]);
    expect((await call("GET", `/client-users/${client_user.id}`)).status).toBe(200);
    expect((await call("GET", `/client-users/${client_user.id}`, undefined, OTHER_OWNER)).status).toBe(404);
    expect((await call("GET", "/client-users/not-a-uuid")).status).toBe(404);

    const resent = await call("POST", `/client-users/${client_user.id}/resend`);
    expect(resent.status).toBe(200);
    const fresh = (await resent.json()).data.link.token;
    expect(fresh).not.toBe(link.token);
    expect((await validate({ token: link.token })).status).toBe(401);
    expect((await validate({ token: fresh })).status).toBe(200);

    const revoked = await call("POST", `/client-users/${client_user.id}/revoke`);
    expect(revoked.status).toBe(200);
    expect((await revoked.json()).data).toMatchObject({ status: "revoked", link_expires_at: null });
    expect((await validate({ token: fresh })).status).toBe(401);
    expect(await (await call("POST", `/client-users/${client_user.id}/resend`)).json()).toEqual({ error: "client_user_revoked" });

    expect((await call("DELETE", `/client-users/${client_user.id}`, undefined, OTHER_OWNER)).status).toBe(404);
    expect((await call("DELETE", `/client-users/${client_user.id}`)).status).toBe(204);
    expect((await call("DELETE", `/client-users/${client_user.id}`)).status).toBe(404);
  });

  it("refuses another owner's client, a duplicate, and bad bodies", async () => {
    const foreign = await call("POST", "/client-users", { client_id: FOREIGN, email: "x@y.co" });
    expect([foreign.status, await foreign.json()]).toEqual([404, { error: "client_not_found" }]);
    expect((await call("POST", "/client-users", { client_id: CLIENT_A, email: "x@y.co" })).status).toBe(201);
    const dup = await call("POST", "/client-users", { client_id: CLIENT_A, email: "X@Y.co" });
    expect([dup.status, await dup.json()]).toEqual([409, { error: "client_user_exists" }]);
    for (const body of [{ email: "x@y.co" }, { client_id: CLIENT_A }, { client_id: CLIENT_A, email: "nope" }, { client_id: "abc", email: "x@y.co" }, { client_id: CLIENT_A, email: "z@y.co", password: "hunter2" }]) {
      expect((await call("POST", "/client-users", body)).status).toBe(400);
    }
    expect((await call("GET", "/client-users?client_id=nope")).status).toBe(400);
    expect((await call("POST", `/client-users/${CLIENT_A}/revoke`)).status).toBe(404);
  });
});

describe("/clients/:clientId/portal-token", () => {
  it("makes the anonymous link in the shape the dashboard reads, replacing the last", async () => {
    const res = await call("POST", `/clients/${CLIENT_A}/portal-token`);
    expect(res.status).toBe(201);
    const first = (await res.json()).data;
    expect(first).toMatchObject({ client_id: CLIENT_A });
    for (const k of ["id", "client_id", "token", "expires_at", "created_at"]) expect(typeof first[k]).toBe("string");
    const second = (await (await call("POST", `/clients/${CLIENT_A}/portal-token`)).json()).data;
    expect((await validate({ token: first.token })).status).toBe(401);
    expect((await validate({ token: second.token })).status).toBe(200);
    expect((await call("DELETE", `/clients/${CLIENT_A}/portal-token`)).status).toBe(204);
    expect((await validate({ token: second.token })).status).toBe(401);
  });

  it("is not found for another owner's or a malformed client", async () => {
    expect((await call("POST", `/clients/${FOREIGN}/portal-token`)).status).toBe(404);
    expect((await call("POST", "/clients/nope/portal-token")).status).toBe(404);
    expect((await call("DELETE", `/clients/${FOREIGN}/portal-token`)).status).toBe(404);
  });
});

describe("POST /agency/portal/validate", () => {
  it("answers the client, its websites, its sections and the brand — never cached", async () => {
    await call("PATCH", "/white-label", { brand_name: "Northwind", hide_seentics: true });
    const { link } = (await (await call("POST", "/client-users", { client_id: CLIENT_A, email: "jane@a.co", name: "Jane" })).json()).data;
    const res = await validate({ token: link.token });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const data = (await res.json()).data;
    expect(data).toEqual({
      client: { id: CLIENT_A, name: "Client A", company: "A Co", status: "active", features_enabled: expect.any(Object) },
      websites: [{ id: "11111111-1111-4111-8111-111111111111", name: "A shop", url: "a.shop" }],
      sections: ["analytics", "recordings"],
      brand: { brand_name: "Northwind", logo_url: "", primary_color: "#6366f1", support_email: "", footer_text: "", hide_seentics: true },
      client_user: { name: "Jane", email: "jane@a.co" },
      expires_at: link.expires_at,
      embed_url: `${FRONTEND}/embed/${CLIENT_A}?token=${link.token}&client=1`,
    });
    // First use activates the user.
    const users = (await (await call("GET", "/client-users")).json()).data;
    expect(users[0]).toMatchObject({ status: "active" });
    expect(users[0].last_seen_at).not.toBeNull();
  });

  it("gives every bad token the same 401", async () => {
    const { token } = (await (await call("POST", `/clients/${CLIENT_A}/portal-token`)).json()).data;
    const bodies = [{ token: "scp_" + "A".repeat(43) }, { token: token.slice(0, -2) }, { token: "nope" }, { token: token.replace("scp_", "") }];
    for (const body of bodies) {
      const res = await validate(body);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "This portal link is invalid or has expired.", code: "invalid_portal_token" });
    }
    expect((await validate({})).status).toBe(400);
    expect((await validate({ token: "x".repeat(300) })).status).toBe(400);
  });

  it("is rate limited per IP when limiting is on", async () => {
    rateLimited = true;
    const ip = `198.51.100.${Math.floor(Math.random() * 250)}`;
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await validate({ token: "nope" }, ip)).status);
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
