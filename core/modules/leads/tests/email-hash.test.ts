import { describe, expect, it } from "bun:test";
import { hashEmail } from "../lib/email-hash";

describe("hashEmail", () => {
  it("is a stable 64-character hex digest that ignores case and surrounding space", () => {
    const h = hashEmail("Jane@Example.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEmail("  jane@example.com ")).toBe(h);
    expect(hashEmail("other@example.com")).not.toBe(h);
  });

  it("does not contain the address", () => {
    expect(hashEmail("jane@example.com")).not.toContain("jane");
  });
});
