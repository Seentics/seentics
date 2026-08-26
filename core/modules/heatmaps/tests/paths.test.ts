import { describe, it, expect } from "bun:test";
import { extractPath, normalizeHeatmapPagePath } from "../../../modules/heatmaps/lib/paths";

describe("extractPath", () => {
  it("returns / for empty string", () => {
    expect(extractPath("")).toBe("/");
  });

  it("returns / for whitespace-only string", () => {
    expect(extractPath("   ")).toBe("/");
  });

  it("extracts path from full URL", () => {
    expect(extractPath("https://example.com/about")).toBe("/about");
  });

  it("extracts path with query string from full URL", () => {
    expect(extractPath("https://example.com/search?q=foo")).toBe("/search");
  });

  it("extracts path from URL with hash", () => {
    expect(extractPath("https://example.com/page#section")).toBe("/page");
  });

  it("extracts path from protocol-relative URL", () => {
    expect(extractPath("//example.com/docs/intro")).toBe("/docs/intro");
  });

  it("returns / when URL has no path", () => {
    expect(extractPath("https://example.com")).toBe("/");
  });

  it("preserves bare path starting with /", () => {
    expect(extractPath("/blog/post-title")).toBe("/blog/post-title");
  });

  it("prepends / to bare path not starting with /", () => {
    expect(extractPath("about/us")).toBe("/about/us");
  });

  it("strips query from bare path", () => {
    expect(extractPath("/search?q=hello")).toBe("/search");
  });

  it("strips hash from bare path", () => {
    expect(extractPath("/page#section")).toBe("/page");
  });

  it("handles deeply nested path", () => {
    expect(extractPath("https://example.com/a/b/c/d")).toBe("/a/b/c/d");
  });

  it("returns / for root path", () => {
    expect(extractPath("https://example.com/")).toBe("/");
  });

  it("handles HTTP scheme", () => {
    expect(extractPath("http://example.com/api")).toBe("/api");
  });

  it("treats non-URL string as a bare path (prepends /)", () => {
    // "://bad-url" doesn't match the URL-protocol regex, so it's treated as a bare path
    expect(extractPath("://bad-url")).toBe("/://bad-url");
  });
});

describe("normalizeHeatmapPagePath", () => {
  it("returns / for empty string", () => {
    expect(normalizeHeatmapPagePath("")).toBe("/");
  });

  it("returns / for whitespace-only string", () => {
    expect(normalizeHeatmapPagePath("   ")).toBe("/");
  });

  it("keeps simple path unchanged", () => {
    expect(normalizeHeatmapPagePath("/about")).toBe("/about");
  });

  it("prepends / when missing", () => {
    expect(normalizeHeatmapPagePath("about")).toBe("/about");
  });

  it("strips trailing slash", () => {
    expect(normalizeHeatmapPagePath("/about/")).toBe("/about");
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizeHeatmapPagePath("/about///")).toBe("/about");
  });

  it("strips query string", () => {
    expect(normalizeHeatmapPagePath("/search?q=foo")).toBe("/search");
  });

  it("strips hash fragment", () => {
    expect(normalizeHeatmapPagePath("/page#section")).toBe("/page");
  });

  it("strips both query and hash (query first)", () => {
    expect(normalizeHeatmapPagePath("/page?a=1#b")).toBe("/page");
  });

  it("collapses UUID segments to :id", () => {
    const path = "/replays/550e8400-e29b-41d4-a716-446655440000";
    expect(normalizeHeatmapPagePath(path)).toBe("/replays/:id");
  });

  it("collapses long numeric IDs (6+ digits) to :id", () => {
    expect(normalizeHeatmapPagePath("/users/123456")).toBe("/users/:id");
  });

  it("does NOT collapse short numeric IDs (<6 digits)", () => {
    expect(normalizeHeatmapPagePath("/users/12345")).toBe("/users/12345");
  });

  it("collapses session-slug segments ([letter]-[16+ alphanumeric]) to :id", () => {
    expect(normalizeHeatmapPagePath("/sessions/s-abcdefghijklmnopqr")).toBe("/sessions/:id");
  });

  it("does NOT collapse short session-like segments", () => {
    expect(normalizeHeatmapPagePath("/sessions/s-short")).toBe("/sessions/s-short");
  });

  it("collapses 24+ char alphanumeric segment to :id", () => {
    expect(normalizeHeatmapPagePath("/data/abcdefghijklmnopqrstuvwx")).toBe("/data/:id");
  });

  it("does NOT collapse segments shorter than 24 chars", () => {
    expect(normalizeHeatmapPagePath("/data/abcdefghijklmnopqrstu")).toBe("/data/abcdefghijklmnopqrstu");
  });

  it("collapses multiple dynamic segments independently", () => {
    const path = "/orgs/550e8400-e29b-41d4-a716-446655440000/users/123456789";
    expect(normalizeHeatmapPagePath(path)).toBe("/orgs/:id/users/:id");
  });

  it("preserves static segments between dynamic ones", () => {
    const path = "/blog/123456/comments";
    expect(normalizeHeatmapPagePath(path)).toBe("/blog/:id/comments");
  });

  it("returns / for root path", () => {
    expect(normalizeHeatmapPagePath("/")).toBe("/");
  });

  it("handles path that is only trailing slash after strip", () => {
    expect(normalizeHeatmapPagePath("//")).toBe("/");
  });
});
