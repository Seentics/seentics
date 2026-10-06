/**
 * Pure reshaping of analytics payloads into what the charts expect.
 *
 * These were seven `useMemo` blocks inside the overview page, each carrying its own
 * `isDemoMode ? demo : live` branch. As plain functions of their input they lose that
 * branch entirely — the caller decides which payload to pass — which is what lets a
 * chart be fed live data, a fixture, or a recording's frame from the same code.
 *
 * `any` on the input is deliberate and inherited: these endpoints return loosely typed
 * payloads today, and inventing precise input types here would document a contract the
 * API does not actually keep. The *output* shapes are what the charts rely on.
 */

/**
 * Friendly name for a referring domain, matched on whole domain labels.
 *
 * The API sends a domain (`google.com`, `t.co`, `news.ycombinator.com`) or `direct`.
 * Matching used to be substring-based, which mislabelled real sites — anything
 * containing "medium" became Medium, anything containing "google" became Google — and
 * never matched Hacker News (the domain is news.ycombinator.com) or X (x.com, t.co).
 * Older payloads carrying a full URL are reduced to their domain first.
 */
const REFERRER_NAMES: Array<[RegExp, string]> = [
  [/^accounts\.google\./, 'Google OAuth'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'Facebook'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'X (Twitter)'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)medium\.com$/, 'Medium'],
  [/(^|\.)stackoverflow\.com$/, 'Stack Overflow'],
  [/(^|\.)dev\.to$/, 'Dev.to'],
  [/(^|\.)hashnode\.(com|dev)$/, 'Hashnode'],
  [/(^|\.)producthunt\.com$/, 'Product Hunt'],
  [/^news\.ycombinator\.com$/, 'Hacker News'],
];

export function categorizeReferrer(referrer: string): string {
  const raw = (referrer ?? '').trim();
  if (!raw || raw.toLowerCase() === 'direct') return 'Direct';
  const domain = raw.toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '');
  // Same-origin / dev: self-referrals, not acquisition.
  if (
    domain === 'localhost' ||
    domain === '127.0.0.1' ||
    domain === '[::1]' ||
    domain === '0.0.0.0' ||
    /^(192\.168|10)\./.test(domain) ||
    domain.endsWith('.local')
  ) {
    return 'Internal Navigation';
  }
  for (const [pattern, name] of REFERRER_NAMES) if (pattern.test(domain)) return name;
  return domain || raw;
}

export function selectTopPages(src: any) {
    return {
      top_pages: src?.top_pages?.map((page: any) => ({
        page: page.page || '/',
        views: page.views || 0,
        unique_visitors: page.unique || 0,
        avg_time_on_page: page.avg_time || 0,
        bounce_rate: page.bounce_rate || 0,
      })) ?? [],
    };
}

export function selectTopReferrers(src: any) {
    const merged = new Map<string, { visitors: number; page_views: number }>();
    for (const ref of src?.top_referrers ?? []) {
      const label = categorizeReferrer(ref.referrer ?? 'Direct');
      const cur = merged.get(label) ?? { visitors: 0, page_views: 0 };
      cur.visitors += ref.unique ?? 0;
      cur.page_views += ref.views ?? 0;
      merged.set(label, cur);
    }
    return {
      top_referrers: [...merged.entries()]
        .map(([referrer, v]) => ({
          referrer,
          visitors: v.visitors,
          page_views: v.page_views,
          avg_session_duration: 0,
        }))
        .sort((a, b) => b.visitors - a.visitors),
    };
}

export function selectTopCountries(src: any) {
    return {
      top_countries: src?.top_countries?.map((country: any) => ({
        country: country.country || 'Unknown',
        visitors: country.unique || 0,
        page_views: country.views || 0,
        avg_session_duration: 0,
      })) ?? [],
    };
}

export function selectTopBrowsers(src: any) {
    return {
      top_browsers: src?.top_browsers?.map((browser: any) => ({
        browser: browser.browser || 'Unknown',
        visitors: browser.unique || 0,
        views: browser.views || 0,
        market_share: 0,
        version: 'Unknown',
      })) ?? [],
    };
}

export function selectTopDevices(src: any) {
    return {
      top_devices: src?.top_devices?.map((device: any) => ({
        device: device.device || 'Unknown',
        visitors: device.unique || 0,
        page_views: device.views || 0,
        avg_session_duration: 0,
      })) ?? [],
    };
}

export function selectTopOS(src: any) {
    return {
      top_os: src?.top_os?.map((os: any) => ({
        os: os.os || 'Unknown',
        visitors: os.unique || 0,
        page_views: os.views || 0,
        avg_session_duration: 0,
      })) ?? [],
    };
}

export function selectCustomEvents(src: any, pageViews: number = 0) {
    const emptyUtm = {
      sources: [] as { source: string; unique_visitors: number; visits: number }[],
      mediums: [] as { medium: string; unique_visitors: number; visits: number }[],
      campaigns: [] as { campaign: string; unique_visitors: number; visits: number }[],
      terms: [] as { term: string; unique_visitors: number; visits: number }[],
      content: [] as { content: string; unique_visitors: number; visits: number }[],
      avg_ctr: 0,
      total_campaigns: 0,
      total_sources: 0,
      total_mediums: 0,
    };

    // Filter out internal tracker events — these are already reflected in other dashboard sections
    const internalEvents = new Set(['pageview', 'page_view', 'page_exit', 'scroll_depth', 'click']);
    const filteredEvents = (src?.top_events ?? []).filter(
      (event: any) => !internalEvents.has(event.event_type)
    );

    return {
      timeseries: src?.timeseries ?? [],
      top_events: filteredEvents,
      // Include page_views in total so summary cards reflect full traffic
      total_events: filteredEvents.reduce((sum: number, e: any) => sum + e.count, 0) + pageViews,
      unique_events: filteredEvents.length,
      utm_performance: src?.utm_performance ?? emptyUtm,
    };
}
