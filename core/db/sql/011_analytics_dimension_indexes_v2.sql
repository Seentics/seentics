-- Additional dimension indexes for analytics queries missing index coverage.
-- Covers city/country breakdown, page-path GROUP BY, and device/browser/OS filters.
-- All partial on event_type = 'pageview' to keep index size small.

-- City breakdown (geolocation.ts — no index existed for city column)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_city
  ON analytics_events (website_id, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND city IS NOT NULL
    AND length(trim(city)) > 0;

-- Country breakdown — include country value so GROUP BY can use index-only scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_country
  ON analytics_events (website_id, country, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND country IS NOT NULL
    AND length(trim(country)) > 0;

-- Page path GROUP BY (top pages, entry/exit pages) — include page value
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_page
  ON analytics_events (website_id, page, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND page IS NOT NULL
    AND length(trim(page)) > 0;

-- Device dimension GROUP BY
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_device
  ON analytics_events (website_id, device, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND device IS NOT NULL
    AND length(trim(device)) > 0;

-- Browser dimension GROUP BY
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_browser
  ON analytics_events (website_id, browser, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND browser IS NOT NULL
    AND length(trim(browser)) > 0;

-- OS dimension GROUP BY
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_os
  ON analytics_events (website_id, os, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND os IS NOT NULL
    AND length(trim(os)) > 0;
