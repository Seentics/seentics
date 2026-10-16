import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { isBlockedIp, NonPublicHostError } from "./public-host";

/**
 * `fetch` to a customer-supplied URL, connected to an address that was checked.
 *
 * Checking a hostname and then calling `fetch(url)` resolves the name twice: once for the
 * check, once for the connection. A name whose owner answers the first lookup with a public
 * address and the second with 127.0.0.1 or the cloud metadata address (DNS rebinding) gets the
 * request inside. Here the name is resolved once, every answer is judged, and the connection is
 * made to one of those same addresses; TLS still verifies the certificate against the hostname.
 *
 * Like `redirect: "manual"`, redirects are returned, never followed. The response body is read up
 * to `maxBytes` and the connection dropped past it.
 */
export type PinnedFetchOptions = {
  /** Resolve a hostname; replaceable in tests. */
  lookup?: (host: string) => Promise<string[]>;
  /** Judge an address; replaceable in tests (which serve from 127.0.0.1). */
  isBlocked?: (ip: string) => boolean;
  /** Largest body read (default 5 MB). */
  maxBytes?: number;
};

const defaultLookup = async (host: string) =>
  (await dns.promises.lookup(host, { all: true, verbatim: true })).map((r) => r.address);

const NULL_BODY = new Set([101, 103, 204, 205, 304]);

export async function pinnedFetch(
  input: string | URL,
  init: RequestInit = {},
  opts: PinnedFetchOptions = {},
): Promise<Response> {
  const url = new URL(String(input));
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TypeError(`unsupported protocol: ${url.protocol}`);
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const blockedIp = opts.isBlocked ?? isBlockedIp;

  let addresses: string[];
  if (net.isIP(host)) addresses = [host];
  else {
    try {
      addresses = await (opts.lookup ?? defaultLookup)(host);
    } catch {
      throw new NonPublicHostError(host);
    }
  }
  // Every answer must be public: a name with one public and one private address could be
  // connected to either.
  if (addresses.length === 0 || addresses.some(blockedIp)) throw new NonPublicHostError(host);
  const ip = addresses[0]!;
  const family = net.isIP(ip);

  const headers: Record<string, string> = {};
  new Headers(init.headers ?? {}).forEach((value, key) => { headers[key] = value; });
  // The request goes to the checked address, so the name has to travel separately: in Host
  // for the server, and as SNI (`servername`) for TLS, which also checks the certificate
  // against it. Bun's https ignores `lookup` and verified the certificate against the bare
  // IP instead — every HTTPS destination failed with ERR_TLS_CERT_ALTNAME_INVALID.
  if (headers.host === undefined) headers.host = url.host;
  const body = init.body == null ? undefined
    : typeof init.body === "string" || init.body instanceof Uint8Array ? init.body
    : init.body instanceof ArrayBuffer ? new Uint8Array(init.body)
    : String(init.body);
  if (body !== undefined && headers["content-length"] === undefined) {
    headers["content-length"] = String(typeof body === "string" ? Buffer.byteLength(body) : body.byteLength);
  }
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const signal = init.signal ?? undefined;
  if (signal?.aborted) throw signal.reason;

  return new Promise<Response>((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      {
        protocol: url.protocol,
        hostname: ip,
        servername: net.isIP(host) ? undefined : host,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: (init.method ?? "GET").toUpperCase(),
        headers,
        // The one connection this request makes goes to the address judged above.
        lookup: ((_h: string, o: { all?: boolean }, cb: (...args: unknown[]) => void) =>
          o?.all ? cb(null, [{ address: ip, family }]) : cb(null, ip, family)) as unknown as net.LookupFunction,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const done = () => {
          const status = res.statusCode ?? 502;
          const out = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) out.set(k, Array.isArray(v) ? v.join(", ") : String(v));
          }
          resolve(new Response(NULL_BODY.has(status) ? null : Buffer.concat(chunks), { status, headers: out }));
        };
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    // Settled here, not through the request's error: a connection still being made does not
    // report one when destroyed.
    const abort = () => {
      const reason = signal?.reason instanceof Error ? signal.reason : new Error("aborted");
      req.destroy();
      reject(reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    req.on("error", (err) => { signal?.removeEventListener("abort", abort); reject(signal?.aborted ? signal.reason : err); });
    req.on("close", () => signal?.removeEventListener("abort", abort));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
