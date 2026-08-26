/**
 * The analytics module's public surface, split by capability.
 *
 * Twenty-nine query surfaces behind one `IAnalyticsModule` would force every
 * consumer to depend on all of it and make any of it impossible to substitute.
 * Grouped this way, the automations module can take `AnalyticsRealtime` alone,
 * and a test can stub that one interface with three methods instead of thirty.
 *
 * Read models are returned in wire shape (snake_case) because these endpoints are
 * consumed directly by the dashboard and the field names are part of the public
 * contract. They are typed as `Record<string, unknown>`-free concrete shapes only
 * where a peer module actually reads them; the rest stay opaque to keep this file
 * from becoming a duplicate of every SQL projection.
 */

/** Query parameters common to the windowed analytics endpoints. */
export type AnalyticsWindow = {
  /** Trailing window in days. Clamped to 1–365; defaults per endpoint. */
  days?: string;
  /** IANA timezone for day bucketing. Invalid values fall back to UTC. */
  timezone?: string;
  limit?: string;
};

/** Raw query bag as it arrives from the HTTP layer. */
export type AnalyticsQueryParams = Record<string, string | undefined>;

/**
 * Headline figures and time series for one site.
 *
 * The dashboard's primary read path — cache-sensitive and the most-hit surface
 * in the product.
 */
export interface AnalyticsDashboard {
  getDashboard(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getTrafficSummary(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getDailyStats(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getHourlyStats(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/**
 * Breakdowns by a single attribute — pages, sources, geography, device.
 *
 * `getDimensionsBulk` answers several of these in one round trip; prefer it when
 * rendering a dashboard that needs more than two breakdowns at once.
 */
export interface AnalyticsDimensions {
  getPages(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getReferrers(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getSources(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getBrowsers(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getDevices(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getOperatingSystems(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getCountries(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getCities(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getLanguages(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getResolutions(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getGeolocation(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getPageUtmBreakdown(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getDimensionsBulk(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/**
 * Live and near-live views.
 *
 * These read the most recent minutes of data, so they are the surfaces most
 * affected by ingest batching latency — a visitor appears here one flush after
 * their first event, not instantly.
 *
 * Unlike the windowed endpoints these take explicit, already-validated options
 * rather than a raw query bag: their windows are in minutes rather than days, and
 * the route validates `within_minutes` and `limit` with a schema before calling.
 */
export interface AnalyticsRealtime {
  /** Fixed 30-minute window; takes no options. */
  getRealtime(websiteRef: string): Promise<unknown>;

  /** Fixed windows — 30s live, 30min active. Takes no options. */
  getLiveVisitors(websiteRef: string): Promise<unknown>;

  getRealtimeGeo(
    websiteRef: string,
    opts?: { withinMinutes?: number },
  ): Promise<unknown>;

  getRecentActivity(
    websiteRef: string,
    limit: number,
    opts?: { withinMinutes?: number },
  ): Promise<unknown>;

  /** Day-windowed, unlike its siblings here. */
  getActivityTrends(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/** Journey and per-visitor analysis. */
export interface AnalyticsBehaviour {
  getPathAnalysis(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getVisitorInsights(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
  getCustomEvents(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/** Goal conversion reporting. */
export interface AnalyticsGoals {
  getGoals(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/** Revenue and monetisation reporting. */
export interface AnalyticsRevenue {
  getRevenueDashboard(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/** Bulk data extraction. */
export interface AnalyticsExport {
  exportEvents(siteId: string, query: AnalyticsQueryParams): Promise<unknown>;
}

/**
 * The unauthenticated public dashboard.
 *
 * Keyed by `publicShareId` rather than a site id, and resolves that itself —
 * the caller is anonymous and has no website reference to offer. `null` when the
 * share link is unknown or has been revoked.
 */
export interface AnalyticsPublicDashboard {
  getPublicDashboard(publicShareId: string, query: AnalyticsQueryParams): Promise<unknown | null>;
}
