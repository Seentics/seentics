import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testConfig } from "../../../app/tests/helpers/test-config";

mock.module("../../../config", () => ({ env: () => testConfig() }));
mock.module("../../../platform/observability/logger", () => {
  const logger: Record<string, unknown> = { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) };
  logger.child = () => logger;
  return { log: logger };
});

const completed: any[] = [];
let disabledResult = false;
const unused = async () => { throw new Error("not used by this test"); };
// Complete on purpose: a mock.module stub must export everything the real module does.
mock.module("../repositories/delivery.repository", () => ({
  LEASE_SECONDS: 60, PAYLOAD_RETENTION_DAYS: 30,
  completeAttempt: async (i: unknown) => { completed.push(i); return { disabled: disabledResult }; },
  enqueueDeliveries: unused, claimDue: unused, requeueFailed: unused, recentDeliveries: unused,
  deliveriesOfSubmissions: unused, forgetSubmissions: unused, purgeDeliveries: unused,
}));

import { Vault } from "../lib/vault";
import { TransportError } from "../lib/http";
import type { HttpRequest, LeadPayload, ProviderContext } from "../interfaces";
const { DeliveryAttemptService, credentialContext } = await import("../services/delivery-attempt.service");

const vault = new Vault({ current: Buffer.alloc(32, 9).toString("base64"), previous: [] });
const WEBSITE = "550e8400-e29b-41d4-a716-446655440000";
const CONN = "11111111-1111-4111-8111-111111111111";
const HUBSPOT_TOKEN = "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx";
const MAILCHIMP_KEY = `${"0123456789abcdef".repeat(2)}-us21`;
const NOW = Date.parse("2026-10-13T12:00:00Z");

const payload: LeadPayload = {
  submissionId: "5d3f1c0e-8a6b-4f5e-9d2c-1a2b3c4d5e6f", email: "jane@example.com", name: "Jane Doe", firstName: "Jane", lastName: "Doe",
  phone: "", consent: true, fields: {}, prize: null, popupId: null, variant: null, pageUrl: "/p", referrer: "", submittedAt: "2026-10-13T11:59:00Z",
};

type Reply = { status: number; body?: string } | "throw";
let reply: Reply = { status: 200 };
const calls: HttpRequest[] = [];
const ctx: ProviderContext = {
  async request(req) {
    calls.push(req);
    if (reply === "throw") throw new TransportError("could not reach the service");
    return { status: reply.status, text: reply.body ?? "{}" };
  },
  async assertPublicUrl() {},
};

const claimed = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "d1", connection_id: CONN, website_id: WEBSITE, submission_id: payload.submissionId, automation_id: null, payload,
  attempt_count: 0, provider: "hubspot",
  credentials: vault.encrypt(JSON.stringify({ access_token: HUBSPOT_TOKEN }), credentialContext(WEBSITE, CONN)),
  config: {}, ...over,
}) as any;

const service = (v: any = { vault, ephemeralDevKey: false }) => new DeliveryAttemptService(v, ctx, () => NOW);

beforeEach(() => { completed.length = 0; calls.length = 0; reply = { status: 200 }; disabledResult = false; });

describe("a successful attempt", () => {
  it("delivers through the provider with the opened credentials and records success", async () => {
    await service().run(claimed());
    expect(calls[0]!.headers!.Authorization).toBe(`Bearer ${HUBSPOT_TOKEN}`);
    expect(completed[0]).toMatchObject({ deliveryId: "d1", connectionId: CONN, attempts: 1, result: { kind: "success", httpStatus: 200 } });
  });

  it("counts the attempt on top of the ones already made", async () => {
    await service().run(claimed({ attempt_count: 3 }));
    expect(completed[0].attempts).toBe(4);
  });

  it("tells a webhook receiver which delivery this is", async () => {
    const credentials = vault.encrypt(JSON.stringify({ webhook_url: "https://hooks.zapier.com/hooks/catch/1/a/" }), credentialContext(WEBSITE, CONN));
    await service().run(claimed({ provider: "zapier", credentials }));
    expect(calls[0]!.headers!["X-Seentics-Delivery"]).toBe("d1");
    expect(calls[0]!.headers!["Idempotency-Key"]).toBe(payload.submissionId);
  });
});

describe("skipped", () => {
  it("records a lead without consent as skipped, with no request", async () => {
    const credentials = vault.encrypt(JSON.stringify({ api_key: MAILCHIMP_KEY }), credentialContext(WEBSITE, CONN));
    await service().run(claimed({ provider: "mailchimp", credentials, config: { audience_id: "a1b2c3d4e5", double_opt_in: false }, payload: { ...payload, consent: false } }));
    expect(calls).toHaveLength(0);
    expect(completed[0].result).toEqual({ kind: "skipped", httpStatus: null, error: "No marketing consent given" });
  });
});

describe("failures that are retried", () => {
  it("schedules a retry on the back-off schedule after a 5xx", async () => {
    reply = { status: 503, body: "busy" };
    await service().run(claimed());
    expect(completed[0].result).toMatchObject({ kind: "retry", httpStatus: 503 });
    expect(completed[0].result.nextAttemptAt.getTime()).toBe(NOW + 30_000);
  });

  it("retries a transport failure, and a 429", async () => {
    reply = "throw";
    await service().run(claimed({ attempt_count: 1 }));
    expect(completed[0].result).toMatchObject({ kind: "retry", error: "could not reach the service" });
    expect(completed[0].result.nextAttemptAt.getTime()).toBe(NOW + 120_000);
    reply = { status: 429 };
    await service().run(claimed({ attempt_count: 4 }));
    expect(completed[1].result.nextAttemptAt.getTime()).toBe(NOW + 6 * 3_600_000);
  });

  it("gives up for good on the sixth failed attempt", async () => {
    reply = { status: 500 };
    await service().run(claimed({ attempt_count: 5 }));
    expect(completed[0]).toMatchObject({ attempts: 6, result: { kind: "failed", disableNow: false } });
  });

  it("retries while the encryption key is missing, since the operator can fix that", async () => {
    await service({ vault: null, reason: "INTEGRATIONS_ENCRYPTION_KEY is not set" }).run(claimed());
    expect(completed[0].result).toMatchObject({ kind: "retry", error: "credentials unavailable: INTEGRATIONS_ENCRYPTION_KEY is not set" });
    expect(calls).toHaveLength(0);
  });
});

describe("failures that are final", () => {
  it("does not retry a 4xx the provider will repeat", async () => {
    reply = { status: 400, body: "bad" };
    await service().run(claimed());
    expect(completed[0].result).toMatchObject({ kind: "failed", httpStatus: 400, disableNow: false });
  });

  it("switches the destination off when the credential is refused", async () => {
    reply = { status: 401, body: "nope" };
    await service().run(claimed());
    expect(completed[0].result).toMatchObject({ kind: "failed", httpStatus: 401, disableNow: true });
  });

  it("never puts a credential in the stored error", async () => {
    reply = { status: 400, body: JSON.stringify({ message: `bad token ${HUBSPOT_TOKEN}` }) };
    await service().run(claimed());
    expect(JSON.stringify(completed)).not.toContain(HUBSPOT_TOKEN);
  });

  it("fails, with a message, when the sealed credentials cannot be opened", async () => {
    await service().run(claimed({ credentials: "v1.deadbeef.AAAA.AAAA.AAAA" }));
    expect(completed[0].result).toMatchObject({ kind: "failed", error: "could not prepare delivery", disableNow: false });
  });

  it("does not open credentials sealed for another destination", async () => {
    await service().run(claimed({ credentials: vault.encrypt(JSON.stringify({ access_token: HUBSPOT_TOKEN }), credentialContext(WEBSITE, "other")) }));
    expect(completed[0].result).toMatchObject({ kind: "failed" });
    expect(calls).toHaveLength(0);
  });

  it("fails an unknown provider, a config that no longer parses, and a payload that is gone", async () => {
    await service().run(claimed({ provider: "gone" }));
    expect(completed[0].result).toMatchObject({ kind: "failed", error: "unknown provider" });
    const credentials = vault.encrypt(JSON.stringify({ api_key: MAILCHIMP_KEY }), credentialContext(WEBSITE, CONN));
    await service().run(claimed({ provider: "mailchimp", credentials, config: {} }));
    expect(completed[1].result).toMatchObject({ kind: "failed", error: "could not prepare delivery" });
    await service().run(claimed({ payload: null }));
    expect(completed[2].result).toMatchObject({ kind: "failed", error: "the lead's data is no longer stored" });
    expect(calls).toHaveLength(0);
  });
});

describe("destination health", () => {
  it("asks the repository to disable after five lead failures in a row", async () => {
    reply = { status: 400 };
    disabledResult = true;
    await service().run(claimed());
    expect(completed[0].disableAfter).toBe(5);
  });
});
