import { describe, expect, it } from "bun:test";
import { buildFunnelProgressQuery, MAX_FUNNEL_STEPS, normalizeFunnelPath, type FunnelProgressStep } from "../lib/funnel-progress-sql";

const W = "site_123";
const START = "2026-01-01T00:00:00.000Z";
const END = "2026-01-31T00:00:00.000Z";
const page = (path: string, match: "exact" | "contains" | "starts_with" | "regex" = "exact"): FunnelProgressStep => ({ kind: "page", path, match });

describe("buildFunnelProgressQuery", () => {
  it("makes one cte per step, chained, and one result row per step", () => {
    const { text } = buildFunnelProgressQuery(W, [page("/"), page("/docs"), page("/apply")], START, END);
    for (const i of [0, 1, 2]) expect(text).toContain(`s${i} AS`);
    expect(text).toContain("JOIN s0 p ON p.vkey = b.vkey AND b.t > p.t");
    expect(text).toContain("JOIN s1 p ON p.vkey = b.vkey AND b.t > p.t");
    expect(text.match(/UNION ALL/g)).toHaveLength(2);
  });

  it("passes the website and the range as the first three parameters", () => {
    const { params } = buildFunnelProgressQuery(W, [page("/")], START, END);
    expect(params.slice(0, 3)).toEqual([W, START, END]);
  });

  it("puts every value from the definition in a parameter and none in the SQL text", () => {
    const nasty = "'; DROP TABLE analytics_events; --";
    const { text, params } = buildFunnelProgressQuery(W, [page(nasty), { kind: "event", event: nasty }], START, END);
    expect(text).not.toContain("DROP TABLE");
    expect(text).not.toContain(nasty);
    expect(params).toContain(nasty);
  });

  it("reads only the kinds of event the funnel can use", () => {
    const onlyPages = buildFunnelProgressQuery(W, [page("/"), page("/a")], START, END);
    expect(onlyPages.params.find(Array.isArray)).toEqual(["pageview"]);
    const mixed = buildFunnelProgressQuery(W, [page("/"), { kind: "event", event: "purchase" }], START, END);
    expect([...(mixed.params.find(Array.isArray) as string[])].sort()).toEqual(["custom", "pageview", "purchase"]);
  });

  it("normalises an exact path the way the goal reports do", () => {
    expect(normalizeFunnelPath("/pricing/")).toBe("/pricing");
    expect(normalizeFunnelPath("/")).toBe("/");
    expect(normalizeFunnelPath("//")).toBe("/");
    expect(buildFunnelProgressQuery(W, [page("/pricing/")], START, END).params).toContain("/pricing");
  });

  it("uses a different comparison for each way of matching a page", () => {
    const text = (match: "exact" | "contains" | "starts_with" | "regex") => buildFunnelProgressQuery(W, [page("/x", match)], START, END).text;
    expect(text("contains")).toContain("strpos(");
    expect(text("starts_with")).toContain("starts_with(");
    expect(text("regex")).toContain(" ~ ");
    expect(text("exact")).toContain("rtrim(");
  });

  it("refuses an empty funnel and one over the step limit", () => {
    expect(() => buildFunnelProgressQuery(W, [], START, END)).toThrow("at least one step");
    const many = Array.from({ length: MAX_FUNNEL_STEPS + 1 }, (_, i) => page(`/p${i}`));
    expect(() => buildFunnelProgressQuery(W, many, START, END)).toThrow("at most");
  });

  it("adds a limit between steps only when the funnel sets one", () => {
    const without = buildFunnelProgressQuery(W, [page("/"), page("/a")], START, END);
    expect(without.text).not.toContain("make_interval");
    const withWindow = buildFunnelProgressQuery(W, [page("/"), page("/a"), page("/b")], START, END, 24);
    expect(withWindow.text.match(/make_interval/g)).toHaveLength(2);   // one per step after the first
    expect(withWindow.params).toContain(24);
  });
});
