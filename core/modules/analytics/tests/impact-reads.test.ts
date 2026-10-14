import { describe, expect, it } from "bun:test";

// The repository imports the database client, which needs a URL to construct; nothing connects.
process.env.DATABASE_URL ??= "postgres://test-not-connected";
const { pathPattern } = await import("../repositories/impact-reads.repository");

describe("impact reads: entry-page pattern", () => {
  const matches = (path: string, page: string) => new RegExp(pathPattern(path)).test(page);

  it("matches a stored path exactly, trailing slash optional", () => {
    expect(matches("/pricing", "/pricing")).toBe(true);
    expect(matches("/pricing", "/pricing/")).toBe(true);
    expect(matches("/pricing", "/pricing/team")).toBe(false);
    expect(matches("/", "/")).toBe(true);
    expect(matches("/", "/about")).toBe(false);
  });

  it("reads a route pattern's :params as one segment", () => {
    expect(matches("/orders/:id", "/orders/123")).toBe(true);
    expect(matches("/orders/:id", "/orders/123/items")).toBe(false);
  });

  it("matches regex characters literally", () => {
    expect(matches("/a.b", "/a.b")).toBe(true);
    expect(matches("/a.b", "/axb")).toBe(false);
    expect(matches("/c++(x)", "/c++(x)")).toBe(true);
  });
});
