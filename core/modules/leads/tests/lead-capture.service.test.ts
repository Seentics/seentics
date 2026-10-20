import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { LeadSubmission, Prize, QueuedLead } from "../interfaces";

mock.module("../../../platform/observability/logger", () => {
  const logger: Record<string, unknown> = { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) };
  logger.child = () => logger;
  return { log: logger };
});

const events: string[] = [];
const inserted: Array<{ id: string; s: LeadSubmission; prize: Prize | null }> = [];
let existingClaim: Prize | null = null;
const claims: Array<{ hash: string; drawn: Prize | null }> = [];
let failRemove = false;

// Complete on purpose: a mock.module stub must export everything the real module does.
const unused = async () => { throw new Error("not used by this test"); };
mock.module("../repositories/submission.repository", () => ({
  SUBMISSION_RETENTION_DAYS: 90,
  insertSubmission: async (id: string, s: LeadSubmission, prize: Prize | null) => { events.push("insert"); inserted.push({ id, s, prize }); },
  removeSubmissionById: async (id: string) => { events.push(`remove:${id}`); if (failRemove) throw new Error("db down"); },
  listSubmissions: unused, formSummary: unused, websiteSummary: unused, exportSubmissions: unused,
  deleteSubmission: unused, countSince: unused, purgeBefore: unused,
  listSiteSubmissions: unused, exportSiteSubmissions: unused, submissionsForEmail: unused, formCounts: unused, deleteSiteSubmission: unused,
  submissionOrigins: unused, submissionCountSince: unused,
}));
let failContact = false;
const touches: unknown[] = [];
mock.module("../repositories/contact.repository", () => ({
  upsertFromSubmission: async (s: LeadSubmission, _at: Date, touch?: unknown) => {
    events.push(`contact:${s.email}`); touches.push(touch);
    if (failContact) throw new Error("contacts down");
  },
  listContacts: unused, exportContacts: unused, getContact: unused, contactIdsByEmail: unused, insertContact: unused,
  updateContact: unused, bulkUpdate: unused, deleteContacts: unused, importContacts: unused, tagCounts: unused,
  newContactsSince: unused,
}));
mock.module("../repositories/prize.repository", () => ({
  claimPrize: async (_w: string, _a: string, hash: string, draw: () => Prize | null) => {
    events.push("claim");
    const prize = existingClaim ?? draw();
    claims.push({ hash, drawn: prize });
    return prize;
  },
}));

const { LeadCaptureService } = await import("../services/lead-capture.service");
const { hashEmail } = await import("../lib/email-hash");

const SITE = "550e8400-e29b-41d4-a716-446655440000";
const KNOWN = "11111111-1111-4111-8111-111111111111";

const base: LeadSubmission = {
  websiteId: SITE, email: "a@b.co", name: "A B", phone: "", consent: true, fields: {},
  anonymousId: null, sessionId: null, automationId: KNOWN, variant: "b", pageUrl: "", referrer: "",
};

let rewards: any = null;
let routing: { destinations: string[] | null } | null = { destinations: null };
const directory = {
  names: async (_w: string, ids: readonly string[]) => new Map(ids.filter((i) => i === KNOWN).map((i) => [i, "Exit popup"])),
  rewards: async () => rewards,
  routing: async () => routing,
};

const enqueued: Array<{ lead: QueuedLead; destinations: readonly string[] | null }> = [];
let queued = 2;
let failEnqueue = false;
let kicks = 0;
const sink = {
  enqueue: async (lead: QueuedLead, destinations: readonly string[] | null) => {
    events.push("enqueue");
    if (failEnqueue) throw new Error("db down");
    enqueued.push({ lead, destinations });
    return queued;
  },
  kick: () => { events.push("kick"); kicks++; },
  statuses: unused, forget: unused, failedSubmissionIds: unused,
};

const service = () => new LeadCaptureService(directory, sink as any, () => "sub-1");

beforeEach(() => {
  events.length = 0; inserted.length = 0; enqueued.length = 0; claims.length = 0;
  existingClaim = null; rewards = null; routing = { destinations: null }; queued = 2; failEnqueue = false; failRemove = false; kicks = 0;
  failContact = false; touches.length = 0;
});

describe("LeadCaptureService", () => {
  it("stores where a new contact first came from: the channel by the dashboard's rules, and the campaign", async () => {
    const seen: unknown[] = [];
    const channels = { classify: (input: unknown) => { seen.push(input); return "paid" as const; } };
    const svc = new LeadCaptureService(directory, sink as any, () => "sub-1", channels as any);
    await svc.capture({ ...base, pageUrl: "https://shop.example/p?utm_source=facebook&utm_medium=cpc&utm_campaign=eid-sale", referrer: "https://m.facebook.com/" });
    expect(touches[0]).toEqual({ channel: "paid", campaign: "eid-sale" });
    expect(seen[0]).toEqual({ referrer: "https://m.facebook.com/", page: "https://shop.example/p?utm_source=facebook&utm_medium=cpc&utm_campaign=eid-sale", utmSource: "facebook", utmMedium: "cpc" });
  });

  it("leaves the channel for the dashboard when it has no rules to classify by, or no page to read", async () => {
    await service().capture({ ...base, pageUrl: "https://shop.example/p?utm_campaign=eid-sale" });
    expect(touches[0]).toEqual({ channel: null, campaign: "eid-sale" });
  });

  it("keeps the lead when the contact cannot be refreshed: it catches up on their next one", async () => {
    failContact = true;
    const out = await service().capture(base);
    expect(out.submissionId).toBe("sub-1");
    expect(events).toEqual(["insert", "enqueue", "kick", "contact:a@b.co"]);
  });

  it("stores, queues, wakes the worker and then refreshes the contact, in that order", async () => {
    const out = await service().capture(base);
    expect(out).toEqual({ submissionId: "sub-1", prize: null, queuedFor: 2 });
    expect(events).toEqual(["insert", "enqueue", "kick", "contact:a@b.co"]);
    expect(inserted[0]).toMatchObject({ id: "sub-1", s: { automationId: KNOWN, variant: "b", email: "a@b.co" }, prize: null });
    expect(enqueued[0]!.lead).toMatchObject({ submissionId: "sub-1", prize: null, submission: { email: "a@b.co" } });
    expect(typeof enqueued[0]!.lead.submittedAt).toBe("string");
  });

  it("still stores a lead when no destination is connected", async () => {
    queued = 0;
    const out = await service().capture(base);
    expect(out.queuedFor).toBe(0);
    expect(inserted).toHaveLength(1);
  });

  it("routes to the destinations the form names, read from its definition", async () => {
    routing = { destinations: ["d1", "d2"] };
    await service().capture(base);
    expect(enqueued[0]!.destinations).toEqual(["d1", "d2"]);
  });

  it("sends to every destination when the form names none, or the popup is unknown", async () => {
    await service().capture(base);
    await service().capture({ ...base, automationId: "22222222-2222-4222-8222-222222222222" });
    await service().capture({ ...base, automationId: null });
    expect(enqueued.map((e) => e.destinations)).toEqual([null, null, null]);
  });

  it("drops attribution, not the lead, for an automation that is not on this website", async () => {
    await service().capture({ ...base, automationId: "22222222-2222-4222-8222-222222222222" });
    expect(inserted[0]!.s).toMatchObject({ automationId: null, variant: null });
  });

  it("discards prize-looking answers sent by the browser", async () => {
    await service().capture({ ...base, fields: { prize_label: "FREE CAR", company: "Acme" } });
    expect(inserted[0]!.s.fields).toEqual({ company: "Acme" });
  });

  it("claims a wheel prize for the address hash, before storing", async () => {
    rewards = { wheel: [{ label: "20% off", weight: 1, coupon_code: "SPIN20" }], coupon: null };
    const out = await service().capture({ ...base, email: "jane@example.com" });
    expect(out.prize).toEqual({ id: "0", label: "20% off", coupon_code: "SPIN20" });
    expect(claims[0]!.hash).toBe(hashEmail("jane@example.com"));
    expect(events.slice(0, 3)).toEqual(["claim", "insert", "enqueue"]);
    expect(inserted[0]!.prize).toEqual(out.prize);
    expect(enqueued[0]!.lead.prize).toEqual(out.prize);
  });

  it("pays a fixed coupon behind the email", async () => {
    rewards = { wheel: null, coupon: { code: "WELCOME10", description: "10% off" } };
    expect((await service().capture(base)).prize).toEqual({ id: "coupon", label: "10% off", coupon_code: "WELCOME10" });
  });

  it("hands back the prize an address already won instead of drawing again", async () => {
    rewards = { wheel: [{ label: "20% off", weight: 1, coupon_code: "SPIN20" }], coupon: null };
    existingClaim = { id: "3", label: "Free shipping", coupon_code: "SHIP" };
    expect((await service().capture(base)).prize).toEqual(existingClaim);
  });

  it("withdraws the stored row and fails when it cannot be queued", async () => {
    failEnqueue = true;
    await expect(service().capture(base)).rejects.toThrow("db down");
    expect(events).toEqual(["insert", "enqueue", "remove:sub-1"]);
    expect(kicks).toBe(0);
  });

  it("still reports the queueing failure when the rollback also fails", async () => {
    failEnqueue = true; failRemove = true;
    await expect(service().capture(base)).rejects.toThrow("db down");
  });
});
