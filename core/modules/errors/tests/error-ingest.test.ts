import { describe, it, expect, beforeEach, mock } from "bun:test";

/**
 * The repository is stubbed: these cover the mapping from a tracker event to a stored
 * row, which is where the decisions live. The SQL itself is exercised against a real
 * database by the integration suite.
 */
const upserted: unknown[][] = [];
const inserted: unknown[][] = [];
/** Call order across both writers, so the group-before-sample rule is actually observed. */
const callOrder: string[] = [];

mock.module("../repositories/error-writes.repository", () => ({
  upsertErrorGroups: async (rows: unknown[]) => {
    callOrder.push("groups");
    upserted.push(rows);
  },
  insertErrorEvents: async (rows: unknown[]) => {
    callOrder.push("events");
    inserted.push(rows);
  },
}));

const { ErrorIngestService } = await import("../services/error-ingest.service");

type Row = {
  fingerprint: string;
  kind: string;
  message: string;
  pagePath: string;
  sessionId: string | null;
  visitorId: string | null;
  browser: string;
  deviceType: string;
  lineNo: number | null;
  occurredAt: Date;
};

const WEBSITE = "11111111-1111-4111-8111-111111111111";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function event(over: Record<string, unknown> = {}) {
  return {
    type: "error" as const,
    kind: "error" as const,
    ts: Date.now(),
    url: "https://shop.test/checkout?step=2",
    sid: "s-abc",
    vid: "v-abc",
    message: "Cannot read properties of undefined (reading 'basket')",
    source: "https://shop.test/static/app.js",
    line_no: 42,
    col_no: 7,
    stack: "TypeError: …\n  at checkout (app.js:42:7)",
    websiteId: WEBSITE,
    clientUa: CHROME,
    ...over,
  };
}

const service = () => new ErrorIngestService();
const lastGroups = () => (upserted.at(-1) ?? []) as Row[];
const lastEvents = () => (inserted.at(-1) ?? []) as Row[];

describe("ErrorIngestService", () => {
  beforeEach(() => {
    upserted.length = 0;
    inserted.length = 0;
    callOrder.length = 0;
  });

  it("stores a group and a sample for one error", async () => {
    await service().processEvents("b1", [event()] as never);
    expect(lastGroups()).toHaveLength(1);
    expect(lastEvents()).toHaveLength(1);
  });

  it("writes the group before the sample", async () => {
    // A sample without its group is invisible; a group without its samples still shows an
    // accurate count. If only one can land it must be the group.
    await service().processEvents("b1", [event()] as never);
    expect(callOrder).toEqual(["groups", "events"]);
  });

  it("reduces the url to a path so a fault groups by route", async () => {
    await service().processEvents("b1", [event()] as never);
    expect(lastEvents()[0]?.pagePath).toBe("/checkout");
  });

  it("keeps the session id, which is the join to the replay", async () => {
    await service().processEvents("b1", [event()] as never);
    expect(lastEvents()[0]?.sessionId).toBe("s-abc");
  });

  it("derives browser and device from the user agent", async () => {
    await service().processEvents("b1", [event()] as never);
    expect(lastEvents()[0]?.browser).toContain("Chrome");
    expect(lastEvents()[0]?.deviceType).toBe("Desktop");
  });

  it("gives two occurrences of one fault the same fingerprint", async () => {
    await service().processEvents("b1", [
      event({ message: "Order 1 failed" }),
      event({ message: "Order 2 failed" }),
    ] as never);
    const [a, b] = lastGroups();
    expect(a?.fingerprint).toBe(b?.fingerprint!);
  });

  it("separates a rejection from a thrown error carrying the same text", async () => {
    await service().processEvents("b1", [
      event({ kind: "error" }),
      event({ kind: "unhandledrejection" }),
    ] as never);
    const [a, b] = lastGroups();
    expect(a?.fingerprint).not.toBe(b?.fingerprint!);
  });

  it("drops a whitespace-only message rather than grouping every one together", async () => {
    await service().processEvents("b1", [event({ message: "   " })] as never);
    expect(upserted).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("drops an event with no website", async () => {
    await service().processEvents("b1", [event({ websiteId: "" })] as never);
    expect(upserted).toHaveLength(0);
  });

  it("writes nothing at all for an empty batch", async () => {
    await service().processEvents("b1", []);
    expect(upserted).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("replaces a future timestamp with arrival time", async () => {
    // A tracker clock can be set forward, and a row dated next year would sit at the top
    // of every list permanently.
    const future = Date.now() + 90 * 24 * 60 * 60 * 1000;
    await service().processEvents("b1", [event({ ts: future })] as never);
    expect(lastEvents()[0]!.occurredAt.getTime()).toBeLessThan(Date.now() + 60_000);
  });

  it("replaces an implausibly old timestamp with arrival time", async () => {
    const ancient = Date.now() - 400 * 24 * 60 * 60 * 1000;
    await service().processEvents("b1", [event({ ts: ancient })] as never);
    expect(lastEvents()[0]!.occurredAt.getTime()).toBeGreaterThan(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    );
  });

  it("keeps a plausible timestamp", async () => {
    const ts = Date.now() - 5_000;
    await service().processEvents("b1", [event({ ts })] as never);
    expect(lastEvents()[0]!.occurredAt.getTime()).toBe(ts);
  });

  it("tolerates a missing stack, which cross-origin scripts withhold", async () => {
    await service().processEvents("b1", [
      event({ stack: undefined, message: "Script error.", source: "" }),
    ] as never);
    expect(lastEvents()).toHaveLength(1);
  });

  it("keeps a null line number rather than coercing it to zero", async () => {
    await service().processEvents("b1", [event({ line_no: undefined })] as never);
    expect(lastEvents()[0]?.lineNo).toBeNull();
  });
});
