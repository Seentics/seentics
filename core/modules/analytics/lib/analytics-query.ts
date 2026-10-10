import type { AnalyticsQueryParams } from "../interfaces";

/** The query-string contract of every analytics read; shared by the dashboard routes and the embed API. */
export function parseAnalyticsQuery(get: (name: string) => string | undefined): AnalyticsQueryParams {
  return {
    days: get("days"),
    timezone: get("timezone"),
    limit: get("limit"),
    ...(get("live") === "0" ? { live: "0" } : {}),
  };
}
