import { beforeEach, describe, expect, it } from "bun:test";
// Registers the shared infrastructure stubs (logger, config, storage) before the subject loads.
import { resetStubs, warnings } from "./support/stubs";
import { MemoryStylesheetStore } from "./support/memory-stylesheet-store";
import type { SafeFetchResult } from "../../../platform/http/safe-fetch";

const { StylesheetArchiveService, readStylesheetArchiveConfig, urlHash } = await import(
  "../services/stylesheets/stylesheet-archive.service"
);

const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CSS_URL = "https://shop.test/_next/static/css/3e3ba49c0fe97c41.css";
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);

const ok = (body: string, contentType = "text/css", url = CSS_URL): SafeFetchResult => ({
  kind: "ok", status: 200, url, contentType, body: new TextEncoder().encode(body),
});

function setup(responses: Record<string, SafeFetchResult | (() => SafeFetchResult)> = {}) {
  let now = T0;
  const store = new MemoryStylesheetStore();
  store.now = () => now;
  const objects = new Map<string, string>();
  const puts: string[] = [];
  const deleted: string[] = [];
  const fetched: string[] = [];
  const recordings = new Map<string, unknown[]>();
  let deleteThrows = false;
  const archive = new StylesheetArchiveService({
    store,
    storage: {
      put: async (key, css) => {
        puts.push(key);
        objects.set(key, css);
      },
      get: async (key) => {
        const v = objects.get(key);
        if (v === undefined) throw new Error("NoSuchKey");
        return v;
      },
      delete: async (keys) => {
        if (deleteThrows) throw new Error("storage unreachable");
        deleted.push(...keys);
        for (const k of keys) objects.delete(k);
      },
    },
    loadRecording: async (websiteId, sessionId) => recordings.get(`${websiteId}/${sessionId}`) ?? null,
    config: { ...readStylesheetArchiveConfig({}), backfillBatch: 2 },
    fetcher: async (url) => {
      fetched.push(url);
      const r = responses[url];
      if (!r) return { kind: "network_error", reason: "refused", url };
      return typeof r === "function" ? r() : r;
    },
    now: () => now,
    secret: () => "test-secret",
  });
  return {
    archive, store, objects, puts, deleted, fetched, recordings,
    advance: (ms: number) => { now += ms; },
    failDeletes: () => { deleteThrows = true; },
  };
}

const rowOf = (store: MemoryStylesheetStore, url = CSS_URL, site = SITE) => store.row(site, urlHash(url));

beforeEach(() => resetStubs());

describe("discovery", () => {
  it("queues each URL once, and caps the pending rows a site may have", async () => {
    const { archive, store } = setup();
    expect(await archive.discover(SITE, [CSS_URL, "https://cdn.test/a.css"])).toBe(2);
    expect(await archive.discover(SITE, [CSS_URL])).toBe(0);
    expect(rowOf(store)?.status).toBe("pending");

    const capped = setup();
    const urls = Array.from({ length: 50 }, (_, i) => `https://shop.test/${i}.css`);
    for (let i = 0; i < 12; i++) await capped.archive.discover(SITE, urls.map((u) => `${u}?v=${i}`));
    const pending = [...capped.store.rows.values()].filter((r) => r.status === "pending").length;
    expect(pending).toBeLessThanOrEqual(500 + 50);
    expect(pending).toBeGreaterThanOrEqual(500);
  });

  it("refuses a malformed website id and swallows store failures", async () => {
    const { archive, store } = setup();
    expect(await archive.discover("../../etc", [CSS_URL])).toBe(0);
    store.enqueue = async () => { throw new Error("pg down"); };
    expect(await archive.discover(SITE, ["https://x.test/b.css"])).toBe(0);
    expect(warnings.some((w) => w.msg === "stylesheet_discovery_failed")).toBe(true);
  });

  it("finds stylesheets in a snapshot's HTML", async () => {
    const { archive, store } = setup();
    await archive.discoverFromHtml(SITE, `<head><base href="https://shop.test/"><link rel="stylesheet" href="_next/static/css/3e3ba49c0fe97c41.css"></head>`, "https://shop.test/p/1");
    expect(rowOf(store)?.url).toBe(CSS_URL);
  });
});

describe("the fetch job", () => {
  it("stores a stylesheet with its url() references made absolute, content-addressed", async () => {
    const { archive, store, objects, puts } = setup({ [CSS_URL]: ok("@font-face{src:url(../media/f.woff2)}") });
    await archive.discover(SITE, [CSS_URL]);
    const stats = await archive.runOnce();
    expect(stats).toMatchObject({ claimed: 1, stored: 1, failed: 0, retried: 0 });
    const row = rowOf(store)!;
    expect(row.status).toBe("stored");
    expect(row.storageKey).toMatch(new RegExp(`^stylesheets/${SITE}/[0-9a-f]{64}\\.css$`));
    expect(objects.get(row.storageKey!)).toBe(`@font-face{src:url("https://shop.test/_next/static/media/f.woff2")}`);
    expect(puts.length).toBe(1);
  });

  it("uploads identical content once per site", async () => {
    const other = "https://shop.test/copy.css";
    const { archive, puts, store } = setup({ [CSS_URL]: ok("a{color:red}"), [other]: ok("a{color:red}", "text/css", other) });
    await archive.discover(SITE, [CSS_URL]);
    await archive.runOnce();
    await archive.discover(SITE, [other]);
    await archive.runOnce();
    expect(puts.length).toBe(1);
    expect(rowOf(store, other)?.storageKey).toBe(rowOf(store)!.storageKey);
  });

  it("marks 404 and 410 failed for good, on the first attempt", async () => {
    for (const status of [404, 410]) {
      const { archive, store } = setup({ [CSS_URL]: { kind: "http_error", status, url: CSS_URL } });
      await archive.discover(SITE, [CSS_URL]);
      expect(await archive.runOnce()).toMatchObject({ failed: 1 });
      expect(rowOf(store)).toMatchObject({ status: "failed", attempts: 1, lastError: `HTTP ${status}` });
    }
  });

  it("retries a transient failure with backoff, then gives up after three attempts", async () => {
    const { archive, store, advance, fetched } = setup({ [CSS_URL]: { kind: "http_error", status: 503, url: CSS_URL } });
    await archive.discover(SITE, [CSS_URL]);

    expect(await archive.runOnce()).toMatchObject({ retried: 1 });
    expect(rowOf(store)).toMatchObject({ status: "pending", attempts: 1 });
    // Not due yet: the next run claims nothing.
    expect(await archive.runOnce()).toMatchObject({ claimed: 0 });

    advance(2 * 60_000);
    expect(await archive.runOnce()).toMatchObject({ retried: 1 });
    expect(rowOf(store)).toMatchObject({ status: "pending", attempts: 2 });

    advance(30 * 60_000);
    expect(await archive.runOnce()).toMatchObject({ failed: 1 });
    expect(rowOf(store)).toMatchObject({ status: "failed", attempts: 3 });
    expect(fetched.length).toBe(3);
  });

  it("records the terminal outcomes: blocked, too large, not CSS", async () => {
    const a = "https://shop.test/a.css";
    const b = "https://shop.test/b.css";
    const c = "https://shop.test/c.css";
    const d = "https://shop.test/d.css";
    const { archive, store } = setup({
      [a]: { kind: "blocked", reason: "non-public address", url: a },
      [b]: { kind: "too_large", url: b },
      [c]: ok("<!DOCTYPE html><html>Not found</html>", "text/html", c),
      [d]: ok("<html>oops</html>", "text/plain", d),
    });
    await archive.discover(SITE, [a, b, c, d]);
    await archive.runOnce();
    expect(rowOf(store, a)).toMatchObject({ status: "failed", lastError: "blocked: non-public address" });
    expect(rowOf(store, b)?.status).toBe("too_large");
    expect(rowOf(store, c)?.status).toBe("not_css");
    expect(rowOf(store, d)?.status).toBe("not_css");
  });

  it("accepts CSS served as text/plain or without a type when it looks like CSS", async () => {
    const plain = "https://shop.test/plain.css";
    const { archive, store } = setup({ [CSS_URL]: ok("body{margin:0}", ""), [plain]: ok(".a{}", "text/plain; charset=utf-8", plain) });
    await archive.discover(SITE, [CSS_URL, plain]);
    await archive.runOnce();
    expect(rowOf(store)?.status).toBe("stored");
    expect(rowOf(store, plain)?.status).toBe("stored");
  });

  it("leaves a row pending under its lease when storage fails, so it is retried later", async () => {
    const { archive, store, advance } = setup({ [CSS_URL]: ok("a{}") });
    await archive.discover(SITE, [CSS_URL]);
    const put = (archive as unknown as { deps: { storage: { put: unknown } } }).deps.storage;
    const realPut = put.put;
    put.put = async () => { throw new Error("s3 down"); };
    await archive.runOnce();
    expect(rowOf(store)).toMatchObject({ status: "pending", attempts: 0 });
    put.put = realPut;
    advance(5 * 60_000);
    expect(await archive.runOnce()).toMatchObject({ stored: 1 });
  });
});

describe("serving", () => {
  it("serves the archived copy to a token issued for the same site", async () => {
    const { archive } = setup({ [CSS_URL]: ok("a{color:red}") });
    await archive.discover(SITE, [CSS_URL]);
    await archive.runOnce();
    const { token } = archive.accessToken(SITE);
    expect(await archive.serve(SITE, CSS_URL, token)).toEqual({ kind: "css", body: "a{color:red}" });
    // The fragment is not part of what was archived.
    expect(await archive.serve(SITE, `${CSS_URL}#x`, token)).toEqual({ kind: "css", body: "a{color:red}" });
  });

  it("refuses another site's token, a forged or expired token, and no token", async () => {
    const { archive, advance } = setup({ [CSS_URL]: ok("a{}") });
    await archive.discover(SITE, [CSS_URL]);
    await archive.runOnce();
    const otherToken = archive.accessToken(OTHER).token;
    expect(await archive.serve(SITE, CSS_URL, otherToken)).toEqual({ kind: "forbidden" });
    expect(await archive.serve(SITE, CSS_URL, undefined)).toEqual({ kind: "forbidden" });
    const { token } = archive.accessToken(SITE);
    expect(await archive.serve(SITE, CSS_URL, token.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toEqual({ kind: "forbidden" });
    advance(3 * 86_400_000);
    expect(await archive.serve(SITE, CSS_URL, token)).toEqual({ kind: "forbidden" });
  });

  it("never reads another site's archive, even for the same URL", async () => {
    const { archive } = setup({ [CSS_URL]: ok("a{}") });
    await archive.discover(SITE, [CSS_URL]);
    await archive.runOnce();
    const res = await archive.serve(OTHER, CSS_URL, archive.accessToken(OTHER).token);
    expect(res).toEqual({ kind: "not_found" });
  });

  it("redirects to the original while a discovered stylesheet has no copy yet", async () => {
    const { archive } = setup();
    await archive.discover(SITE, [CSS_URL]);
    const { token } = archive.accessToken(SITE);
    expect(await archive.serve(SITE, CSS_URL, token)).toEqual({ kind: "redirect", location: CSS_URL });
  });

  it("is not an open redirect: a URL the site never linked to is refused and not queued", async () => {
    const { archive, store } = setup();
    const { token } = archive.accessToken(SITE);
    expect(await archive.serve(SITE, "https://phish.test/login", token)).toEqual({ kind: "not_found" });
    expect(rowOf(store)).toBeUndefined();
  });

  it("does not redirect to anything but http(s)", async () => {
    const { archive } = setup();
    const { token } = archive.accessToken(SITE);
    expect(await archive.serve(SITE, "javascript:alert(1)", token)).toEqual({ kind: "not_found" });
    expect(await archive.serve(SITE, "/relative.css", token)).toEqual({ kind: "not_found" });
  });

  it("keeps one token per UTC day, valid into the next", () => {
    const { archive, advance } = setup();
    const a = archive.accessToken(SITE);
    advance(60 * 60_000);
    expect(archive.accessToken(SITE)).toEqual(a);
    expect(new Date(a.expiresAt).getTime()).toBe(Date.UTC(2026, 9, 16));
  });
});

describe("backfill", () => {
  it("walks recordings newest first, a batch per run, then stops", async () => {
    const { archive, store, recordings } = setup();
    const at = (h: number) => new Date(T0 - h * 3_600_000);
    store.cursor = { cursorTs: new Date(T0), cursorWebsiteId: "", cursorSessionId: "", floorTs: at(14 * 24), completed: false, scanned: 0 };
    store.sessions = [
      { websiteId: SITE, sessionId: "s1", startedAt: at(1) },
      { websiteId: SITE, sessionId: "s2", startedAt: at(2) },
      { websiteId: SITE, sessionId: "s3", startedAt: at(3) },
      { websiteId: SITE, sessionId: "old", startedAt: at(15 * 24) },
    ];
    const link = (href: string) => ({
      type: "rrweb", url: "https://shop.test/", data: { type: 2, data: { node: { type: 2, tagName: "link", attributes: { rel: "stylesheet", href }, childNodes: [] } } },
    });
    recordings.set(`${SITE}/s1`, [link("https://shop.test/1.css")]);
    recordings.set(`${SITE}/s3`, [link("https://shop.test/3.css")]);
    recordings.set(`${SITE}/old`, [link("https://shop.test/old.css")]);

    expect(await archive.runOnce()).toMatchObject({ backfillSessions: 2, backfillQueued: 1 });
    expect(store.cursor).toMatchObject({ cursorTs: at(2), cursorSessionId: "s2", completed: false });
    expect(await archive.runOnce()).toMatchObject({ backfillSessions: 1, backfillQueued: 1 });
    expect(store.cursor).toMatchObject({ completed: true, scanned: 3 });
    expect(await archive.runOnce()).toMatchObject({ backfillSessions: 0 });
    expect(rowOf(store, "https://shop.test/old.css")).toBeUndefined();
  });
});

describe("retention", () => {
  it("deletes unseen rows and only the objects no remaining row shares", async () => {
    const shared = "https://shop.test/copy.css";
    const fresh = "https://shop.test/fresh.css";
    const { archive, store, deleted, advance } = setup({
      [CSS_URL]: ok("a{}"),
      [shared]: ok("a{}", "text/css", shared),
      [fresh]: ok("b{}", "text/css", fresh),
    });
    await archive.discover(SITE, [CSS_URL]);
    await archive.runOnce();
    advance(40 * 86_400_000);
    await archive.discover(SITE, [shared, fresh]);
    await archive.runOnce();

    const out = await archive.purgeUnseen(SITE, new Date(T0 + 30 * 86_400_000), 100);
    expect(out).toEqual({ rows: 1, objects: 0, failures: 0 });
    expect(deleted).toEqual([]);
    expect(rowOf(store)).toBeUndefined();

    advance(40 * 86_400_000);
    const all = await archive.purgeUnseen(SITE, new Date(T0 + 79 * 86_400_000), 100);
    expect(all).toEqual({ rows: 2, objects: 2, failures: 0 });
    expect(store.rows.size).toBe(0);
  });

  it("keeps the rows when the objects cannot be deleted", async () => {
    const { archive, store, advance, failDeletes } = setup({ [CSS_URL]: ok("a{}") });
    await archive.discover(SITE, [CSS_URL]);
    await archive.runOnce();
    advance(40 * 86_400_000);
    failDeletes();
    expect(await archive.purgeUnseen(SITE, new Date(T0 + 30 * 86_400_000), 100)).toEqual({ rows: 0, objects: 0, failures: 1 });
    expect(rowOf(store)?.status).toBe("stored");
  });
});
