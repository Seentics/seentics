import type { AnalyticsQueryParams } from "../interfaces";
import { FILTER_KEYS } from "./analytics-filters";

/**
 * The query-string contract of every analytics read; shared by the dashboard routes and the embed API.
 *
 * Only these keys reach a read, and so only these key the read cache: the range (`days`, or
 * `from`/`to` — lib/analytics-window.ts), the timezone, a limit, and the filters
 * (lib/analytics-filters.ts).
 */
export function parseAnalyticsQuery(get: (name: string) => string | undefined): AnalyticsQueryParams {
  const out: AnalyticsQueryParams = {
    days: get("days"),
    from: get("from"),
    to: get("to"),
    timezone: get("timezone"),
    limit: get("limit"),
    ...(get("live") === "0" ? { live: "0" } : {}),
  };
  for (const key of FILTER_KEYS) {
    const v = get(key);
    if (v) out[key] = v;
  }
  return out;
}
