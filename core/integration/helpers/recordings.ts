/**
 * Tracker-side helpers for the recordings, heatmaps and errors integration files.
 *
 * Data reaches those modules the production way: POST /api/v1/tracker/collect, then a
 * drain of the ingest buffer and the durable queue (what a graceful shutdown does).
 * Other test processes share the queue table and may apply a batch first, so callers
 * wait for the effect with `eventually` rather than assuming their own drain did it.
 */
import { randomUUID } from "node:crypto";
import { api, application, type SeededWebsite } from "../harness";

export const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/**
 * Send one tracker batch for a site, from a browser on its own domain. With consent, since
 * a cookieless site without it keeps no recordings or snapshots (anonymous-batch.ts).
 */
export async function collect(
  site: SeededWebsite,
  body: Record<string, unknown>,
  opts: { ua?: string } = {},
) {
  return api("POST", "/api/v1/tracker/collect", {
    body: { website_id: site.trackingId, consent: true, ...body },
    headers: { Origin: `https://${site.domain}`, "User-Agent": opts.ua ?? DESKTOP_UA },
  });
}

/** Move everything buffered onto the queue and apply the queue once. */
export async function flushIngest(): Promise<void> {
  await application().modules.ingest.stop!();
}

/** Flush and re-check until `check` passes (another process may hold our batch's lease). */
export async function eventually<T>(check: () => Promise<T | null | undefined | false>, timeoutMs = 8000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await flushIngest();
    const v = await check();
    if (v) return v;
    if (Date.now() > deadline) throw new Error("condition not met after ingest flush");
    await new Promise((r) => setTimeout(r, 100));
  }
}

export const sid = () => `s${randomUUID().replace(/-/g, "").slice(0, 20)}`;
export const vid = () => `v${randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** A minimal rrweb recording: meta, full snapshot, and `clicks` mouse clicks at (x, y). */
export function rrwebSession(
  sessionId: string,
  url: string,
  opts: { start?: number; clicks?: { x: number; y: number; dt: number }[] } = {},
) {
  const t0 = opts.start ?? Date.now() - 60_000;
  const ev = (dt: number, data: Record<string, unknown>) => ({ type: "rrweb", ts: t0 + dt, url, sid: sessionId, vid: "v1", data: { ...data, timestamp: t0 + dt } });
  return [
    ev(0, { type: 4, data: { href: url, width: 1280, height: 800 } }),
    ev(10, { type: 2, data: { node: { type: 0, childNodes: [], id: 1 }, initialOffset: { top: 0, left: 0 } } }),
    ...(opts.clicks ?? []).map((c) => ev(c.dt, { type: 3, data: { source: 2, type: 2, id: 1, x: c.x, y: c.y } })),
  ];
}
