import { describe, expect, it } from "bun:test";
import {
  analyticsRealtimeGeoQuerySchema,
  analyticsRecentActivityQuerySchema,
} from "../validators/analytics.schema";

/**
 * The only two analytics endpoints that validate rather than clamp.
 *
 * Everywhere else a bad query parameter falls back to a default; these two answer 400.
 * That makes their exact boundaries part of the public contract — a client that sends
 * `limit=100` must succeed and `limit=101` must fail, and neither may silently become
 * something else. The parsed output is asserted as a whole object so an added or
 * renamed field cannot slip through.
 */

describe("analyticsRecentActivityQuerySchema", () => {
  describe("limit", () => {
    it("defaults to 50 when omitted", () => {
      const out = analyticsRecentActivityQuerySchema.parse({});
      expect(out).toEqual({ limit: 50, within_minutes: undefined });
    });

    it("coerces the string a URL always delivers into a number", () => {
      const out = analyticsRecentActivityQuerySchema.parse({ limit: "25" });
      expect(out.limit).toBe(25);
      expect(typeof out.limit).toBe("number");
    });

    it("accepts both inclusive bounds", () => {
      expect(analyticsRecentActivityQuerySchema.parse({ limit: "1" }).limit).toBe(1);
      expect(analyticsRecentActivityQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    });

    it("rejects just outside both bounds", () => {
      expect(analyticsRecentActivityQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
      expect(analyticsRecentActivityQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    });

    it("rejects negatives and absurd values rather than clamping", () => {
      for (const limit of ["-1", "-100", "999999", "1e9"]) {
        expect(analyticsRecentActivityQuerySchema.safeParse({ limit }).success).toBe(false);
      }
    });

    it("rejects fractional limits — LIMIT takes an integer", () => {
      expect(analyticsRecentActivityQuerySchema.safeParse({ limit: "10.5" }).success).toBe(false);
    });

    it("rejects non-numeric text", () => {
      for (const limit of ["abc", "10abc", "NaN", "null", "[]"]) {
        expect(analyticsRecentActivityQuerySchema.safeParse({ limit }).success).toBe(false);
      }
    });

    it("falls back to the default for an empty string", () => {
      // `?limit=` reaches the schema as "", which the preprocessor leaves alone so the
      // optional/default branch applies — an empty parameter means "unspecified".
      expect(analyticsRecentActivityQuerySchema.parse({ limit: "" }).limit).toBe(50);
    });

    it("names the offending field in the issue path", () => {
      const out = analyticsRecentActivityQuerySchema.safeParse({ limit: "101" });
      expect(out.success).toBe(false);
      if (!out.success) expect(out.error.issues[0]?.path).toEqual(["limit"]);
    });
  });

  describe("within_minutes", () => {
    it("stays undefined when omitted, so the repository applies its own default", () => {
      expect(analyticsRecentActivityQuerySchema.parse({}).within_minutes).toBeUndefined();
    });

    it("accepts both inclusive bounds — one minute to one full day", () => {
      expect(analyticsRecentActivityQuerySchema.parse({ within_minutes: "1" }).within_minutes).toBe(1);
      expect(analyticsRecentActivityQuerySchema.parse({ within_minutes: "1440" }).within_minutes).toBe(1440);
    });

    it("rejects just outside both bounds", () => {
      expect(analyticsRecentActivityQuerySchema.safeParse({ within_minutes: "0" }).success).toBe(false);
      expect(analyticsRecentActivityQuerySchema.safeParse({ within_minutes: "1441" }).success).toBe(false);
    });

    it("rejects a negative window, which would invert the range", () => {
      expect(analyticsRecentActivityQuerySchema.safeParse({ within_minutes: "-30" }).success).toBe(false);
    });
  });

  it("validates both fields independently", () => {
    const out = analyticsRecentActivityQuerySchema.parse({ limit: "10", within_minutes: "30" });
    expect(out).toEqual({ limit: 10, within_minutes: 30 });
  });

  it("reports every failing field at once rather than stopping at the first", () => {
    const out = analyticsRecentActivityQuerySchema.safeParse({
      limit: "999",
      within_minutes: "99999",
    });
    expect(out.success).toBe(false);
    if (!out.success) {
      const paths = out.error.issues.map((i) => i.path[0]).sort();
      expect(paths).toEqual(["limit", "within_minutes"]);
    }
  });

  it("ignores unknown query parameters instead of rejecting the request", () => {
    // Object schemas strip by default. The dashboard appends `timezone` to almost every
    // request, so rejecting extras here would 400 the two validated endpoints alone.
    const out = analyticsRecentActivityQuerySchema.parse({
      limit: "10",
      timezone: "Asia/Dhaka",
      utm_source: "x",
    });
    expect(out).toEqual({ limit: 10, within_minutes: undefined });
  });
});

describe("analyticsRealtimeGeoQuerySchema", () => {
  it("has no required fields and no default window", () => {
    expect(analyticsRealtimeGeoQuerySchema.parse({})).toEqual({ within_minutes: undefined });
  });

  it("coerces and accepts both inclusive bounds", () => {
    expect(analyticsRealtimeGeoQuerySchema.parse({ within_minutes: "1" }).within_minutes).toBe(1);
    expect(analyticsRealtimeGeoQuerySchema.parse({ within_minutes: "1440" }).within_minutes).toBe(1440);
  });

  it("rejects out-of-range, fractional, and non-numeric windows", () => {
    for (const v of ["0", "1441", "-1", "30.5", "abc", "Infinity"]) {
      expect(analyticsRealtimeGeoQuerySchema.safeParse({ within_minutes: v }).success).toBe(false);
    }
  });

  it("does not accept `limit` — this endpoint returns a full country breakdown", () => {
    const out = analyticsRealtimeGeoQuerySchema.parse({ limit: "10" });
    expect(out).not.toHaveProperty("limit");
  });
});
