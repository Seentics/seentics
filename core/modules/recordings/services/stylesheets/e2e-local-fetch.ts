import { safeFetch, type SafeFetchOptions, type SafeFetchResult } from "../../../../platform/http/safe-fetch";

/**
 * End-to-end tests only (e2e/ in the enterprise repository): lets the stylesheet archive fetch
 * the test's customer website, which runs on the test machine at `http://localhost:<port>`.
 *
 * The archive normally refuses localhost, private addresses and non-default ports (safe-fetch),
 * which is exactly where that website lives. Like the uptime checker's ALLOW_PRIVATE_TARGETS, the
 * switch exists only for the disposable e2e stack: it needs both `ENVIRONMENT=e2e` and
 * `STYLESHEET_ARCHIVE_E2E_LOCAL_HOST` (the name the test machine has inside the container,
 * `host.docker.internal`). Production sets neither, and anything else is still fetched through
 * the guard. Only `localhost` URLs are rewritten; the row keeps the URL the recording linked.
 */
export function e2eLocalStylesheetFetcher(
  opts: SafeFetchOptions,
  env: NodeJS.ProcessEnv = process.env,
): ((url: string) => Promise<SafeFetchResult>) | null {
  const host = (env.STYLESHEET_ARCHIVE_E2E_LOCAL_HOST ?? "").trim();
  if ((env.ENVIRONMENT ?? "").trim().toLowerCase() !== "e2e" || !host) return null;
  return async (url) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return safeFetch(url, opts);
    }
    if (target.protocol !== "http:" || target.hostname !== "localhost") return safeFetch(url, opts);
    target.hostname = host;
    try {
      const res = await fetch(target, {
        redirect: "error",
        signal: AbortSignal.timeout(opts.timeoutMs),
        headers: { "User-Agent": opts.userAgent, Accept: opts.accept ?? "*/*" },
      });
      if (res.status < 200 || res.status >= 300) return { kind: "http_error", status: res.status, url };
      const body = new Uint8Array(await res.arrayBuffer());
      if (body.byteLength > opts.maxBytes) return { kind: "too_large", url };
      return { kind: "ok", status: res.status, url, contentType: (res.headers.get("content-type") ?? "").toLowerCase(), body };
    } catch (err) {
      return { kind: "network_error", reason: err instanceof Error ? err.message : String(err), url };
    }
  };
}
