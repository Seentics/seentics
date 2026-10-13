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

type Stored = { id: string; website_id: string; provider: string; credentials: string; config: Record<string, unknown>; enabled: boolean };
let connections: Stored[] = [];
const recorded: any[] = [];

// Complete on purpose: a mock.module stub must export everything the real module does.
const unused = async () => { throw new Error("not used by this test"); };
mock.module("../repositories/integration.repository", () => ({
  DELIVERIES_KEPT_PER_CONNECTION: 200,
  listEnabledConnections: async () => connections,
  recordDelivery: async (input: unknown) => { recorded.push(input); return { disabled: false }; },
  listConnectionViews: unused, getConnectionView: unused, getStoredConnection: unused, upsertConnection: unused,
  updateConnection: unused, deleteConnection: unused, recentDeliveries: unused, countConnections: unused, purgeDeliveriesBefore: unused,
}));

const { DeliveryService, splitName, toLeadPayload } = await import("../services/delivery.service");

const KEY = Buffer.alloc(32, 9).toString("base64");
const vault = new Vault({ current: KEY, previous: [] });
const WEBSITE = "550e8400-e29b-41d4-a716-446655440000";
const seal = (provider: string, creds: object) => vault.encrypt(JSON.stringify(creds), `${WEBSITE}:${provider}`);

const HUBSPOT_TOKEN = "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx";
const MAILCHIMP_KEY = `${"0123456789abcdef".repeat(2)}-us21`;

const lead = (over: Partial<{ consent: boolean }> = {}) => ({
  contactId: "c1", isNewContact: true,
  submission: { websiteId: WEBSITE, email: "jane@example.com", name: "Jane Doe", phone: "", consent: over.consent ?? true, fields: {}, automationId: null, variant: null, pageUrl: "/p", referrer: "" },
});

type Reply = { status: number; body?: string } | "throw";
function ctxWith(handler: (req: HttpRequest) => Reply) {
  const calls: HttpRequest[] = [];
  const ctx: ProviderContext = {
    async request(req) {
      calls.push(req);
      const r = handler(req);
      if (r === "throw") { const { TransportError } = await import("../lib/http"); throw new TransportError("could not reach the service"); }
      return { status: r.status, text: r.body ?? "{}" };
    },
    async assertPublicUrl() {},
  };
  return { ctx, calls };
}

const conn = (provider: string, creds: object, config: Record<string, unknown> = {}): Stored =>
  ({ id: `conn-${provider}`, website_id: WEBSITE, provider, credentials: seal(provider, creds), config, enabled: true });

const noWait = async () => {};
const service = (ctx: ProviderContext) => new DeliveryService({ vault, ephemeralDevKey: false }, ctx, { maxAttempts: 3, baseDelayMs: 1 }, noWait);

beforeEach(() => { connections = []; recorded.length = 0; });

describe("splitName", () => {
  it("splits first and last", () => {
    expect(splitName("  Jane van Doe ")).toEqual({ firstName: "Jane", lastName: "van Doe" });
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });
  it("maps a captured lead to the payload providers use", () => {
    expect(toLeadPayload(lead())).toMatchObject({ email: "jane@example.com", firstName: "Jane", lastName: "Doe", consent: true, contactId: "c1" });
  });
});

describe("DeliveryService", () => {
  it("delivers to every enabled connection and logs each as a success", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN }), conn("mailchimp", { api_key: MAILCHIMP_KEY }, { audience_id: "a1b2c3d4e5", double_opt_in: false })];
    const { ctx, calls } = ctxWith(() => ({ status: 200 }));
    await service(ctx).handle(lead());
    expect(calls).toHaveLength(2);
    // Deliveries run concurrently, so completion order is not connection order.
    expect(recorded.map((r) => [r.connectionId, r.status]).sort()).toEqual([["conn-hubspot", "success"], ["conn-mailchimp", "success"]]);
    expect(recorded.every((r) => r.websiteId === WEBSITE && r.contactId === "c1")).toBe(true);
  });

  it("does nothing when no connection is enabled", async () => {
    const { ctx, calls } = ctxWith(() => ({ status: 200 }));
    await service(ctx).handle(lead());
    expect(calls).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });

  it("isolates connections: one provider failing does not stop the other", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN }), conn("mailchimp", { api_key: MAILCHIMP_KEY }, { audience_id: "a1b2c3d4e5", double_opt_in: false })];
    const { ctx } = ctxWith((req) => (req.url.includes("hubapi") ? { status: 400, body: '{"message":"bad"}' } : { status: 200 }));
    await service(ctx).handle(lead());
    const byConn = Object.fromEntries(recorded.map((r) => [r.connectionId, r]));
    expect(byConn["conn-hubspot"].status).toBe("failed");
    expect(byConn["conn-hubspot"].attempts).toBe(1);
    expect(byConn["conn-mailchimp"].status).toBe("success");
  });

  it("retries a 5xx up to the budget and records the attempts", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN })];
    const { ctx, calls } = ctxWith(() => ({ status: 503 }));
    await service(ctx).handle(lead());
    expect(calls).toHaveLength(3);
    expect(recorded[0]).toMatchObject({ status: "failed", attempts: 3, httpStatus: 503, disableNow: false });
  });

  it("recovers when a retry succeeds", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN })];
    let n = 0;
    const { ctx } = ctxWith(() => (++n < 2 ? "throw" : { status: 200 }));
    await service(ctx).handle(lead());
    expect(recorded[0]).toMatchObject({ status: "success", attempts: 2 });
  });

  it("asks for the connection to be switched off at once when the credential is refused", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN })];
    const { ctx, calls } = ctxWith(() => ({ status: 401, body: "{}" }));
    await service(ctx).handle(lead());
    expect(calls).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ status: "failed", disableNow: true, disableAfter: 5 });
  });

  it("logs a skipped lead (no consent) without touching health", async () => {
    connections = [conn("mailchimp", { api_key: MAILCHIMP_KEY }, { audience_id: "a1b2c3d4e5", double_opt_in: false })];
    const { ctx, calls } = ctxWith(() => ({ status: 200 }));
    await service(ctx).handle(lead({ consent: false }));
    expect(calls).toHaveLength(0);
    expect(recorded[0]).toMatchObject({ status: "skipped", error: "No marketing consent given", disableNow: false });
  });

  it("never lets a secret reach the delivery log", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN })];
    const { ctx } = ctxWith(() => ({ status: 400, body: JSON.stringify({ message: `invalid token ${HUBSPOT_TOKEN}` }) }));
    await service(ctx).handle(lead());
    expect(recorded[0].error).toContain("[redacted]");
    expect(recorded[0].error).not.toContain(HUBSPOT_TOKEN);
  });

  it("records a failure, not a crash, for credentials it cannot open", async () => {
    connections = [{ ...conn("hubspot", { access_token: HUBSPOT_TOKEN }), credentials: "v1.deadbeef.AAAA.AAAA.AAAA" }];
    const { ctx, calls } = ctxWith(() => ({ status: 200 }));
    await service(ctx).handle(lead());
    expect(calls).toHaveLength(0);
    expect(recorded[0]).toMatchObject({ status: "failed", error: "could not prepare delivery" });
  });

  it("will not open a ciphertext copied from another website's connection", async () => {
    const other = vault.encrypt(JSON.stringify({ access_token: HUBSPOT_TOKEN }), "another-site:hubspot");
    connections = [{ ...conn("hubspot", { access_token: HUBSPOT_TOKEN }), credentials: other }];
    const { ctx, calls } = ctxWith(() => ({ status: 200 }));
    await service(ctx).handle(lead());
    expect(calls).toHaveLength(0);
    expect(recorded[0].status).toBe("failed");
  });

  it("fails loudly, per connection, when production has no encryption key", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN })];
    const { ctx, calls } = ctxWith(() => ({ status: 200 }));
    await new DeliveryService({ vault: null, reason: "INTEGRATIONS_ENCRYPTION_KEY is not set" }, ctx).handle(lead());
    expect(calls).toHaveLength(0);
    expect(recorded[0]).toMatchObject({ status: "failed" });
    expect(recorded[0].error).toContain("INTEGRATIONS_ENCRYPTION_KEY");
  });

  it("limits how many deliveries run at once", async () => {
    connections = Array.from({ length: 20 }, (_, i) => ({ ...conn("hubspot", { access_token: HUBSPOT_TOKEN }), id: `c${i}` }));
    let active = 0, peak = 0;
    const ctx: ProviderContext = {
      async request() { active++; peak = Math.max(peak, active); await Bun.sleep(5); active--; return { status: 200, text: "{}" }; },
      async assertPublicUrl() {},
    };
    await service(ctx).handle(lead());
    expect(recorded).toHaveLength(20);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it("drain waits for deliveries in flight", async () => {
    connections = [conn("hubspot", { access_token: HUBSPOT_TOKEN })];
    const ctx: ProviderContext = { async request() { await Bun.sleep(30); return { status: 200, text: "{}" }; }, async assertPublicUrl() {} };
    const svc = service(ctx);
    void svc.handle(lead());
    await svc.drain();
    expect(recorded).toHaveLength(1);
  });
});
