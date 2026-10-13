import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { LeadSubmission } from "../interfaces";

mock.module("../../../platform/observability/logger", () => {
  const logger: Record<string, unknown> = { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) };
  logger.child = () => logger;
  return { log: logger };
});

const inserted: LeadSubmission[] = [];
let chooser: ((existing: unknown) => unknown) | undefined;
let existingPrize: unknown = null;
// Complete on purpose: a mock.module stub must export everything the real module does.
const unused = async () => { throw new Error("not used by this test"); };
mock.module("../repositories/lead.repository", () => ({
  insertSubmission: async (s: LeadSubmission, choosePrize?: (existing: unknown) => unknown) => {
    inserted.push(s);
    chooser = choosePrize;
    return { contactId: "c1", isNewContact: true, prize: choosePrize ? choosePrize(existingPrize) : null };
  },
  listContacts: unused,
  getContact: unused,
  leadStats: unused,
  exportContacts: unused,
  updateContactStatus: unused,
  deleteContact: unused,
}));

const { LeadCaptureService } = await import("../services/lead-capture.service");

const SITE = "550e8400-e29b-41d4-a716-446655440000";
const KNOWN = "11111111-1111-4111-8111-111111111111";

const base: LeadSubmission = {
  websiteId: SITE, email: "a@b.co", name: "", phone: "", consent: false, fields: {},
  anonymousId: null, sessionId: null, automationId: KNOWN, variant: "b", pageUrl: "", referrer: "",
};

let rewards: any = null;
const directory = {
  names: async (_w: string, ids: readonly string[]) => new Map(ids.filter((i) => i === KNOWN).map((i) => [i, "Exit popup"])),
  rewards: async () => rewards,
};

beforeEach(() => { inserted.length = 0; chooser = undefined; existingPrize = null; rewards = null; });

describe("LeadCaptureService", () => {
  it("keeps attribution for an automation on the website", async () => {
    await new LeadCaptureService(directory).capture(base);
    expect(inserted[0]).toMatchObject({ automationId: KNOWN, variant: "b" });
  });

  it("drops attribution, not the lead, for an unknown automation", async () => {
    await new LeadCaptureService(directory).capture({ ...base, automationId: "22222222-2222-4222-8222-222222222222" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ automationId: null, variant: null });
  });

  it("notifies listeners after storing, and isolates a failing one", async () => {
    const svc = new LeadCaptureService(directory);
    const heard: string[] = [];
    svc.onCaptured(() => { throw new Error("connector down"); });
    svc.onCaptured((l) => { heard.push(l.contactId); });
    const result = await svc.capture(base);
    await new Promise((r) => setTimeout(r, 0));
    expect(result.contactId).toBe("c1");
    expect(heard).toEqual(["c1"]);
  });

  it("strips prize fields the browser tries to send", async () => {
    await new LeadCaptureService(directory).capture({ ...base, fields: { company: "Acme", prize_label: "99% off", prize_code: "FREE", Prize_id: "0" } });
    expect(inserted[0]!.fields).toEqual({ company: "Acme" });
  });

  describe("prizes", () => {
    const wheel = [
      { label: "10% off", weight: 1, coupon_code: "SAVE10" },
      { label: "Try again", weight: 0, coupon_code: "" },
    ];

    it("pays no prize when the popup has none", async () => {
      const result = await new LeadCaptureService(directory).capture(base);
      expect(result.prize).toBeNull();
      expect(chooser).toBeUndefined();
    });

    it("draws from the stored wheel, never from the request", async () => {
      rewards = { wheel, coupon: null };
      const result = await new LeadCaptureService(directory).capture(base);
      expect(result.prize).toEqual({ id: "0", label: "10% off", coupon_code: "SAVE10" });
    });

    it("gives a returning email the prize it already won", async () => {
      rewards = { wheel, coupon: null };
      existingPrize = { id: "1", label: "Try again", coupon_code: null };
      const result = await new LeadCaptureService(directory).capture(base);
      expect(result.prize).toEqual(existingPrize as any);
    });

    it("hands out a fixed coupon behind the email", async () => {
      rewards = { wheel: null, coupon: { code: "WELCOME", description: "Welcome gift" } };
      const result = await new LeadCaptureService(directory).capture(base);
      expect(result.prize).toEqual({ id: "coupon", label: "Welcome gift", coupon_code: "WELCOME" });
    });

    it("asks for rewards only when the attribution held up", async () => {
      rewards = { wheel, coupon: null };
      const result = await new LeadCaptureService(directory).capture({ ...base, automationId: "22222222-2222-4222-8222-222222222222" });
      expect(result.prize).toBeNull();
    });
  });

  it("stops notifying an unsubscribed listener", async () => {
    const svc = new LeadCaptureService(directory);
    const heard: string[] = [];
    const off = svc.onCaptured((l) => { heard.push(l.contactId); });
    off();
    await svc.capture(base);
    await new Promise((r) => setTimeout(r, 0));
    expect(heard).toEqual([]);
  });
});
