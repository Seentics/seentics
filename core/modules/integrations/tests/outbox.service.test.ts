import { beforeEach, describe, expect, it, mock } from "bun:test";

const enqueued: any[] = [];
let statusRows: any[] = [];
const forgotten: any[] = [];
const failedAsked: any[] = [];
const unused = async () => { throw new Error("not used by this test"); };
// Complete on purpose: a mock.module stub must export everything the real module does.
mock.module("../repositories/delivery.repository", () => ({
  LEASE_SECONDS: 60, PAYLOAD_RETENTION_DAYS: 30,
  enqueueDeliveries: async (i: unknown) => { enqueued.push(i); return 2; },
  deliveriesOfSubmissions: async () => statusRows,
  forgetSubmissions: async (...a: unknown[]) => { forgotten.push(a); },
  failedSubmissionIds: async (...a: unknown[]) => { failedAsked.push(a); return ["s2"]; },
  claimDue: unused, completeAttempt: unused, requeueFailed: unused, recentDeliveries: unused, purgeDeliveries: unused,
}));

const { OutboxService } = await import("../services/outbox.service");

const lead = {
  submissionId: "s1", submittedAt: "2026-10-13T00:00:00Z", prize: null,
  submission: { websiteId: "w1", email: "a@b.co", name: "A B", phone: "", consent: true, fields: {}, anonymousId: null, sessionId: null, automationId: "a1", variant: null, pageUrl: "", referrer: "" },
};

beforeEach(() => { enqueued.length = 0; forgotten.length = 0; statusRows = []; });

describe("OutboxService", () => {
  it("queues a flat payload for the website's destinations", async () => {
    expect(await new OutboxService(() => {}).enqueue(lead, null)).toBe(2);
    expect(enqueued[0]).toMatchObject({ websiteId: "w1", submissionId: "s1", automationId: "a1", destinationIds: null, payload: { email: "a@b.co", firstName: "A", lastName: "B", submissionId: "s1" } });
  });

  it("passes through the destinations a form names", async () => {
    await new OutboxService(() => {}).enqueue(lead, ["d1"]);
    expect(enqueued[0].destinationIds).toEqual(["d1"]);
  });

  it("queues nothing, without touching the database, for a form that routes nowhere", async () => {
    expect(await new OutboxService(() => {}).enqueue(lead, [])).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it("wakes the worker on kick", () => {
    let woke = 0;
    new OutboxService(() => woke++).kick();
    expect(woke).toBe(1);
  });

  it("groups delivery state by submission", async () => {
    statusRows = [
      { id: "d1", submission_id: "s1", connection_id: "c1", connection_name: "Slack", provider: "zapier", status: "success", attempt_count: 1, error: null, completed_at: "t" },
      { id: "d2", submission_id: "s1", connection_id: "c2", connection_name: "CRM", provider: "hubspot", status: "failed", attempt_count: 6, error: "x", completed_at: "t" },
      { id: "d3", submission_id: "s2", connection_id: "c1", connection_name: "Slack", provider: "zapier", status: "pending", attempt_count: 0, error: null, completed_at: null },
    ];
    const map = await new OutboxService(() => {}).statuses("w1", ["s1", "s2"]);
    expect(map.get("s1")!.map((d) => d.connection_name)).toEqual(["Slack", "CRM"]);
    expect(map.get("s2")).toHaveLength(1);
    expect(map.get("s1")![0]).not.toHaveProperty("submission_id");
    expect(map.get("s1")!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(map.get("s3")).toBeUndefined();
  });

  it("forgets erased submissions", async () => {
    await new OutboxService(() => {}).forget("w1", ["s1"]);
    expect(forgotten).toEqual([["w1", ["s1"]]]);
  });

  it("names the submissions a destination could not take, for the leads inbox", async () => {
    const since = new Date("2026-10-01T00:00:00Z");
    expect(await new OutboxService(() => {}).failedSubmissionIds("w1", since, 50)).toEqual(["s2"]);
    expect(failedAsked).toEqual([["w1", since, 50]]);
  });
});
