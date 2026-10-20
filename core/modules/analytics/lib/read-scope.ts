import type { AnalyticsQueryParams } from "../interfaces";
import { sanitizeTimezone } from "../repositories/shared";
import { rollupsEnabled } from "../rollups/reads";
import { hasFilters, parseFilters, type AnalyticsFilters } from "./analytics-filters";
import { resolveSpan, type AnalyticsSpan } from "./analytics-window";

/** What a windowed read needs from its query: where, when, which rows, and where to read them from. */
export type ReadScope = {
  span: AnalyticsSpan;
  tz: string;
  filters: AnalyticsFilters;
  filtered: boolean;
  /** Rollups when they exist and can answer: they hold one dimension at a time, so not when filtered. */
  useRollups: boolean;
};

export function readScope(query: AnalyticsQueryParams | undefined, defaultDays = 7): ReadScope {
  const q = query ?? {};
  const tz = sanitizeTimezone(q.timezone);
  const filters = parseFilters(q);
  const filtered = hasFilters(filters);
  return { span: resolveSpan(q, tz, defaultDays), tz, filters, filtered, useRollups: rollupsEnabled() && !filtered };
}
