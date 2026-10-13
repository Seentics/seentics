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

const upserts: any[] = [];
const updates: any[] = [];
let stored: any = null;
let view: any = null;

const unused = async () => { throw new Error("not used by this test"); };
mock.module("../repositories/integration.repository", () => ({
  DELIVERIES_KEPT_PER_CONNECTION: 200,
  upsertConnection: async (i: unknown) => { upserts.push(i); },
  updateConnection: async (...a: unknown[]) => { updates.push(a); return true; },
  getStoredConnection: async () => stored,
  getConnectionView: async () => view,
  listConnectionViews: async () => (view ? [view] : []),
  deleteConnection: async () => !!stored,
  recentDeliveries: async () => [],
  listEnabledConnections: unused, recordDelivery: unused, countConnections: unused, purgeDeliveriesBefore: unused,
}));

const { ConnectionService } = await import("../services/connection.service");

const vault = new Vault({ current: Buffer.alloc(32, 5).toString("base64"), previous: [] });
const WEBSITE = "550e8400-e29b-41d4-a716-446655440000";
const TOKEN = "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx";

let status = 200;
let body = "{}";
const calls: HttpRequest[] = [];
const ctx: ProviderContext = { async request(r) { calls.push(r); return { status, text: body }; }, async assertPublicUrl() {} };
const service = () => new ConnectionService({ vault, ephemeralDevKey: false }, ctx);

beforeEach(() => { upserts.length = 0; updates.length = 0; calls.length = 0; stored = null; view = null; status = 200; body = "{}"; });

const viewRow = { provider: "hubspot", enabled: true, status: "active", config: {}, credentials_hint: "uvwx", consecutive_failures: 0, last_error: null, last_attempt_at: null, last_success_at: null, created_at: "", updated_at: "" };

describe("connect", () => {
  it("verifies with the provider, then stores the credentials encrypted", async () => {
    view = viewRow;
    const r = await service().connect(WEBSITE, "hubspot", { credentials: { access_token: TOKEN }, config: {} });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(upserts).toHaveLength(1);
    const saved = upserts[0];
    expect(saved.credentials).not.toContain(TOKEN);
    expect(JSON.parse(vault.decrypt(saved.credentials, `${WEBSITE}:hubspot`))).toEqual({ access_token: TOKEN });
    expect(saved.hint).toBe("uvwx");
  });

  it("never returns credentials, only the masked hint", async () => {
    view = viewRow;
    const r = await service().connect(WEBSITE, "hubspot", { credentials: { access_token: TOKEN }, config: {} });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(r)).toContain("uvwx");
  });

  it("stores nothing when the provider rejects the credentials, and redacts the echo", async () => {
    status = 401; body = JSON.stringify({ message: `bad token ${TOKEN}` });
    const r = await service().connect(WEBSITE, "hubspot", { credentials: { access_token: TOKEN }, config: {} });
    expect(r).toMatchObject({ ok: false, code: "rejected" });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(upserts).toHaveLength(0);
  });

  it("reports an unreachable provider as unavailable, not as bad credentials", async () => {
    status = 503;
    expect(await service().connect(WEBSITE, "hubspot", { credentials: { access_token: TOKEN }, config: {} })).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("rejects malformed input before any network call", async () => {
    expect(await service().connect(WEBSITE, "hubspot", { credentials: { access_token: "x" }, config: {} })).toMatchObject({ ok: false, code: "invalid" });
    expect(await service().connect(WEBSITE, "mailchimp", { credentials: { api_key: `${"0123456789abcdef".repeat(2)}-us21` }, config: {} })).toMatchObject({ ok: false, code: "invalid" });
    expect(await service().connect(WEBSITE, "nope", { credentials: {}, config: {} })).toMatchObject({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });

  it("refuses to store credentials in production without an encryption key", async () => {
    const noKey = new ConnectionService({ vault: null, reason: "INTEGRATIONS_ENCRYPTION_KEY is not set" }, ctx);
    const r = await noKey.connect(WEBSITE, "hubspot", { credentials: { access_token: TOKEN }, config: {} });
    expect(r).toMatchObject({ ok: false, code: "no_key" });
    expect(upserts).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe("update", () => {
  it("toggles enabled without any network call", async () => {
    stored = { id: "x", website_id: WEBSITE, provider: "hubspot", credentials: "", config: {}, enabled: true };
    view = { ...viewRow, enabled: false };
    expect((await service().update(WEBSITE, "hubspot", { enabled: false })).ok).toBe(true);
    expect(updates[0]).toEqual([WEBSITE, "hubspot", { enabled: false }]);
    expect(calls).toHaveLength(0);
  });

  it("re-verifies a config change with the stored credentials", async () => {
    stored = { id: "x", website_id: WEBSITE, provider: "mailchimp", enabled: true, config: { audience_id: "a1b2c3d4e5", double_opt_in: false },
      credentials: vault.encrypt(JSON.stringify({ api_key: `${"0123456789abcdef".repeat(2)}-us21` }), `${WEBSITE}:mailchimp`) };
    view = { ...viewRow, provider: "mailchimp" };
    status = 404;
    const bad = await service().update(WEBSITE, "mailchimp", { config: { audience_id: "zzzzzzzzzz", double_opt_in: true } });
    expect(bad).toMatchObject({ ok: false, code: "rejected" });
    expect(updates).toHaveLength(0);
    expect(calls[0]!.url).toContain("/lists/zzzzzzzzzz");

    status = 200;
    expect((await service().update(WEBSITE, "mailchimp", { config: { audience_id: "newaudience1", double_opt_in: true } })).ok).toBe(true);
    expect(updates[0][2].config).toEqual({ audience_id: "newaudience1", double_opt_in: true });
  });

  it("asks to reconnect when stored credentials cannot be opened", async () => {
    stored = { id: "x", website_id: WEBSITE, provider: "hubspot", credentials: "v1.deadbeef.AAAA.AAAA.AAAA", config: {}, enabled: true };
    expect(await service().update(WEBSITE, "hubspot", { config: {} })).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("404s for a connection that does not exist", async () => {
    expect(await service().update(WEBSITE, "hubspot", { enabled: true })).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("sendTest, disconnect and list", () => {
  it("sends a marked test lead through the stored connection", async () => {
    stored = { id: "x", website_id: WEBSITE, provider: "hubspot", config: {}, enabled: true, credentials: vault.encrypt(JSON.stringify({ access_token: TOKEN }), `${WEBSITE}:hubspot`) };
    const r = await service().sendTest(WEBSITE, "hubspot");
    expect(r).toMatchObject({ ok: true, value: { kind: "ok" } });
    expect(calls[0]!.body).toContain("seentics-test@example.com");
  });

  it("lists every provider with its connection state and no secrets", async () => {
    view = viewRow;
    const list = await service().list(WEBSITE);
    expect(list.map((p) => p.id)).toEqual(["zapier", "mailchimp", "klaviyo", "hubspot"]);
    expect(list.find((p) => p.id === "hubspot")!.connection?.credentials_hint).toBe("uvwx");
    expect(list.find((p) => p.id === "zapier")!.connection).toBeNull();
    expect(JSON.stringify(list)).not.toContain("credentials\":");
  });

  it("disconnects", async () => {
    stored = {};
    expect(await service().disconnect(WEBSITE, "hubspot")).toBe(true);
    stored = null;
    expect(await service().disconnect(WEBSITE, "hubspot")).toBe(false);
  });
});
