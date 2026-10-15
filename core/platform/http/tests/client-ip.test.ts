import { describe, it, expect } from "bun:test";
import { clientIpFromRequestHeaders, clientIpForIngest, getClientIp, SEENTICS_PEER_IP_HEADER } from "../../../platform/http/client-ip";
import type { Context } from "hono";

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

function makeCtx(headerEntries: Record<string, string> = {}, peerIp?: string): Context {
  const headers = makeHeaders(headerEntries);
  if (peerIp) headers.set(SEENTICS_PEER_IP_HEADER, peerIp);
  return {
    req: {
      raw: { headers },
      header: (key: string) => headers.get(key) ?? undefined,
    },
  } as unknown as Context;
}

describe("clientIpFromRequestHeaders", () => {
  it("reads the first address of X-Forwarded-For by default", () => {
    const h = makeHeaders({ "x-forwarded-for": "  8.8.8.8 , 1.2.3.4" });
    expect(clientIpFromRequestHeaders(h)).toBe("8.8.8.8");
  });

  // A proxy that sets only X-Forwarded-For passes these through as the caller sent them:
  // trusting them first let every request choose a new address and escape per-IP limits.
  it("ignores CF-Connecting-IP, True-Client-IP and X-Real-IP unless configured", () => {
    const h = makeHeaders({ "cf-connecting-ip": "6.6.6.6", "true-client-ip": "7.7.7.7", "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" });
    expect(clientIpFromRequestHeaders(h)).toBe("1.2.3.4");
    expect(clientIpFromRequestHeaders(makeHeaders({ "cf-connecting-ip": "6.6.6.6" }))).toBe("");
  });

  it("reads the configured header instead", () => {
    const h = makeHeaders({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "1.2.3.4" });
    expect(clientIpFromRequestHeaders(h, "cf-connecting-ip")).toBe("6.6.6.6");
  });

  it("returns empty string when the header is absent", () => {
    expect(clientIpFromRequestHeaders(makeHeaders({}))).toBe("");
  });
});

describe("getClientIp (trustProxy=true)", () => {
  it("returns forwarded header ip when trustProxy is true", () => {
    const ctx = makeCtx({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.1");
    expect(getClientIp(ctx, true)).toBe("1.2.3.4");
  });

  it("falls back to peer ip when no forwarded header and trustProxy is true", () => {
    const ctx = makeCtx({}, "203.0.113.5");
    expect(getClientIp(ctx, true)).toBe("203.0.113.5");
  });

  it("returns empty when no headers and no peer", () => {
    const ctx = makeCtx({});
    expect(getClientIp(ctx, true)).toBe("");
  });
});

describe("getClientIp (trustProxy=false)", () => {
  it("returns peer ip when it is a public ip", () => {
    const ctx = makeCtx({}, "203.0.113.5");
    expect(getClientIp(ctx, false)).toBe("203.0.113.5");
  });

  it("returns peer ip even when private (trustProxy false, private peer)", () => {
    const ctx = makeCtx({}, "10.0.0.1");
    // private peer → returns peer (the function returns peer at the end regardless)
    expect(getClientIp(ctx, false)).toBe("10.0.0.1");
  });
});

describe("clientIpForIngest — private IP detection", () => {
  const PROD = true;
  const DEV = false;

  it("loopback ::1 is treated as non-public", () => {
    const ctx = makeCtx({}, "::1");
    // Private peer with no CF header in prod → falls through to peer
    const ip = clientIpForIngest(ctx, false, PROD);
    expect(ip).toBe("::1");
  });

  it("does not trust cf-connecting-ip without trustProxy: any caller can send it", () => {
    const ctx = makeCtx({ "cf-connecting-ip": "5.6.7.8" }, "10.0.0.1");
    expect(clientIpForIngest(ctx, false, PROD)).toBe("10.0.0.1");
  });

  it("returns forwarded header ip with trustProxy=true", () => {
    const ctx = makeCtx({ "x-real-ip": "6.6.6.6", "x-forwarded-for": "4.4.4.4" }, "127.0.0.1");
    expect(clientIpForIngest(ctx, true, PROD)).toBe("4.4.4.4");
  });

  it("in dev mode trusts x-forwarded-for without trustProxy", () => {
    const ctx = makeCtx({ "x-forwarded-for": "8.8.8.8" }, "127.0.0.1");
    expect(clientIpForIngest(ctx, false, DEV)).toBe("8.8.8.8");
  });

  it("in prod mode without trustProxy ignores x-forwarded-for (spoofable)", () => {
    const ctx = makeCtx({ "x-forwarded-for": "8.8.8.8" }, "127.0.0.1");
    // No CF header, non-public peer, prod → returns peer
    const ip = clientIpForIngest(ctx, false, PROD);
    expect(ip).toBe("127.0.0.1");
  });

  it("returns empty string when trustProxy=true and no headers at all", () => {
    const ctx = makeCtx({});
    expect(clientIpForIngest(ctx, true, PROD)).toBe("");
  });
});
