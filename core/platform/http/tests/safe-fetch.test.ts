import { describe, expect, it } from "bun:test";
import { isBlockedIp } from "../public-host";
import { safeFetch, unsafeUrlReason, type SafeFetchOptions } from "../safe-fetch";

/** DNS that answers from a table; unknown names do not resolve. */
const dns = (table: Record<string, string[]>) => async (host: string) => {
  const ips = table[host];
  if (!ips) throw new Error("ENOTFOUND");
  return ips;
};

type Hop = { status: number; headers?: Record<string, string>; body?: string; stream?: ReadableStream<Uint8Array> };

/** A fetch that answers by URL and records every URL it was asked for. */
function fakeFetch(routes: Record<string, Hop>) {
  const asked: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    asked.push(url);
    expect(init?.redirect).toBe("manual");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toContain("Seentics");
    const hop = routes[url];
    if (!hop) throw new Error("connection refused");
    return new Response(hop.stream ?? hop.body ?? "", { status: hop.status, headers: hop.headers });
  }) as typeof fetch;
  return { impl, asked };
}

const PUBLIC = { "site.test": ["93.184.216.34"], "cdn.test": ["2606:2800:220:1::1"] };

function opts(fetchImpl: typeof fetch, over: Partial<SafeFetchOptions> = {}): SafeFetchOptions {
  return {
    maxBytes: 1024,
    timeoutMs: 2_000,
    maxRedirects: 3,
    userAgent: "SeenticsStylesheetArchiver/test",
    lookup: dns({ ...PUBLIC, "internal.site.test": ["10.0.0.5"], "v6loop.test": ["::1"], "mapped.test": ["::ffff:127.0.0.1"], "mappedhex.test": ["::ffff:a9fe:a9fe"] }),
    fetchImpl,
    ...over,
  };
}

describe("unsafeUrlReason", () => {
  it("allows only http(s) on default ports, without credentials or internal names", () => {
    expect(unsafeUrlReason("https://site.test/a.css")).toBeNull();
    expect(unsafeUrlReason("http://site.test:80/a.css")).toBeNull();
    expect(unsafeUrlReason("https://site.test:443/a.css")).toBeNull();
    expect(unsafeUrlReason("https://site.test:8443/a.css")).toBe("non-default port");
    expect(unsafeUrlReason("http://site.test:443/a.css")).toBe("non-default port");
    expect(unsafeUrlReason("ftp://site.test/a.css")).toBe("scheme not allowed");
    expect(unsafeUrlReason("file:///etc/passwd")).toBe("scheme not allowed");
    expect(unsafeUrlReason("https://user:pw@site.test/a.css")).toBe("credentials in url");
    expect(unsafeUrlReason("http://localhost/a.css")).toBe("internal host");
    expect(unsafeUrlReason("http://metadata.google.internal/")).toBe("internal host");
  });
});

describe("isBlockedIp (the address policy safeFetch applies)", () => {
  it("blocks private, loopback, link-local, CGNAT, multicast and reserved ranges in every spelling", () => {
    for (const ip of [
      "127.0.0.1", "10.0.0.1", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "224.0.0.1", "240.0.0.1", "255.255.255.255", "198.18.0.1",
      "::1", "::", "fe80::1", "fc00::1", "fd12::1", "fec0::1", "ff02::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1", "::127.0.0.1", "64:ff9b::a00:1",
    ]) expect(isBlockedIp(ip)).toBe(true);
    for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("safeFetch", () => {
  it("returns the body, final URL and content type of a public resource", async () => {
    const f = fakeFetch({ "https://site.test/a.css": { status: 200, headers: { "content-type": "Text/CSS; charset=utf-8" }, body: "body{}" } });
    const res = await safeFetch("https://site.test/a.css", opts(f.impl));
    expect(res).toMatchObject({ kind: "ok", status: 200, url: "https://site.test/a.css", contentType: "text/css; charset=utf-8" });
    if (res.kind === "ok") expect(new TextDecoder().decode(res.body)).toBe("body{}");
  });

  it("refuses names resolving to private, IPv6 loopback and IPv4-mapped addresses, before connecting", async () => {
    const f = fakeFetch({});
    for (const host of ["internal.site.test", "v6loop.test", "mapped.test", "mappedhex.test", "unknown.test"]) {
      expect(await safeFetch(`https://${host}/a.css`, opts(f.impl))).toMatchObject({ kind: "blocked" });
    }
    for (const literal of ["http://127.0.0.1/a.css", "http://[::1]/a.css", "http://[::ffff:127.0.0.1]/a.css", "http://169.254.169.254/latest/meta-data"]) {
      expect(await safeFetch(literal, opts(f.impl))).toMatchObject({ kind: "blocked" });
    }
    expect(f.asked).toEqual([]);
  });

  it("refuses a non-default port", async () => {
    const f = fakeFetch({});
    expect(await safeFetch("https://site.test:8080/a.css", opts(f.impl))).toMatchObject({ kind: "blocked", reason: "non-default port" });
    expect(f.asked).toEqual([]);
  });

  it("follows a redirect to a public host, checking every hop", async () => {
    const f = fakeFetch({
      "https://site.test/a.css": { status: 301, headers: { location: "https://cdn.test/v2/a.css" } },
      "https://cdn.test/v2/a.css": { status: 302, headers: { location: "../b.css" } },
      "https://cdn.test/b.css": { status: 200, headers: { "content-type": "text/css" }, body: "a{}" },
    });
    const res = await safeFetch("https://site.test/a.css", opts(f.impl));
    expect(res).toMatchObject({ kind: "ok", url: "https://cdn.test/b.css" });
    expect(f.asked).toEqual(["https://site.test/a.css", "https://cdn.test/v2/a.css", "https://cdn.test/b.css"]);
  });

  it("refuses a redirect to a private address, a non-default port or another scheme", async () => {
    for (const location of ["https://internal.site.test/x.css", "http://127.0.0.1/x.css", "https://site.test:9200/", "file:///etc/passwd"]) {
      const f = fakeFetch({ "https://site.test/a.css": { status: 302, headers: { location } } });
      expect(await safeFetch("https://site.test/a.css", opts(f.impl))).toMatchObject({ kind: "blocked" });
      expect(f.asked).toEqual(["https://site.test/a.css"]);
    }
  });

  it("gives up after the redirect limit", async () => {
    const f = fakeFetch({
      "https://site.test/0": { status: 302, headers: { location: "/1" } },
      "https://site.test/1": { status: 302, headers: { location: "/2" } },
      "https://site.test/2": { status: 302, headers: { location: "/3" } },
      "https://site.test/3": { status: 302, headers: { location: "/4" } },
      "https://site.test/4": { status: 200, body: "a{}" },
    });
    expect(await safeFetch("https://site.test/0", opts(f.impl))).toMatchObject({ kind: "http_error", status: 302 });
    expect(f.asked.length).toBe(4);
  });

  it("reports a non-2xx status", async () => {
    const f = fakeFetch({ "https://site.test/gone.css": { status: 404, body: "<html>nope</html>" } });
    expect(await safeFetch("https://site.test/gone.css", opts(f.impl))).toEqual({ kind: "http_error", status: 404, url: "https://site.test/gone.css" });
  });

  it("refuses an oversize body by its declared length", async () => {
    const f = fakeFetch({ "https://site.test/big.css": { status: 200, headers: { "content-length": "5000" }, body: "x".repeat(5000) } });
    expect(await safeFetch("https://site.test/big.css", opts(f.impl))).toMatchObject({ kind: "too_large" });
  });

  it("aborts a streamed body as soon as it passes the cap", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled > 100) return controller.close();
        controller.enqueue(new Uint8Array(400));
      },
    });
    const f = fakeFetch({ "https://site.test/endless.css": { status: 200, stream } });
    expect(await safeFetch("https://site.test/endless.css", opts(f.impl))).toMatchObject({ kind: "too_large" });
    expect(pulled).toBeLessThan(10);
  });

  it("times out a server that never answers", async () => {
    const hang = (async (_u: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const res = await safeFetch("https://site.test/slow.css", opts(hang, { timeoutMs: 50 }));
    expect(res).toMatchObject({ kind: "network_error", reason: "timed out" });
  });
});
