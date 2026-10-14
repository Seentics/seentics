import { describe, expect, it } from "bun:test";
import {
  absoluteStylesheetUrl,
  stylesheetUrlsFromHtml,
  stylesheetUrlsFromReplayEvents,
} from "../services/stylesheets/stylesheet-hrefs";

const el = (tagName: string, attributes: Record<string, unknown>, childNodes: unknown[] = []) => ({
  type: 2, tagName, attributes, childNodes, id: Math.floor(Math.random() * 1e6),
});

/** A stored envelope around an rrweb full snapshot of `head` and `body` children. */
function fullSnapshot(head: unknown[], body: unknown[] = [], url = "https://shop.test/products/1") {
  return {
    type: "rrweb",
    ts: 1,
    url,
    sid: "s",
    vid: "v",
    data: {
      type: 2,
      timestamp: 1,
      data: {
        node: { type: 0, childNodes: [el("html", {}, [el("head", {}, head), el("body", {}, body)])] },
        initialOffset: { top: 0, left: 0 },
      },
    },
  };
}

function mutation(adds: unknown[], url = "https://shop.test/products/1") {
  return { type: "rrweb", ts: 2, url, sid: "s", vid: "v", data: { type: 3, timestamp: 2, data: { source: 0, adds, removes: [], texts: [], attributes: [] } } };
}

describe("stylesheetUrlsFromReplayEvents", () => {
  it("finds stylesheet links anywhere in a full snapshot", () => {
    const ev = fullSnapshot(
      [
        el("link", { rel: "stylesheet", href: "https://shop.test/_next/static/css/3e3ba49c0fe97c41.css" }),
        el("meta", { charset: "utf-8" }),
      ],
      [el("div", {}, [el("link", { rel: "Stylesheet", href: "https://cdn.test/widget.css" })])],
    );
    expect(stylesheetUrlsFromReplayEvents([ev])).toEqual([
      "https://shop.test/_next/static/css/3e3ba49c0fe97c41.css",
      "https://cdn.test/widget.css",
    ]);
  });

  it("finds links added by DOM mutations, including inside an added subtree", () => {
    const ev = mutation([
      { parentId: 4, nextId: null, node: el("link", { rel: "stylesheet", href: "https://shop.test/late.css" }) },
      { parentId: 5, nextId: null, node: el("div", {}, [el("link", { rel: "alternate stylesheet", href: "https://shop.test/alt.css" })]) },
    ]);
    expect(stylesheetUrlsFromReplayEvents([ev])).toEqual(["https://shop.test/late.css", "https://shop.test/alt.css"]);
  });

  it("resolves a relative href against the event's page URL", () => {
    const ev = fullSnapshot([el("link", { rel: "stylesheet", href: "../css/site.css" })], [], "https://shop.test/products/1");
    expect(stylesheetUrlsFromReplayEvents([ev])).toEqual(["https://shop.test/css/site.css"]);
  });

  it("ignores non-stylesheet links, inlined sheets, non-http hrefs and other event types", () => {
    const ev = fullSnapshot([
      el("link", { rel: "preload", as: "style", href: "https://shop.test/preload.css" }),
      el("link", { rel: "icon", href: "https://shop.test/favicon.ico" }),
      el("link", { rel: "stylesheet", href: "https://shop.test/inlined.css", _cssText: "body{}" }),
      el("link", { rel: "stylesheet", href: "data:text/css,body{}" }),
      el("link", { rel: "stylesheet" }),
    ]);
    const mouse = { type: "rrweb", url: "https://shop.test/", data: { type: 3, data: { source: 1, positions: [] } } };
    const consoleEv = { type: "console_event", url: "https://shop.test/", data: { node: el("link", { rel: "stylesheet", href: "https://x.test/a.css" }) } };
    expect(stylesheetUrlsFromReplayEvents([ev, mouse, consoleEv])).toEqual([]);
  });

  it("dedupes, drops the fragment, and stops at the limit", () => {
    const links = Array.from({ length: 80 }, (_, i) => el("link", { rel: "stylesheet", href: `https://shop.test/${i % 60}.css#x` }));
    const out = stylesheetUrlsFromReplayEvents([fullSnapshot(links)]);
    expect(out.length).toBe(50);
    expect(new Set(out).size).toBe(50);
    expect(out[0]).toBe("https://shop.test/0.css");
  });

  it("accepts bare rrweb events as well as envelopes", () => {
    const bare = fullSnapshot([el("link", { rel: "stylesheet", href: "https://shop.test/a.css" })]).data;
    expect(stylesheetUrlsFromReplayEvents([bare])).toEqual(["https://shop.test/a.css"]);
  });
});

describe("stylesheetUrlsFromHtml", () => {
  it("resolves against the snapshot's <base href>, not the page path", () => {
    const html = `<!DOCTYPE html><html><head><base href="https://shop.test/"><link rel="stylesheet" href="_next/static/css/a.css"><link href='/b.css?v=1&amp;x=2' rel='stylesheet'></head></html>`;
    expect(stylesheetUrlsFromHtml(html, "https://shop.test/deep/page")).toEqual([
      "https://shop.test/_next/static/css/a.css",
      "https://shop.test/b.css?v=1&x=2",
    ]);
  });

  it("falls back to the page URL without a base, and skips other links", () => {
    const html = `<head><link rel=stylesheet href=theme.css><link rel="icon" href="/f.ico"><link rel="preload" href="/p.css" as="style"></head>`;
    expect(stylesheetUrlsFromHtml(html, "https://shop.test/blog/post")).toEqual(["https://shop.test/blog/theme.css"]);
  });
});

describe("absoluteStylesheetUrl", () => {
  it("accepts only http(s) and bounded length", () => {
    expect(absoluteStylesheetUrl("https://a.test/x.css", undefined)).toBe("https://a.test/x.css");
    expect(absoluteStylesheetUrl("javascript:alert(1)", undefined)).toBeNull();
    expect(absoluteStylesheetUrl("x.css", undefined)).toBeNull();
    expect(absoluteStylesheetUrl(`https://a.test/${"a".repeat(3000)}.css`, undefined)).toBeNull();
  });
});
