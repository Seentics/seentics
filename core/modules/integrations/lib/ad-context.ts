import type { AdContext, ClickIds } from "../interfaces/conversions";

const CLICK_PARAMS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "li_fat_id", "msclkid"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The longest window an ad platform credits a click for; older ids are dropped. */
const CLICK_WINDOW_MS = 90 * DAY_MS;

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);

/**
 * The tracker's `ad` context, shape-checked: it comes from the browser, so anything not in
 * the expected form is dropped rather than forwarded to an ad platform.
 */
export function adContextOf(raw: unknown, now: number = Date.now()): AdContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const ad: AdContext = {};
  if (r.clk && typeof r.clk === "object" && !Array.isArray(r.clk)) {
    const clk: ClickIds = {};
    for (const name of CLICK_PARAMS) {
      const c = (r.clk as Record<string, unknown>)[name] as { v?: unknown; ts?: unknown } | undefined;
      const v = str(c?.v, 500);
      const ts = typeof c?.ts === "number" && Number.isFinite(c.ts) ? Math.trunc(c.ts) : NaN;
      if (v && ts > now - CLICK_WINDOW_MS && ts <= now + DAY_MS) clk[name] = { v, ts };
    }
    if (Object.keys(clk).length) ad.clk = clk;
  }
  const fbp = str(r.fbp, 200);
  const fbc = str(r.fbc, 300);
  const ga = str(r.ga, 100);
  const ttp = str(r.ttp, 200);
  const li = str(r.li, 200);
  if (ttp) ad.ttp = ttp;
  if (li) ad.li = li;
  if (fbp) ad.fbp = fbp;
  if (fbc) ad.fbc = fbc;
  if (ga) ad.ga = ga;
  return Object.keys(ad).length ? ad : null;
}
