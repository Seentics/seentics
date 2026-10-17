import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testConfig } from "../../../app/tests/helpers/test-config";

mock.module("../../../config", () => ({ env: () => testConfig() }));
mock.module("../../../platform/observability/logger", () => {
  const logger: Record<string, unknown> = { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) };
  logger.child = () => logger;
  return { log: logger };
});

import { Vault } from "../lib/vault";
import type { HttpRequest, ProviderContext } from "../interfaces";

const inserted: any[] = [];
const updates: any[] = [];
let stored: any = null;
let view: any = null;
let count = 0;
let requeue: "requeued" | "disabled" | "not_found" = "requeued";

// Complete on purpose: a mock.module stub must export everything the real module does.
mock.module("../repositories/connection.repository", () => ({
  insertConnection: async (i: unknown) => { inserted.push(i); },
  updateConnection: async (...a: unknown[]) => { updates.push(a); return true; },
  getStoredConnection: async () => stored,
  getConnectionView: async () => view,
  listConnectionViews: async () => (view ? [view] : []),
  deleteConnection: async () => !!stored,
  countConnectionsOf: async () => count,
  countConnections: async () => count,
}));
const unused = async () => { throw new Error("not used by this test"); };
mock.module("../repositories/delivery.repository", () => ({
  LEASE_SECONDS: 60, PAYLOAD_RETENTION_DAYS: 30,
  recentDeliveries: async () => [],
  requeueFailed: async () => requeue,
  enqueueDeliveries: unused, claimDue: unused, completeAttempt: unused, deliveriesOfSubmissions: unused,
  forgetSubmissions: unused, purgeDeliveries: unused,
}));

const { ConnectionService, MAX_CONNECTIONS_PER_WEBSITE } = await import("../services/connection.service");

const vault = new Vault({ current: Buffer.alloc(32, 5).toString("base64"), previous: [] });
const WEBSITE = "550e8400-e29b-41d4-a716-446655440000";
const CONN = "11111111-1111-4111-8111-111111111111";
const TOKEN = "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx";

let status = 200;
let body = "{}";
const calls: HttpRequest[] = [];
const ctx: ProviderContext = { async request(r) { calls.push(r); return { status, text: body }; }, async assertPublicUrl() {} };
const service = () => new ConnectionService({ vault, ephemeralDevKey: false }, ctx);

beforeEach(() => {
  inserted.length = 0; updates.length = 0; calls.length = 0; stored = null; view = null; count = 0; requeue = "requeued";
  status = 200; body = "{}";
});

const viewRow = {
  id: CONN, provider: "hubspot", name: "HubSpot", enabled: true, status: "active", config: {}, credentials_hint: "uvwx",
  consecutive_failures: 0, last_error: null, last_attempt_at: null, last_success_at: null, pending_count: 0, created_at: "", updated_at: "",
};
const hubspotInput = { provider: "hubspot", credentials: { access_token: TOKEN }, config: {} };

describe("connect", () => {
  it("verifies with the provider, then stores the credentials encrypted against this destination", async () => {
    view = viewRow;
    const r = await service().connect(WEBSITE, { ...hubspotInput, name: "  Sales CRM " });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(inserted).toHaveLength(1);
    const saved = inserted[0];
    expect(saved.name).toBe("Sales CRM");
    expect(saved.credentials).not.toContain(TOKEN);
    expect(JSON.parse(vault.decrypt(saved.credentials, `${WEBSITE}:${saved.id}`))).toEqual({ access_token: TOKEN });
    expect(() => vault.decrypt(saved.credentials, `${WEBSITE}:hubspot`)).toThrow();
    expect(saved.hint).toBe("uvwx");
  });

  it("names a destination after its provider when no name is given", async () => {
    view = viewRow;
    await service().connect(WEBSITE, hubspotInput);
    expect(inserted[0].name).toBe("HubSpot");
  });

  it("allows several destinations of one provider", async () => {
    view = viewRow;
    count = 1;
    await service().connect(WEBSITE, { provider: "zapier", name: "Slack", credentials: { webhook_url: "https://hooks.zapier.com/hooks/catch/1/a/" }, config: {} });
    await service().connect(WEBSITE, { provider: "zapier", name: "Sheet", credentials: { webhook_url: "https://hooks.zapier.com/hooks/catch/2/b/" }, config: {} });
    expect(inserted.map((i) => i.name)).toEqual(["Slack", "Sheet"]);
    expect(inserted[0].id).not.toBe(inserted[1].id);
  });

  it("stops at the per-website limit, before any network call", async () => {
    count = MAX_CONNECTIONS_PER_WEBSITE;
    expect(await service().connect(WEBSITE, hubspotInput)).toMatchObject({ ok: false, code: "connection_limit" });
    expect(calls).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("never returns credentials, only the masked hint", async () => {
    view = viewRow;
    const r = await service().connect(WEBSITE, hubspotInput);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(r)).toContain("uvwx");
  });

  it("stores nothing when the provider rejects the credentials, and redacts the echo", async () => {
    status = 401; body = JSON.stringify({ message: `bad token ${TOKEN}` });
    const r = await service().connect(WEBSITE, hubspotInput);
    expect(r).toMatchObject({ ok: false, code: "rejected" });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(inserted).toHaveLength(0);
  });

  it("reports an unreachable provider as unavailable, not as bad credentials", async () => {
    status = 503;
    expect(await service().connect(WEBSITE, hubspotInput)).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("reports a refused webhook address as invalid input, not as the service being down", async () => {
    const { UnsafeUrlError } = await import("../lib/http");
    const refusing: ProviderContext = { ...ctx, async assertPublicUrl() { throw new UnsafeUrlError("URL resolves to a non-public address"); } };
    const r = await new ConnectionService({ vault, ephemeralDevKey: false }, refusing)
      .connect(WEBSITE, { provider: "zapier", credentials: { webhook_url: "https://hooks.internal.example/catch" }, config: {} });
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    expect(inserted).toHaveLength(0);
  });

  it("rejects malformed input before any network call", async () => {
    expect(await service().connect(WEBSITE, { provider: "hubspot", credentials: { access_token: "x" }, config: {} })).toMatchObject({ ok: false, code: "invalid" });
    expect(await service().connect(WEBSITE, { provider: "mailchimp", credentials: { api_key: `${"0123456789abcdef".repeat(2)}-us21` }, config: {} })).toMatchObject({ ok: false, code: "invalid" });
    expect(await service().connect(WEBSITE, { provider: "nope", credentials: {}, config: {} })).toMatchObject({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });

  it("refuses to store credentials in production without an encryption key", async () => {
    const noKey = new ConnectionService({ vault: null, reason: "INTEGRATIONS_ENCRYPTION_KEY is not set" }, ctx);
    expect(await noKey.connect(WEBSITE, hubspotInput)).toMatchObject({ ok: false, code: "no_key" });
    expect(inserted).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe("update", () => {
  const storedHubspot = () => ({ id: CONN, website_id: WEBSITE, provider: "hubspot", name: "HubSpot", credentials: "", config: {}, enabled: true });

  it("toggles enabled and renames without any network call", async () => {
    stored = storedHubspot();
    view = { ...viewRow, enabled: false };
    expect((await service().update(WEBSITE, CONN, { enabled: false, name: " CRM " })).ok).toBe(true);
    expect(updates[0]).toEqual([WEBSITE, CONN, { enabled: false, name: "CRM" }]);
    expect(calls).toHaveLength(0);
  });

  it("re-verifies a config change with the stored credentials", async () => {
    stored = { ...storedHubspot(), provider: "mailchimp", config: { audience_id: "a1b2c3d4e5", double_opt_in: false },
      credentials: vault.encrypt(JSON.stringify({ api_key: `${"0123456789abcdef".repeat(2)}-us21` }), `${WEBSITE}:${CONN}`) };
    view = { ...viewRow, provider: "mailchimp" };
    status = 404;
    const bad = await service().update(WEBSITE, CONN, { config: { audience_id: "zzzzzzzzzz", double_opt_in: true } });
    expect(bad).toMatchObject({ ok: false, code: "rejected" });
    expect(updates).toHaveLength(0);
    expect(calls[0]!.url).toContain("/lists/zzzzzzzzzz");

    status = 200;
    expect((await service().update(WEBSITE, CONN, { config: { audience_id: "newaudience1", double_opt_in: true } })).ok).toBe(true);
    expect(updates[0][2].config).toEqual({ audience_id: "newaudience1", double_opt_in: true });
    expect(updates[0][2].credentials).toBeUndefined();
  });

  it("seals replacement credentials against the same destination", async () => {
    stored = storedHubspot();
    view = viewRow;
    await service().update(WEBSITE, CONN, { credentials: { access_token: TOKEN } });
    const patch = updates[0][2];
    expect(JSON.parse(vault.decrypt(patch.credentials.sealed, `${WEBSITE}:${CONN}`))).toEqual({ access_token: TOKEN });
    expect(patch.credentials.hint).toBe("uvwx");
  });

  it("asks to reconnect when stored credentials cannot be opened", async () => {
    stored = { ...storedHubspot(), credentials: "v1.deadbeef.AAAA.AAAA.AAAA" };
    expect(await service().update(WEBSITE, CONN, { config: {} })).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("404s for a destination that does not exist", async () => {
    expect(await service().update(WEBSITE, CONN, { enabled: true })).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("sendTest, disconnect, retry and list", () => {
  it("sends a marked test lead through the stored destination", async () => {
    stored = { id: CONN, website_id: WEBSITE, provider: "hubspot", config: {}, enabled: true, credentials: vault.encrypt(JSON.stringify({ access_token: TOKEN }), `${WEBSITE}:${CONN}`) };
    const r = await service().sendTest(WEBSITE, CONN);
    expect(r).toMatchObject({ ok: true, value: { kind: "ok" } });
    expect(calls[0]!.body).toContain("seentics-test@example.com");
  });

  it("lists every provider and the website's destinations, without secrets", async () => {
    view = viewRow;
    const list = await service().list(WEBSITE);
    expect(list.providers.map((p) => p.id)).toEqual(["zapier", "mailchimp", "klaviyo", "hubspot"]);
    expect(list.connections).toHaveLength(1);
    expect(list.connections[0]!.credentials_hint).toBe("uvwx");
    expect(JSON.stringify(list)).not.toContain("credentials\":");
  });

  it("disconnects", async () => {
    stored = {};
    expect(await service().disconnect(WEBSITE, CONN)).toBe(true);
    stored = null;
    expect(await service().disconnect(WEBSITE, CONN)).toBe(false);
  });

  it("retries a failed delivery, and explains why it cannot", async () => {
    expect(await service().retryDelivery(WEBSITE, "d1")).toEqual({ ok: true, value: { id: "d1" } });
    requeue = "disabled";
    expect(await service().retryDelivery(WEBSITE, "d1")).toMatchObject({ ok: false, code: "invalid" });
    requeue = "not_found";
    expect(await service().retryDelivery(WEBSITE, "d1")).toMatchObject({ ok: false, code: "not_found" });
  });
});
