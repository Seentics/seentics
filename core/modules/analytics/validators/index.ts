/**
 * Request validation for the analytics HTTP surface.
 *
 * Only the realtime endpoints need schemas — the windowed ones take the shared
 * `days` / `timezone` / `limit` bag, which the repositories clamp themselves
 * (`parseDays`, `sanitizeTimezone`) because a bad value there should render the
 * default range rather than reject the request.
 */
export {
  analyticsRealtimeGeoQuerySchema,
  analyticsRecentActivityQuerySchema,
} from "./analytics.schema";
