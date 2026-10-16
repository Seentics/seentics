import { describe, expect, it } from "bun:test";
import { normalizeTags, prepareImport, undefuse, MAX_TAGS } from "../lib/contact-import";
import { utmOf } from "../lib/utm";

describe("normalizeTags", () => {
  it("trims, drops empties and duplicates, keeps order, and caps count and length", () => {
    expect(normalizeTags([" vip ", "", "vip", "b2b"])).toEqual(["vip", "b2b"]);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS);
    expect(normalizeTags(["x".repeat(80)])[0]).toHaveLength(40);
    expect(normalizeTags(undefined)).toEqual([]);
  });
});

describe("prepareImport", () => {
  it("lower-cases emails, keeps the last row for a repeated email, and reports bad rows by number", () => {
    const { rows, errors } = prepareImport([
      { email: " Jane@Example.com ", name: "Jane", status: "Customer", tags: ["vip"] },
      { email: "" },
      { email: "not-an-email" },
      { email: "rafi@shop.bd", status: "hot" },
      { email: "jane@example.com", name: "Jane Doe" },
    ]);
    expect(rows).toEqual([
      { email: "jane@example.com", name: "Jane Doe", phone: "", status: null, tags: [], notes: "" },
    ]);
    expect(errors).toEqual([
      { row: 2, reason: "No email" },
      { row: 3, reason: "Not an email address: not-an-email" },
      { row: 4, reason: 'Unknown status "hot" (use new, contacted, qualified, customer, lost)' },
    ]);
  });

  it("accepts every known status, in any case", () => {
    const { rows, errors } = prepareImport(["New", "CONTACTED", "qualified", "Customer", "lost"].map((status, i) => ({ email: `p${i}@x.co`, status })));
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.status)).toEqual(["new", "contacted", "qualified", "customer", "lost"]);
  });
});

describe("utmOf", () => {
  it("reads the campaign tags off a landing URL, and copes with one that does not parse", () => {
    expect(utmOf("https://shop.bd/?utm_source=facebook&utm_medium=cpc&utm_campaign=spring")).toEqual({ source: "facebook", medium: "cpc", campaign: "spring" });
    expect(utmOf("https://shop.bd/pricing")).toEqual({ source: null, medium: null, campaign: null });
    expect(utmOf("/relative")).toEqual({ source: null, medium: null, campaign: null });
  });
});

describe("undefuse", () => {
  it("reads back what the export guarded, and leaves other values alone", () => {
    expect(undefuse("'+8801700000000")).toBe("+8801700000000");
    expect(undefuse("'=SUM(A1)")).toBe("=SUM(A1)");
    expect(undefuse("O'Brien")).toBe("O'Brien");
    expect(undefuse("'quoted'")).toBe("'quoted'");
    expect(prepareImport([{ email: "a@b.co", phone: "'+880170" }]).rows[0]!.phone).toBe("+880170");
  });
});
