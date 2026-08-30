import { describe, expect, it } from "bun:test";
import {
  NOT_SET,
  occurredAtToIso,
  orNotSet,
  parseDays,
  parseLimit,
  sanitizeTimezone,
  windowStartIso,
} from "../repositories/shared";

/**
 * The query-parameter coercion every windowed endpoint depends on.
 *
 * These helpers sit between a URL a user can type and an interpolated SQL window, so the
 * cases that matter are the hostile ones: values that are unparseable, out of range, or
 * shaped to escape the `AT TIME ZONE` clause. A permissive fallback is the contract —
 * a bad `days` renders the default range rather than a 400 — which makes it worth
 * pinning down exactly where "bad" begins.
 */

describe("parseDays", () => {
  it("returns the requested window for an ordinary value", () => {
    expect(parseDays("7")).toBe(7);
    expect(parseDays("30")).toBe(30);
  });

  it("defaults when the parameter is absent", () => {
    expect(parseDays(undefined)).toBe(7);
    expect(parseDays(undefined, 30)).toBe(30);
  });

  it("accepts the inclusive lower bound of 1 day", () => {
    expect(parseDays("1")).toBe(1);
  });

  it("accepts 365 but rejects 366 — the window is bounded at one year", () => {
    expect(parseDays("365")).toBe(365);
    expect(parseDays("366", 7)).toBe(7);
    expect(parseDays("100000", 30)).toBe(30);
  });

  it("rejects zero and negatives rather than producing an inverted window", () => {
    // A negative `days` would put the window start *after* now, silently returning
    // an empty result set that reads as "no traffic" instead of "bad request".
    expect(parseDays("0", 7)).toBe(7);
    expect(parseDays("-1", 7)).toBe(7);
    expect(parseDays("-9999", 30)).toBe(30);
  });

  it("truncates fractional days toward zero", () => {
    expect(parseDays("7.9")).toBe(7);
    expect(parseDays("1.999")).toBe(1);
  });

  it("falls back for values that are not numbers at all", () => {
    expect(parseDays("abc", 7)).toBe(7);
    expect(parseDays("", 30)).toBe(30);
    expect(parseDays("7d", 7)).toBe(7);
    expect(parseDays("NaN", 7)).toBe(7);
  });

  it("falls back for infinities", () => {
    expect(parseDays("Infinity", 7)).toBe(7);
    expect(parseDays("-Infinity", 7)).toBe(7);
  });

  it("does not treat whitespace as zero", () => {
    // Number(" ") is 0, which the > 0 guard rejects — the default must win.
    expect(parseDays(" ", 7)).toBe(7);
  });

  it("accepts numeric strings with surrounding whitespace", () => {
    expect(parseDays(" 14 ")).toBe(14);
  });
});

describe("parseLimit", () => {
  it("returns the requested limit inside the range", () => {
    expect(parseLimit("10")).toBe(10);
    expect(parseLimit("499")).toBe(499);
  });

  it("defaults when absent or unparseable", () => {
    expect(parseLimit(undefined)).toBe(50);
    expect(parseLimit(undefined, 25)).toBe(25);
    expect(parseLimit("abc", 25)).toBe(25);
  });

  it("clamps above the maximum instead of falling back to the default", () => {
    // Distinct from parseDays: an oversized limit is clamped down, not discarded, so a
    // caller asking for everything gets the largest page rather than the default page.
    expect(parseLimit("100000")).toBe(500);
    expect(parseLimit("501")).toBe(500);
    expect(parseLimit("1000", 50, 100)).toBe(100);
  });

  it("accepts the maximum exactly", () => {
    expect(parseLimit("500")).toBe(500);
  });

  it("falls back for zero and negatives", () => {
    expect(parseLimit("0", 50)).toBe(50);
    expect(parseLimit("-5", 50)).toBe(50);
  });

  it("truncates fractional limits", () => {
    expect(parseLimit("10.9")).toBe(10);
  });

  it("clamps rather than overflowing on Infinity", () => {
    // Number("Infinity") is finite:false, so this must take the default branch.
    expect(parseLimit("Infinity", 50)).toBe(50);
  });
});

describe("sanitizeTimezone", () => {
  it("passes through real IANA zones", () => {
    expect(sanitizeTimezone("UTC")).toBe("UTC");
    expect(sanitizeTimezone("America/New_York")).toBe("America/New_York");
    expect(sanitizeTimezone("Asia/Dhaka")).toBe("Asia/Dhaka");
    expect(sanitizeTimezone("Europe/London")).toBe("Europe/London");
  });

  it("accepts the offset-style zones the whitelist allows", () => {
    expect(sanitizeTimezone("Etc/GMT+5")).toBe("Etc/GMT+5");
    expect(sanitizeTimezone("Etc/GMT-14")).toBe("Etc/GMT-14");
  });

  it("defaults to UTC when absent or empty", () => {
    expect(sanitizeTimezone(undefined)).toBe("UTC");
    expect(sanitizeTimezone("")).toBe("UTC");
  });

  it("rejects a syntactically valid but non-existent zone", () => {
    // Passes the character whitelist, so only the Intl round-trip catches it. Without
    // that second check Postgres answers 22023 rather than rendering a default range.
    expect(sanitizeTimezone("Mars/Olympus_Mons")).toBe("UTC");
    expect(sanitizeTimezone("Not/AZone")).toBe("UTC");
  });

  it("rejects every SQL-escape shape — the value is interpolated into AT TIME ZONE", () => {
    // This is the injection boundary. Each of these would terminate the quoted literal
    // or start a new statement if it reached the query builder.
    const hostile = [
      "UTC'; DROP TABLE analytics_events; --",
      "UTC' OR '1'='1",
      "'",
      '"',
      "UTC;SELECT 1",
      "UTC--",
      "UTC/*comment*/",
      "UTC OR 1=1",
      "UTC\nSELECT 1",
      "UTC\\'",
      "$$UTC$$",
      "UTC%20",
      "America/New York",
    ];
    for (const tz of hostile) {
      expect(sanitizeTimezone(tz)).toBe("UTC");
    }
  });

  it("rejects non-string inputs defensively", () => {
    expect(sanitizeTimezone(123 as unknown as string)).toBe("UTC");
    expect(sanitizeTimezone(null as unknown as string)).toBe("UTC");
    expect(sanitizeTimezone({} as unknown as string)).toBe("UTC");
  });
});

describe("windowStartIso", () => {
  it("returns an ISO-8601 UTC timestamp", () => {
    expect(windowStartIso(7)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("is exactly `days` before now, to within the test's own execution time", () => {
    const before = Date.now();
    const iso = windowStartIso(7);
    const after = Date.now();
    const t = new Date(iso).getTime();
    const sevenDays = 7 * 86_400_000;
    expect(t).toBeGreaterThanOrEqual(before - sevenDays);
    expect(t).toBeLessThanOrEqual(after - sevenDays);
  });

  it("produces a strictly earlier bound for a longer window", () => {
    expect(new Date(windowStartIso(30)).getTime()).toBeLessThan(
      new Date(windowStartIso(7)).getTime(),
    );
  });

  it("treats 0 days as 'now' rather than erroring", () => {
    const t = new Date(windowStartIso(0)).getTime();
    expect(Math.abs(t - Date.now())).toBeLessThan(1000);
  });
});

describe("occurredAtToIso", () => {
  it("normalises a Date", () => {
    expect(occurredAtToIso(new Date("2026-03-01T10:20:30.000Z"))).toBe(
      "2026-03-01T10:20:30.000Z",
    );
  });

  it("normalises an already-ISO string", () => {
    expect(occurredAtToIso("2026-03-01T10:20:30.000Z")).toBe("2026-03-01T10:20:30.000Z");
  });

  it("normalises the space-separated form some drivers return", () => {
    // `postgres` can hand back 'YYYY-MM-DD HH:MM:SS+00'. Parsing must not silently
    // produce Invalid Date, which would serialise as null and blank the activity feed.
    const out = occurredAtToIso("2026-03-01 10:20:30+00");
    expect(out).toBe("2026-03-01T10:20:30.000Z");
  });

  it("preserves the instant when the driver returns a non-UTC offset", () => {
    expect(occurredAtToIso("2026-03-01T15:20:30+05:00")).toBe("2026-03-01T10:20:30.000Z");
  });

  it("survives sub-second precision", () => {
    expect(occurredAtToIso("2026-03-01T10:20:30.123Z")).toBe("2026-03-01T10:20:30.123Z");
  });
});

describe("orNotSet", () => {
  it("keeps a real value untouched", () => {
    expect(orNotSet("/pricing")).toBe("/pricing");
    expect(orNotSet("0")).toBe("0");
  });

  it("collapses null, undefined, empty, and whitespace-only to the placeholder", () => {
    expect(orNotSet(null)).toBe(NOT_SET);
    expect(orNotSet(undefined)).toBe(NOT_SET);
    expect(orNotSet("")).toBe(NOT_SET);
    expect(orNotSet("   ")).toBe(NOT_SET);
    expect(orNotSet("\t\n")).toBe(NOT_SET);
  });

  it("returns the original value, not a trimmed copy", () => {
    // Trimming here would change a page path that legitimately carries a trailing
    // space, so the helper only *tests* the trimmed form.
    expect(orNotSet("  /a  ")).toBe("  /a  ");
  });

  it("exposes the placeholder as a stable wire constant", () => {
    expect(NOT_SET).toBe("(not set)");
  });
});
