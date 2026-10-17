import { describe, expect, it } from "bun:test";
import { decodeCursor, encodeCursor, nextCursor } from "../lib/cursor";
import { parsePool } from "../lib/gateway-context";
import { periodWindows } from "../services/overview.service";

const ID = "11111111-1111-4111-8111-111111111111";

describe("cursor", () => {
  it("round-trips the last row's created_at and id, base64url", () => {
    const at = new Date("2026-10-17T08:30:00.123Z");
    const cursor = encodeCursor({ createdAt: at, id: ID });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ createdAt: at, id: ID });
  });

  it("refuses anything it did not issue", () => {
    const b64 = (s: string) => Buffer.from(s).toString("base64url");
    for (const bad of ["", "!!", b64("nope"), b64(`2026-10-17T08:30:00.123Z,${ID},x`), b64("2026-10-17,not-a-uuid"), b64(`yesterday,${ID}`)]) {
      expect(decodeCursor(bad)).toBeNull();
    }
  });

  it("is null on the last page", () => {
    const rows = [{ createdAt: new Date(), id: ID }];
    expect(nextCursor(rows, false)).toBeNull();
    expect(nextCursor(rows, true)).toBe(encodeCursor(rows[0]!));
  });
});

describe("X-Agency-Pool", () => {
  it("parses the four resources and drops anything else", () => {
    expect(parsePool("events=1000000, recordings=5000,leads=1000,ai_analyses=100")).toEqual({
      events: 1000000, recordings: 5000, leads: 1000, ai_analyses: 100,
    });
    expect(parsePool("events=-1,replays=5,leads=abc,ai_analyses")).toEqual({});
    expect(parsePool(undefined)).toEqual({});
  });
});

describe("overview periods", () => {
  it("covers N UTC days ending today, and the N before", () => {
    const now = Date.parse("2026-10-17T23:59:00Z");
    expect(periodWindows("7d", now)).toEqual({
      current: { from: "2026-10-11", to: "2026-10-17" },
      previous: { from: "2026-10-04", to: "2026-10-10" },
    });
    expect(periodWindows("90d", now).current.from).toBe("2026-07-20");
  });
});
