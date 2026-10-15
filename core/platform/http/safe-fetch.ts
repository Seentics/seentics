import { pinnedFetch } from "./pinned-fetch";
import { assertPublicHost, type Lookup } from "./public-host";

/**
 * GET a URL that came from untrusted input, without letting it reach anything internal.
 *
 * What a URL from a public endpoint must not be able to do through a server-side fetch:
 *
 * - reach a private, loopback, link-local, CGNAT, multicast or reserved address, in any
 *   spelling (`assertPublicHost` resolves the name and judges every answer);
 * - get there by redirect — redirects are followed by hand, at most `maxRedirects`, and
 *   every hop is checked exactly like the first;
 * - reach a service on an unusual port — only the scheme's default port is allowed;
 * - carry credentials (`user:pass@`) or use any scheme but http and https;
 * - hold a worker, or its memory: one deadline covers the whole exchange including
 *   redirects, and the body is streamed and abandoned the moment it passes `maxBytes`.
 *
 * Not covered: a name whose DNS answer changes between the check and the connection
 * (rebinding). The window is one lookup wide; closing it means connecting to the checked
 * address directly, which `fetch` cannot do while keeping TLS name checks.
 */

export type SafeFetchOptions = {
  /** Largest body accepted, in bytes. A bigger one is `too_large`, never buffered. */
  maxBytes: number;
  /** Deadline for the whole exchange, redirects included. */
  timeoutMs: number;
  /** Redirect hops followed before giving up. */
  maxRedirects: number;
  /** Sent on every request, so a site owner can tell who is fetching. */
  userAgent: string;
  accept?: string;
  /** DNS, for tests. */
  lookup?: Lookup;
  /** `fetch`, for tests. */
  fetchImpl?: typeof fetch;
};

export type SafeFetchResult =
  | { kind: "ok"; status: number; url: string; contentType: string; body: Uint8Array }
  /** A final non-2xx answer (a redirect past the limit included). */
  | { kind: "http_error"; status: number; url: string }
  | { kind: "too_large"; url: string }
  /** Refused before connecting: scheme, port, credentials or a non-public address. */
  | { kind: "blocked"; reason: string; url: string }
  /** DNS failure aside, anything that stopped the exchange: refused, reset, timed out. */
  | { kind: "network_error"; reason: string; url: string };

/** Why a URL may not be fetched at all, or `null` when its shape is acceptable. */
export function unsafeUrlReason(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "invalid url";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "scheme not allowed";
  if (u.username || u.password) return "credentials in url";
  // `URL` drops an explicit default port (`:443` on https), so anything left is non-default.
  if (u.port !== "") return "non-default port";
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return "internal host";
  }
  return null;
}

export async function safeFetch(url: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  // Each hop connected to the address it was checked against (pinned-fetch.ts).
  const fetchImpl = opts.fetchImpl ?? (((u: string | URL, i?: RequestInit) => pinnedFetch(u as string, i)) as typeof fetch);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  let current = url;

  try {
    for (let hop = 0; ; hop++) {
      const shape = unsafeUrlReason(current);
      if (shape) return { kind: "blocked", reason: shape, url: current };
      try {
        await assertPublicHost(new URL(current).hostname, opts.lookup);
      } catch {
        return { kind: "blocked", reason: "non-public address", url: current };
      }

      let res: Response;
      try {
        res = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": opts.userAgent,
            Accept: opts.accept ?? "*/*",
          },
        });
      } catch (err) {
        return { kind: "network_error", reason: controller.signal.aborted ? "timed out" : errorText(err), url: current };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await discard(res);
        if (!location) return { kind: "http_error", status: res.status, url: current };
        if (hop >= opts.maxRedirects) return { kind: "http_error", status: res.status, url: current };
        try {
          current = new URL(location, current).toString();
        } catch {
          return { kind: "blocked", reason: "invalid redirect", url: current };
        }
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        await discard(res);
        return { kind: "http_error", status: res.status, url: current };
      }

      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > opts.maxBytes) {
        await discard(res);
        return { kind: "too_large", url: current };
      }

      const body = await readCapped(res, opts.maxBytes, controller);
      if (body === "too_large") return { kind: "too_large", url: current };
      if (body === "aborted") return { kind: "network_error", reason: "timed out", url: current };
      return {
        kind: "ok",
        status: res.status,
        url: current,
        contentType: (res.headers.get("content-type") ?? "").toLowerCase(),
        body,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

/** The body, or a reason it was abandoned. Stops reading — and cancels — past the cap. */
async function readCapped(
  res: Response,
  maxBytes: number,
  controller: AbortController,
): Promise<Uint8Array | "too_large" | "aborted"> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        controller.abort();
        return "too_large";
      }
      parts.push(value);
    }
  } catch {
    // A deadline abort or a dropped connection mid-body: either way, nothing usable.
    return "aborted";
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* already closed */
  }
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200);
}
