import { describe, it, expect } from "bun:test";
import { randomHex, newSiteId, newTrackingId, newVerificationToken } from "../../lib/ids";

describe("randomHex", () => {
  it("returns a string of double the byte length", () => {
    expect(randomHex(12)).toHaveLength(24);
    expect(randomHex(8)).toHaveLength(16);
    expect(randomHex(16)).toHaveLength(32);
  });

  it("contains only hex characters", () => {
    const hex = randomHex(20);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });

  it("returns unique values on consecutive calls", () => {
    const a = randomHex(12);
    const b = randomHex(12);
    expect(a).not.toBe(b);
  });
});

describe("newSiteId", () => {
  it("returns a 24-character hex string", () => {
    expect(newSiteId()).toHaveLength(24);
  });

  it("is lowercase hex only", () => {
    expect(/^[0-9a-f]{24}$/.test(newSiteId())).toBe(true);
  });

  it("returns unique values", () => {
    expect(newSiteId()).not.toBe(newSiteId());
  });
});

describe("newTrackingId", () => {
  it("starts with ST-", () => {
    expect(newTrackingId().startsWith("ST-")).toBe(true);
  });

  it("has the correct total length (ST- + 16 hex chars = 19)", () => {
    expect(newTrackingId()).toHaveLength(19);
  });

  it("suffix is lowercase hex only", () => {
    const id = newTrackingId();
    const suffix = id.slice(3);
    expect(/^[0-9a-f]{16}$/.test(suffix)).toBe(true);
  });

  it("returns unique values", () => {
    expect(newTrackingId()).not.toBe(newTrackingId());
  });
});

describe("newVerificationToken", () => {
  it("returns a 32-character hex string", () => {
    expect(newVerificationToken()).toHaveLength(32);
  });

  it("is lowercase hex only", () => {
    expect(/^[0-9a-f]{32}$/.test(newVerificationToken())).toBe(true);
  });

  it("returns unique values", () => {
    expect(newVerificationToken()).not.toBe(newVerificationToken());
  });
});
