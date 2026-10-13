import { describe, expect, it } from "bun:test";
import { TransportError, outcomeFromStatus } from "../lib/http";
import { withRetry } from "../lib/retry";
import type { Outcome } from "../interfaces";

const noWait = async () => {};
const policy = { maxAttempts: 3, baseDelayMs: 100 };

describe("outcomeFromStatus", () => {
  it("classifies statuses", () => {
    expect(outcomeFromStatus(200, "").kind).toBe("ok");
    expect(outcomeFromStatus(204, "")).toEqual({ kind: "ok", httpStatus: 204 });
    expect(outcomeFromStatus(401, "")).toMatchObject({ kind: "failed", auth: true, retryable: false });
    expect(outcomeFromStatus(403, "")).toMatchObject({ auth: true });
    expect(outcomeFromStatus(429, "")).toMatchObject({ retryable: true });
    expect(outcomeFromStatus(503, "")).toMatchObject({ retryable: true });
    expect(outcomeFromStatus(400, '{"detail":"bad merge field"}')).toMatchObject({ retryable: false, message: "HTTP 400: bad merge field" });
    expect(outcomeFromStatus(302, "")).toMatchObject({ retryable: false, message: expect.stringContaining("redirect") });
  });
  it("honours an explicit success list", () => {
    expect(outcomeFromStatus(202, "", [202]).kind).toBe("ok");
    expect(outcomeFromStatus(200, "", [202]).kind).toBe("failed");
  });
});

describe("withRetry", () => {
  it("retries a retryable failure with growing back-off, then succeeds", async () => {
    const results: Outcome[] = [
      { kind: "failed", retryable: true, message: "HTTP 503" },
      { kind: "failed", retryable: true, message: "HTTP 503" },
      { kind: "ok" },
    ];
    const waits: number[] = [];
    const r = await withRetry(async () => results.shift()!, policy, async (ms) => { waits.push(ms); });
    expect(r).toEqual({ outcome: { kind: "ok" }, attempts: 3 });
    expect(waits).toEqual([100, 200]);
  });

  it("gives up at the budget", async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; return { kind: "failed", retryable: true, message: "HTTP 500" }; }, policy, noWait);
    expect(calls).toBe(3);
    expect(r.outcome.kind).toBe("failed");
  });

  it("does not retry a 4xx or a refused credential", async () => {
    let calls = 0;
    await withRetry(async () => { calls++; return outcomeFromStatus(400, ""); }, policy, noWait);
    await withRetry(async () => { calls++; return outcomeFromStatus(401, ""); }, policy, noWait);
    expect(calls).toBe(2);
  });

  it("treats a transport error as retryable and rethrows anything else", async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; if (calls < 2) throw new TransportError("request timed out"); return { kind: "ok" }; }, policy, noWait);
    expect(r.attempts).toBe(2);
    await expect(withRetry(async () => { throw new Error("bug"); }, policy, noWait)).rejects.toThrow("bug");
  });
});
