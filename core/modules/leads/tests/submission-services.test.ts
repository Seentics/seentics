import { beforeEach, describe, expect, it, mock } from "bun:test";

const calls: string[] = [];
let rows: any[] = [];
let deleted = true;
const unused = async () => { throw new Error("not used by this test"); };
mock.module("../repositories/submission.repository", () => ({
  SUBMISSION_RETENTION_DAYS: 90,
  listSubmissions: async (_w: string, _a: string, q: any) => { calls.push(`list:${q.limit}`); return { rows, total: rows.length }; },
  formSummary: async () => ({ total: 3, last_7_days: 2, last_30_days: 3, with_prize: 1, by_variant: [] }),
  websiteSummary: async (_w: string, month: Date) => { calls.push(`site:${month.toISOString()}`); return { total: 3, last_7_days: 2, this_month: 3 }; },
  exportSubmissions: async () => rows,
  deleteSubmission: async () => { calls.push("delete"); return deleted; },
  countSince: async (ids: readonly string[], since: Date) => { calls.push(`count:${ids.length}:${since.toISOString()}`); return 7; },
  purgeBefore: async (w: string, cutoff: Date) => { calls.push(`purge:${w}:${cutoff.toISOString()}`); return 4; },
  insertSubmission: unused, removeSubmissionById: unused,
  listSiteSubmissions: unused, exportSiteSubmissions: unused, submissionsForEmail: unused, formCounts: unused, deleteSiteSubmission: unused,
  submissionOrigins: unused, submissionCountSince: unused,
}));

const { SubmissionQueryService, startOfMonthUtc } = await import("../services/submission-query.service");
const { SubmissionMutationService } = await import("../services/submission-mutation.service");
const { LeadUsageCounter } = await import("../services/usage-count.service");
const { LeadsRetentionPurge } = await import("../services/retention-purge.service");

beforeEach(() => { calls.length = 0; rows = []; deleted = true; });

describe("SubmissionQueryService", () => {
  it("attaches each submission's delivery state, empty when it has none", async () => {
    rows = [{ id: "a" }, { id: "b" }];
    const delivery = { id: "d1", connection_id: "c1", connection_name: "Zap", provider: "zapier", status: "success" as const, attempt_count: 1, error: null, completed_at: "x" };
    const svc = new SubmissionQueryService({ statuses: async () => new Map([["a", [delivery]]]) });
    const out = await svc.listSubmissions("w", "f", { search: "", limit: 25, offset: 0 });
    expect(out.total).toBe(2);
    expect(out.submissions[0]!.deliveries).toEqual([delivery]);
    expect(out.submissions[1]!.deliveries).toEqual([]);
  });

  it("asks the sink for the page's submissions only", async () => {
    let asked: readonly string[] = [];
    rows = [{ id: "a" }, { id: "b" }];
    await new SubmissionQueryService({ statuses: async (_w, ids) => { asked = ids; return new Map(); } }).listSubmissions("w", "f", { search: "", limit: 2, offset: 0 });
    expect(asked).toEqual(["a", "b"]);
  });

  it("counts the website's month from the first of the month, UTC", async () => {
    await new SubmissionQueryService({ statuses: async () => new Map() }).websiteSummary("w");
    expect(calls[0]).toMatch(/^site:\d{4}-\d{2}-01T00:00:00\.000Z$/);
    expect(startOfMonthUtc(new Date("2026-10-13T23:59:59Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(startOfMonthUtc(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("SubmissionMutationService", () => {
  it("cancels the submission's pending deliveries when it deletes it", async () => {
    const forgotten: string[][] = [];
    const svc = new SubmissionMutationService({ forget: async (_w, ids) => { forgotten.push([...ids]); } });
    expect(await svc.deleteSubmission("w", "f", "s1")).toBe(true);
    expect(forgotten).toEqual([["s1"]]);
  });

  it("leaves deliveries alone when there was nothing to delete", async () => {
    deleted = false;
    const forgotten: string[][] = [];
    expect(await new SubmissionMutationService({ forget: async (_w, ids) => { forgotten.push([...ids]); } }).deleteSubmission("w", "f", "s1")).toBe(false);
    expect(forgotten).toEqual([]);
  });
});

describe("LeadUsageCounter", () => {
  it("counts submissions since the start of the user's month, under the gateway's key", async () => {
    const monthStart = new Date("2026-10-01T00:00:00Z");
    const counter = new LeadUsageCounter();
    expect(counter.key).toBe("leads");
    expect(await counter.countForUser({ userId: "u", websiteUuids: ["w1", "w2"], websiteIds: [], monthStart })).toBe(7);
    expect(calls).toEqual(["count:2:2026-10-01T00:00:00.000Z"]);
  });
});

describe("LeadsRetentionPurge", () => {
  it("deletes submissions older than 90 days for the website", async () => {
    const now = Date.parse("2026-10-13T00:00:00Z");
    const out = await new LeadsRetentionPurge(() => now).purge({ websiteId: "w1" }, {} as never, {} as never);
    expect(out).toEqual({ leadSubmissionRows: 4 });
    expect(calls).toEqual(["purge:w1:2026-07-15T00:00:00.000Z"]);
  });
});
