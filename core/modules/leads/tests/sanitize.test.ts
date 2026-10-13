import { describe, expect, it } from "bun:test";
import { cleanText, csvCell, normalizeEmail, sanitizeFields } from "../lib/sanitize";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });
  it("returns empty for non-strings", () => {
    expect(normalizeEmail(42)).toBe("");
  });
});

describe("cleanText", () => {
  it("strips control characters and caps length", () => {
    expect(cleanText("a\u0000b\u0007c", 10)).toBe("abc");
    expect(cleanText("x".repeat(20), 5)).toBe("xxxxx");
  });
});

describe("sanitizeFields", () => {
  it("keeps short scalars and drops everything else", () => {
    expect(
      sanitizeFields({ company: " Acme ", seats: 5, vip: true, nested: { a: 1 }, list: [1], nan: NaN, empty: "  " }),
    ).toEqual({ company: "Acme", seats: 5, vip: true });
  });
  it("drops keys that are not identifier-shaped", () => {
    expect(sanitizeFields({ "bad key": "x", "<script>": "x", ok_key: "y" })).toEqual({ ok_key: "y" });
  });
  it("caps the number of fields", () => {
    const input = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`f${i}`, "v"]));
    expect(Object.keys(sanitizeFields(input))).toHaveLength(20);
  });
  it("returns empty for non-objects", () => {
    expect(sanitizeFields(null)).toEqual({});
    expect(sanitizeFields([1, 2])).toEqual({});
    expect(sanitizeFields("x")).toEqual({});
  });
});

describe("csvCell", () => {
  it("quotes cells containing separators and escapes quotes", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@sum")).toBe("'@sum");
  });
  it("renders null and booleans", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("true");
  });
});
