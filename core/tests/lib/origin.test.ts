import { describe, it, expect } from "bun:test";
import {
  originFromRequest,
  validateOriginDomain,
  validateWebhookUrl,
  validateScreenshotTargetUrl,
} from "../../lib/origin";

// ─── originFromRequest ──────────────────────────────────────────────────────

describe("originFromRequest", () => {
  it("returns the Origin header when present", () => {
    const h = new Headers({ origin: "https://example.com" });
    expect(originFromRequest(h)).toBe("https://example.com");
  });

  it("falls back to Referer when Origin is absent", () => {
    const h = new Headers({ referer: "https://example.com/page" });
    expect(originFromRequest(h)).toBe("https://example.com/page");
  });

  it("prefers Origin over Referer when both present", () => {
    const h = new Headers({ origin: "https://a.com", referer: "https://b.com/p" });
    expect(originFromRequest(h)).toBe("https://a.com");
  });

  it("returns empty string when neither header is present", () => {
    expect(originFromRequest(new Headers())).toBe("");
  });

  it("trims whitespace from Origin", () => {
    const h = new Headers({ origin: "  https://example.com  " });
    expect(originFromRequest(h)).toBe("https://example.com");
  });
});

// ─── validateOriginDomain ───────────────────────────────────────────────────

describe("validateOriginDomain", () => {
  const PROD = "production";
  const DEV  = "development";
  const SITE = "https://example.com";

  it("allows empty origin (no CORS check needed)", () => {
    expect(validateOriginDomain("", SITE, PROD)).toBe(true);
    expect(validateOriginDomain("   ", SITE, PROD)).toBe(true);
  });

  it("allows origin that matches the registered domain exactly", () => {
    expect(validateOriginDomain("https://example.com", SITE, PROD)).toBe(true);
  });

  it("strips www from both sides before comparing", () => {
    expect(validateOriginDomain("https://www.example.com", SITE, PROD)).toBe(true);
    expect(validateOriginDomain("https://example.com", "https://www.example.com", PROD)).toBe(true);
  });

  it("blocks an origin from a different domain in production", () => {
    expect(validateOriginDomain("https://evil.com", SITE, PROD)).toBe(false);
  });

  it("blocks a subdomain that doesn't match the root", () => {
    expect(validateOriginDomain("https://sub.example.com", SITE, PROD)).toBe(false);
  });

  it("allows localhost origin in development (loopback bypass)", () => {
    expect(validateOriginDomain("http://localhost:3000", SITE, DEV)).toBe(true);
    expect(validateOriginDomain("http://127.0.0.1:3000", SITE, DEV)).toBe(true);
  });

  it("blocks localhost origin in production", () => {
    expect(validateOriginDomain("http://localhost:3000", SITE, PROD)).toBe(false);
  });

  it("returns false for a malformed origin URL", () => {
    expect(validateOriginDomain("not a url://bad", SITE, PROD)).toBe(false);
  });

  it("handles registered URL without protocol (plain hostname)", () => {
    expect(validateOriginDomain("https://mysite.io", "mysite.io", PROD)).toBe(true);
  });

  it("handles registered URL with a port", () => {
    expect(validateOriginDomain("https://api.acme.com", "https://api.acme.com:8080/", PROD)).toBe(true);
  });
});

// ─── validateWebhookUrl ─────────────────────────────────────────────────────

describe("validateWebhookUrl", () => {
  it("allows a valid HTTPS URL", () => {
    expect(validateWebhookUrl("https://hooks.example.com/notify")).toBe(true);
  });

  it("blocks HTTP (non-HTTPS)", () => {
    expect(validateWebhookUrl("http://hooks.example.com/notify")).toBe(false);
  });

  it("blocks localhost", () => {
    expect(validateWebhookUrl("https://localhost/hook")).toBe(false);
  });

  it("blocks 127.0.0.1", () => {
    expect(validateWebhookUrl("https://127.0.0.1/hook")).toBe(false);
  });

  it("blocks IPv4 literals", () => {
    expect(validateWebhookUrl("https://1.2.3.4/hook")).toBe(false);
  });

  it("blocks cloud metadata hostname", () => {
    expect(validateWebhookUrl("https://metadata.google.internal/computeMetadata")).toBe(false);
  });

  it("blocks any .internal TLD", () => {
    expect(validateWebhookUrl("https://service.cluster.internal/api")).toBe(false);
  });

  it("blocks invalid URL", () => {
    expect(validateWebhookUrl("not-a-url")).toBe(false);
  });

  it("blocks host.docker.internal", () => {
    expect(validateWebhookUrl("https://host.docker.internal/api")).toBe(false);
  });
});

// ─── validateScreenshotTargetUrl ────────────────────────────────────────────

describe("validateScreenshotTargetUrl", () => {
  const SITE = "https://example.com";

  it("allows HTTP on the registered domain", () => {
    expect(validateScreenshotTargetUrl("http://example.com/page", SITE)).toBe(true);
  });

  it("allows HTTPS on the registered domain", () => {
    expect(validateScreenshotTargetUrl("https://example.com/page", SITE)).toBe(true);
  });

  it("allows a subdomain of the registered domain", () => {
    expect(validateScreenshotTargetUrl("https://blog.example.com/post", SITE)).toBe(true);
  });

  it("blocks a different domain", () => {
    expect(validateScreenshotTargetUrl("https://evil.com/page", SITE)).toBe(false);
  });

  it("blocks localhost as target URL", () => {
    expect(validateScreenshotTargetUrl("http://localhost/page", SITE)).toBe(false);
  });

  it("blocks an IPv4 literal as target URL", () => {
    expect(validateScreenshotTargetUrl("http://192.168.1.1/page", SITE)).toBe(false);
  });

  it("blocks a ftp:// protocol", () => {
    expect(validateScreenshotTargetUrl("ftp://example.com/file", SITE)).toBe(false);
  });

  it("returns false for a malformed URL", () => {
    expect(validateScreenshotTargetUrl("not-a-url", SITE)).toBe(false);
  });

  it("blocks when registered URL resolves to localhost (SSRF via site config)", () => {
    expect(validateScreenshotTargetUrl("https://example.com/page", "http://127.0.0.1")).toBe(false);
  });

  it("strips www from both sides before comparing", () => {
    expect(validateScreenshotTargetUrl("https://www.example.com/page", "https://www.example.com")).toBe(true);
  });
});
