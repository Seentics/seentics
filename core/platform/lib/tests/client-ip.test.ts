import { describe, it, expect } from "bun:test";
import { clientIpFromRequestHeaders, clientIpForIngest, getClientIp, SEENTICS_PEER_IP_HEADER } from "../../../platform/lib/client-ip";
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
  it("returns cf-connecting-ip when present", () => {
    const h = makeHeaders({ "cf-connecting-ip": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(clientIpFromRequestHeaders(h)).toBe("1.2.3.4");
  });

  it("falls back to true-client-ip when no cf header", () => {
    const h = makeHeaders({ "true-client-ip": "9.9.9.9", "x-real-ip": "5.5.5.5" });
    expect(clientIpFromRequestHeaders(h)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when no cf or true-client-ip", () => {
    const h = makeHeaders({ "x-real-ip": "3.3.3.3" });
    expect(clientIpFromRequestHeaders(h)).toBe("3.3.3.3");
  });

  it("returns first IP from x-forwarded-for chain", () => {
    const h = makeHeaders({ "x-forwarded-for": "10.0.0.1, 172.16.0.1, 1.2.3.4" });
    expect(clientIpFromRequestHeaders(h)).toBe("10.0.0.1");
  });

  it("trims whitespace from extracted IP", () => {
    const h = makeHeaders({ "x-forwarded-for": "  8.8.8.8 , 1.2.3.4" });
    expect(clientIpFromRequestHeaders(h)).toBe("8.8.8.8");
  });

  it("returns empty string when no relevant headers present", () => {
    expect(clientIpFromRequestHeaders(makeHeaders({}))).toBe("");
  });
});

describe("getClientIp (trustProxy=true)", () => {
  it("returns forwarded header ip when trustProxy is true", () => {
    const ctx = makeCtx({ "cf-connecting-ip": "1.2.3.4" }, "10.0.0.1");
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

  it("returns cf-connecting-ip even without trustProxy (safe CF header)", () => {
    const ctx = makeCtx({ "cf-connecting-ip": "5.6.7.8" }, "10.0.0.1");
    expect(clientIpForIngest(ctx, false, PROD)).toBe("5.6.7.8");
  });

  it("returns forwarded header ip with trustProxy=true", () => {
    const ctx = makeCtx({ "x-real-ip": "4.4.4.4" }, "127.0.0.1");
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
