import type { CourierRecord } from "../interfaces";

/**
 * Steadfast (packzy) courier: a phone number's delivery record across the courier network, with
 * the seller's own merchant API key and secret.
 *
 * UNVERIFIED ENDPOINT. Steadfast's published API (portal.packzy.com/api/v1: create_order,
 * status_by_cid, get_balance, …) documents no fraud check; integrators reference
 * `GET /fraud_check/{phone}` with the same Api-Key / Secret-Key headers. Everything that depends on
 * the path and the response's shape is in this file, and the parser accepts the field names seen
 * in the wild (total_parcels / total_delivered / total_cancelled, or success / cancel). Confirm
 * with Steadfast before relying on it; a failure here never blocks or fails an order.
 */

export const STEADFAST_BASE = "https://portal.packzy.com/api/v1";
const TIMEOUT_MS = 4_000;

export type SteadfastKeys = { apiKey: string; secretKey: string };

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** The record in a response, whatever its spelling, or null when it carries none. */
export function parseFraudCheck(body: unknown, now: Date = new Date()): CourierRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const src = (o.data && typeof o.data === "object" ? o.data : o) as Record<string, unknown>;
  const delivered = num(src.total_delivered ?? src.delivered ?? src.success);
  const cancelled = num(src.total_cancelled ?? src.cancelled ?? src.cancel);
  let total = num(src.total_parcels ?? src.total ?? src.total_parcel);
  if (delivered === null && cancelled === null) return null;
  if (total === null) total = (delivered ?? 0) + (cancelled ?? 0);
  const d = delivered ?? Math.max(0, total - (cancelled ?? 0));
  const c = cancelled ?? Math.max(0, total - d);
  return { total, delivered: d, cancelled: c, successRate: total > 0 ? (d / total) * 100 : null, checkedAt: now.toISOString() };
}

/** The courier's record for one 01XXXXXXXXX number; null when Steadfast does not answer usefully. */
export async function steadfastFraudCheck(keys: SteadfastKeys, phone: string, send: typeof fetch = fetch): Promise<CourierRecord | null> {
  try {
    const res = await send(`${STEADFAST_BASE}/fraud_check/${encodeURIComponent(phone)}`, {
      headers: { "Api-Key": keys.apiKey, "Secret-Key": keys.secretKey, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parseFraudCheck(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/** Whether the keys open the account: the balance endpoint, which is documented. */
export async function steadfastKeysWork(keys: SteadfastKeys, send: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await send(`${STEADFAST_BASE}/get_balance`, {
      headers: { "Api-Key": keys.apiKey, "Secret-Key": keys.secretKey, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
