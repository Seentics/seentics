import { describe, expect, it } from "bun:test";
import { isLinearSafePattern, safeRegexTest, MAX_TEXT_CHARS } from "../lib/safe-regex";

describe("isLinearSafePattern", () => {
  it("accepts the patterns people actually write", () => {
    for (const p of [
      "^/pricing", "^/blog/[a-z0-9-]+$", "^/(en|fr|de)/docs", "/product/\\d+", "utm_source=(google|bing)",
      "^/a/.*/b$", "colou?r", "^(https?://)?example\\.com", "^/x{1,5}$", "^[A-Z]{2}-\\d{4}$",
    ]) expect(isLinearSafePattern(p)).toBe(true);
  });

  it("refuses the classic catastrophic shapes", () => {
    for (const p of ["^(a|aa)+$", "(a+)+$", "(a*)*b", "^(\\w+\\s?)*$", "(x+x+)+y", "(.*a){12}", "(a|a)*b"]) {
      expect(isLinearSafePattern(p)).toBe(false);
    }
  });

  it("refuses back-references and look-around", () => {
    for (const p of ["(a)\\1", "(?<n>a)\\k<n>", "a(?=b)", "a(?!b)", "(?<=a)b", "(?<!a)b"]) {
      expect(isLinearSafePattern(p)).toBe(false);
    }
  });

  it("limits how many unbounded repeats one pattern may stack", () => {
    expect(isLinearSafePattern(".*a.*b.*c")).toBe(true);
    expect(isLinearSafePattern(".*a.*b.*c.*d")).toBe(false);
    expect(isLinearSafePattern("a{1,500}")).toBe(true);
    expect(isLinearSafePattern("a{1,500}b{1,500}c{1,500}d{1,500}")).toBe(false);
  });

  it("refuses an unterminated class and an over-long pattern", () => {
    expect(isLinearSafePattern("[abc")).toBe(false);
    expect(isLinearSafePattern("a".repeat(201))).toBe(false);
  });

  it("does not mistake an escaped or bracketed metacharacter for a repeat", () => {
    expect(isLinearSafePattern("\\(a\\)+")).toBe(true);
    expect(isLinearSafePattern("[()*+]+")).toBe(true);
  });
});

describe("safeRegexTest", () => {
  it("returns at once for a pattern that would not return for hours", () => {
    const started = performance.now();
    expect(safeRegexTest("^(a|aa)+$", "a".repeat(60) + "!")).toBe(false);
    expect(safeRegexTest("(a+)+$", "a".repeat(60) + "!")).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("stays fast on the worst case it does allow", () => {
    const started = performance.now();
    safeRegexTest(".*a.*b.*c", "a".repeat(5_000));
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("matches ordinary patterns and ignores text past the cap", () => {
    expect(safeRegexTest("^/pricing", "/pricing/team")).toBe(true);
    expect(safeRegexTest("^/pricing", "/blog")).toBe(false);
    expect(safeRegexTest("needle", "x".repeat(MAX_TEXT_CHARS) + "needle")).toBe(false);
  });

  it("is false for a pattern that is not valid", () => {
    expect(safeRegexTest("(", "x")).toBe(false);
  });
});
