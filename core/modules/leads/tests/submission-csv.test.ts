import { describe, expect, it } from "bun:test";
import { submissionsToCsv } from "../lib/submission-csv";

const row = (over: Partial<Parameters<typeof submissionsToCsv>[0][number]> = {}) => ({
  id: "1", email: "a@b.co", name: "A", phone: "", consent: true, fields: {}, prize: null, variant: null,
  page_url: "/p", referrer: "", created_at: "2026-01-01T00:00:00.000Z", ...over,
});

describe("submissionsToCsv", () => {
  it("writes a header even with no rows", () => {
    expect(submissionsToCsv([])).toBe("submitted_at,email,name,phone,consent,variant,prize,coupon_code,page_url,referrer\r\n");
  });

  it("adds one sorted column per extra field used by any row", () => {
    const csv = submissionsToCsv([row({ fields: { zeta: 1 } }), row({ id: "2", fields: { alpha: "x", zeta: true } })]).split("\r\n");
    expect(csv[0]!.endsWith(",alpha,zeta")).toBe(true);
    expect(csv[1]!.endsWith(",,1")).toBe(true);
    expect(csv[2]!.endsWith(",x,true")).toBe(true);
  });

  it("writes the prize and its code", () => {
    const csv = submissionsToCsv([row({ prize: { id: "1", label: "10% off", coupon_code: "SAVE10" }, variant: "b" })]);
    expect(csv).toContain(",b,10% off,SAVE10,");
  });

  it("neutralises formulas and quotes awkward cells", () => {
    const csv = submissionsToCsv([row({ name: "=HYPERLINK(\"x\")", fields: { note: "a,\"b\"\nc" } })]);
    expect(csv).toContain("'=HYPERLINK(\"\"x\"\")");
    expect(csv).toContain('"a,""b""\nc"');
  });
});
