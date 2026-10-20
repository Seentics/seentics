/**
 * The dashboard's filters — country, device, browser, OS, UTM tags, page, event property —
 * as a SQL predicate over `analytics_events`.
 *
 * The dashboard has always sent them and the API used to drop them in `parseAnalyticsQuery`,
 * so a filtered dashboard showed unfiltered numbers under an "Active filters" row.
 *
 * Every value is a bound parameter; the only text spliced in is this file's own column
 * expressions. A property key is a parameter too (`properties->>$n`), and is still held to a
 * plain identifier shape so a filter cannot address something no tracker would send.
 *
 * What each filter matches:
 * - `country`: the stored ISO code (`US`), case-insensitively.
 * - `device`, `os`: the value as the dashboard lists it — OS without its version — any case.
 * - `browser`: the name without its version, any case; also as a prefix, so "Samsung" is
 *   "Samsung Internet".
 * - `utm_*`: the pageview's own tag, any case.
 * - `page_path`: the page's path (lib/dimension-sql.ts) — `/pricing` matches every
 *   `/pricing?…` URL.
 * - `prop_key` (+ `prop_value`): sessions in the window with an event carrying that property
 *   (with that value). Properties live on events, not pageviews, so this is the one filter
 *   that selects sessions rather than rows.
 *
 * Filters are row filters on pageviews. Session figures (duration, bounce rate, entry and
 * exit pages) are of the sessions with at least one matching pageview, measured whole.
 *
 * The rollups cannot answer a filtered read — each holds one dimension at a time — so a
 * filtered read is computed from raw events. With TimescaleDB those are kept RAW_EVENT_DAYS
 * (lib/raw-window.ts), so a filtered range beyond that only covers what is still stored.
 *
 * Parsing lives here, free of the database, so the HTTP layer can use it; the predicate is
 * in lib/filter-sql.ts.
 */

export type AnalyticsFilters = {
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page_path?: string;
  prop_key?: string;
  prop_value?: string;
};

/** Query parameters that are filters, in the order the predicate applies them. */
export const FILTER_KEYS = [
  "country",
  "device",
  "browser",
  "os",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "page_path",
  "prop_key",
  "prop_value",
] as const satisfies readonly (keyof AnalyticsFilters)[];

const MAX_VALUE_LEN = 256;
/** A property name a tracker would send: letters, digits and `_ . - : $`, at most 64 long. */
export const PROP_KEY_RE = /^[A-Za-z0-9_$][A-Za-z0-9_.:$-]{0,63}$/;

/**
 * The filters in a query, cleaned. A blank, over-long or malformed value is dropped rather
 * than rejected — the same leniency as every other analytics parameter. `prop_value` means
 * nothing without a valid `prop_key` and is dropped with it.
 */
export function parseFilters(query: Record<string, string | undefined>): AnalyticsFilters {
  const out: AnalyticsFilters = {};
  for (const key of FILTER_KEYS) {
    const v = query[key]?.trim();
    if (!v || v.length > MAX_VALUE_LEN) continue;
    out[key] = v;
  }
  if (out.country !== undefined) {
    if (/^[A-Za-z]{2}$/.test(out.country)) out.country = out.country.toUpperCase();
    else delete out.country;
  }
  if (out.page_path !== undefined && !out.page_path.startsWith("/")) out.page_path = `/${out.page_path}`;
  if (out.prop_key !== undefined && !PROP_KEY_RE.test(out.prop_key)) delete out.prop_key;
  if (out.prop_key === undefined) delete out.prop_value;
  return out;
}

export function hasFilters(f: AnalyticsFilters): boolean {
  return Object.values(f).some((v) => v !== undefined);
}
