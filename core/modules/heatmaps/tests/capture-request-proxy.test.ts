import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Route } from "playwright";
import {
  decode,
  forwardableRequestHeaders,
  fulfillThroughPinnedFetch,
  fulfillableResponseHeaders,
} from "../lib/capture-request-proxy";
import { NonPublicHostError } from "../../../platform/http/public-host";

/** A Playwright route reduced to what the proxy touches, recording what it was answered with. */
function fakeRoute(url: string, init: { method?: string; headers?: Record<string, string>; body?: Buffer } = {}) {
  const fulfilled: { status?: number; headers?: Record<string, string>; body?: string | Buffer }[] = [];
  const route = {
    request: () => ({
      url: () => url,
      method: () => init.method ?? "GET",
      allHeaders: async () => init.headers ?? {},
      postDataBuffer: () => init.body ?? null,
    }),
    fulfill: async (r: (typeof fulfilled)[number]) => void fulfilled.push(r),
  } as unknown as Route;
  return { route, fulfilled };
}

describe("capture request proxy", () => {
  it("serves the page the pinned response, so Chromium never connects itself", async () => {
    const calls: string[] = [];
    const { route, fulfilled } = fakeRoute("https://shop.test/app.css", { headers: { ":authority": "shop.test", host: "shop.test", accept: "text/css" } });
    await fulfillThroughPinnedFetch(route, (async (url: string | URL, init?: RequestInit) => {
      calls.push(String(url));
      expect(new Headers(init?.headers).get("host")).toBeNull();
      return new Response(gzipSync(Buffer.from("body{}")), {
        status: 200,
        headers: { "content-type": "text/css", "content-encoding": "gzip", "content-length": "99" },
      });
    }) as never);

    expect(calls).toEqual(["https://shop.test/app.css"]);
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]!.status).toBe(200);
    expect(String(fulfilled[0]!.body)).toBe("body{}");
    expect(fulfilled[0]!.headers).toEqual({ "content-type": "text/css" });
  });

  it("propagates a private-address refusal so the caller aborts the request", async () => {
    const { route, fulfilled } = fakeRoute("https://rebind.test/");
    await expect(
      fulfillThroughPinnedFetch(route, (async () => { throw new NonPublicHostError("rebind.test"); }) as never),
    ).rejects.toThrow(NonPublicHostError);
    expect(fulfilled).toEqual([]);
  });

  it("hands a redirect back unfollowed, so its next hop is checked as its own request", async () => {
    const { route, fulfilled } = fakeRoute("https://shop.test/old");
    await fulfillThroughPinnedFetch(route, (async () =>
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })) as never);
    expect(fulfilled[0]!.status).toBe(302);
    expect(fulfilled[0]!.headers!.location).toBe("http://169.254.169.254/");
  });

  it("drops connection-level and pseudo request headers and pins accept-encoding", () => {
    expect(forwardableRequestHeaders({
      ":method": "GET", Host: "x", connection: "keep-alive", "content-length": "3",
      cookie: "a=1", "Accept-Encoding": "zstd",
    })).toEqual({ cookie: "a=1", "accept-encoding": "gzip, deflate, br" });
  });

  it("drops response headers the decoded body would contradict", () => {
    const h = new Headers({ "content-encoding": "br", "content-length": "1", "transfer-encoding": "chunked", "x-ok": "1" });
    expect(fulfillableResponseHeaders(h)).toEqual({ "x-ok": "1" });
  });

  it("passes an unknown or corrupt encoding through untouched", () => {
    expect(decode(Buffer.from("abc"), "zstd").toString()).toBe("abc");
    expect(decode(Buffer.from("not gzip"), "gzip").toString()).toBe("not gzip");
  });
});

/**
 * What `page.route` cannot see has to be shut off on the context, and that cannot be unit-tested
 * without a browser — so, as with the claim query, the source is checked for it.
 */
describe("capture browser context", () => {
  const SOURCE = readFileSync(join(import.meta.dir, "..", "lib", "playwright-browser.ts"), "utf8");
  const CAPTURE = readFileSync(join(import.meta.dir, "..", "lib", "playwright-screenshots.ts"), "utf8");

  it("blocks service workers, whose fetches bypass page.route", () => {
    expect(SOURCE).toContain('serviceWorkers: "block"');
  });

  it("answers WebSockets locally instead of connecting them", () => {
    expect(SOURCE).toContain("routeWebSocket(");
    expect(SOURCE).not.toContain(".connectToServer(");
  });

  it("never hands a public request back to Chromium to resolve again", () => {
    // `route.continue()` survives only for the development docker rewrite.
    const continues = CAPTURE.split("return route.continue()").length - 1;
    expect(continues).toBe(1);
    expect(CAPTURE).toContain("if (allowDevLocal && u.hostname === requested.hostname) return route.continue();");
    expect(CAPTURE).toContain("fulfillThroughPinnedFetch(route)");
  });
});
