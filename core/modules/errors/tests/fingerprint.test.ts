import { describe, it, expect } from "bun:test";
import {
  errorFingerprint,
  normalizeErrorMessage,
  normalizeErrorSource,
} from "../lib/fingerprint";

const fp = (over: Partial<Parameters<typeof errorFingerprint>[0]> = {}) =>
  errorFingerprint({ kind: "error", message: "boom", sourceFile: "/app.js", ...over });

describe("normalizeErrorMessage", () => {
  it("collapses the property name in a read-of-undefined", () => {
    // The single most common frontend error. One broken line produces a different
    // message per property touched, and they are all the same fault.
    const a = normalizeErrorMessage("Cannot read properties of undefined (reading 'basket')");
    const b = normalizeErrorMessage("Cannot read properties of undefined (reading 'total')");
    expect(a).toBe(b);
  });

  it("collapses ids embedded in the text", () => {
    expect(normalizeErrorMessage("Order 88213 not found")).toBe(
      normalizeErrorMessage("Order 90114 not found"),
    );
  });

  it("collapses a uuid without shredding it into pieces", () => {
    const out = normalizeErrorMessage("Cart 550e8400-e29b-41d4-a716-446655440000 expired");
    expect(out).toBe("Cart <uuid> expired");
  });

  it("collapses urls before the numeric rule reaches them", () => {
    const out = normalizeErrorMessage("Failed to fetch https://api.shop.test/v2/cart/8821");
    expect(out).toBe("Failed to fetch <url>");
  });

  it("keeps genuinely different faults apart", () => {
    expect(normalizeErrorMessage("Cannot read properties of undefined (reading 'x')")).not.toBe(
      normalizeErrorMessage("Failed to fetch"),
    );
  });

  it("is empty for an empty message rather than throwing", () => {
    expect(normalizeErrorMessage("")).toBe("");
  });

  it("bounds its output", () => {
    expect(normalizeErrorMessage("z".repeat(5_000)).length).toBeLessThanOrEqual(500);
  });
});

describe("normalizeErrorSource", () => {
  it("survives a redeploy changing the content hash", () => {
    // Without this every build would present the whole backlog as brand new errors.
    expect(normalizeErrorSource("/_next/static/chunks/main-4f2b9c.js")).toBe(
      normalizeErrorSource("/_next/static/chunks/main-91ae02.js"),
    );
  });

  it("treats the same bundle on a CDN and on the origin as one file", () => {
    expect(normalizeErrorSource("https://cdn.shop.test/static/app.js")).toBe(
      normalizeErrorSource("https://shop.test/static/app.js"),
    );
  });

  it("drops a cache-busting query", () => {
    expect(normalizeErrorSource("/static/app.js?v=8821")).toBe("/static/app.js");
  });

  it("keeps different files apart", () => {
    expect(normalizeErrorSource("/static/checkout.js")).not.toBe(
      normalizeErrorSource("/static/cart.js"),
    );
  });

  it("passes through a value that is not a url", () => {
    expect(normalizeErrorSource("promise")).toBe("promise");
  });
});

describe("errorFingerprint", () => {
  it("is stable for the same fault", () => {
    expect(fp()).toBe(fp());
  });

  it("separates a thrown error from an unhandled rejection with the same text", () => {
    // Usually different faults with different fixes; merging hides one behind the other.
    expect(fp({ kind: "error" })).not.toBe(fp({ kind: "unhandledrejection" }));
  });

  it("separates the same message thrown from different files", () => {
    expect(fp({ sourceFile: "/cart.js" })).not.toBe(fp({ sourceFile: "/checkout.js" }));
  });

  it("groups the same fault across occurrences that differ only in ids", () => {
    expect(fp({ message: "Order 1 failed" })).toBe(fp({ message: "Order 2 failed" }));
  });

  it("ignores the line number", () => {
    // Not part of the key: it moves whenever anything above it is edited, and including
    // it would re-group a live fault on an unrelated change to the same file.
    const a = errorFingerprint({ kind: "error", message: "boom", sourceFile: "/a.js" });
    const b = errorFingerprint({ kind: "error", message: "boom", sourceFile: "/a.js" });
    expect(a).toBe(b);
  });

  it("is a sha256 hex digest", () => {
    expect(fp()).toMatch(/^[0-9a-f]{64}$/);
  });
});
