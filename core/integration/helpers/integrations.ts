/**
 * Outbound HTTP for the integrations tests, without the internet.
 *
 * Integrations reach the network only through `pinnedFetch` (the request) and `assertPublicHost`
 * (the SSRF check of a user-supplied URL). Both are replaced here with versions that resolve
 * names from `dns` below and answer from `receiver`, while keeping the real verdict on which
 * addresses are private — so the SSRF guard is still the production one.
 *
 * Import this before anything that loads the app (the harness included).
 */
import { mock } from "bun:test";
import * as publicHost from "../../platform/http/public-host";

// Captured before mocking: the mocked namespace would otherwise point back at the wrappers.
const realIsBlockedIp = publicHost.isBlockedIp;
const realAssertPublicHost = publicHost.assertPublicHost;
const NonPublicHostError = publicHost.NonPublicHostError;

/** Fake DNS. A test may repoint a name (e.g. at 127.0.0.1) to simulate rebinding. */
export const dns = new Map<string, string[]>();
export const PUBLIC_HOST = "hooks.receiver.example";
export const PRIVATE_HOST = "internal.receiver.example";
dns.set(PUBLIC_HOST, ["93.184.216.34"]);
dns.set(PRIVATE_HOST, ["10.0.0.5"]);

const lookup = async (host: string) => {
  const found = dns.get(host);
  if (!found) throw new Error(`ENOTFOUND ${host}`);
  return found;
};

export type Received = { url: string; method: string; headers: Record<string, string>; body: string };
type Reply = { status: number; body?: string };

/** Every request that got past the guard, and the reply each URL path gets (default 200). */
export const receiver = {
  requests: [] as Received[],
  replies: new Map<string, Reply>(),
  /** Requests whose URL contains `marker` — tests use a unique path per test. */
  to(marker: string): Received[] {
    return this.requests.filter((r) => r.url.includes(marker));
  },
};

mock.module("../../platform/http/public-host", () => ({
  ...publicHost,
  isBlockedIp: realIsBlockedIp,
  NonPublicHostError,
  assertPublicHost: (hostname: string) => realAssertPublicHost(hostname, lookup),
}));

mock.module("../../platform/http/pinned-fetch", () => ({
  pinnedFetch: async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const addresses = await lookup(url.hostname).catch(() => {
      throw new NonPublicHostError(url.hostname);
    });
    if (addresses.some(realIsBlockedIp)) throw new NonPublicHostError(url.hostname);
    const headers: Record<string, string> = {};
    new Headers(init.headers ?? {}).forEach((v, k) => { headers[k] = v; });
    receiver.requests.push({ url: url.toString(), method: init.method ?? "GET", headers, body: String(init.body ?? "") });
    const reply = [...receiver.replies].find(([marker]) => url.toString().includes(marker))?.[1] ?? { status: 200, body: "ok" };
    return new Response(reply.body ?? "", { status: reply.status });
  },
}));

/** A unique Zapier-style webhook URL on the public fake host; its path is the test's marker. */
export function hookUrl(host = PUBLIC_HOST): { url: string; marker: string } {
  const marker = `catch-${crypto.randomUUID().slice(0, 12)}`;
  return { url: `https://${host}/hooks/${marker}`, marker };
}
