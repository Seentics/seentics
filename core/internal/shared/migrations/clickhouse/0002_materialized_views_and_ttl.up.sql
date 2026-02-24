-- Add TTL to auto-expire events older than 2 years
ALTER TABLE events MODIFY TTL toDateTime(timestamp) + INTERVAL 2 YEAR;

-- Daily aggregated stats (auto-populated on insert via materialized view)
CREATE TABLE IF NOT EXISTS daily_stats (
    website_id String,
    day Date,
    page_views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniq, String),
    sessions AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_stats
TO daily_stats
AS SELECT
    website_id,
    toDate(timestamp) AS day,
    count() AS page_views,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS sessions
FROM events
WHERE event_type = 'pageview'
GROUP BY website_id, day;

-- Hourly aggregated stats for live/recent dashboard
CREATE TABLE IF NOT EXISTS hourly_stats (
    website_id String,
    hour DateTime,
    page_views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniq, String),
    sessions AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (website_id, hour)
TTL hour + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_stats
TO hourly_stats
AS SELECT
    website_id,
    toStartOfHour(timestamp) AS hour,
    count() AS page_views,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS sessions
FROM events
WHERE event_type = 'pageview'
GROUP BY website_id, hour;

-- Top pages daily aggregation
CREATE TABLE IF NOT EXISTS daily_page_stats (
    website_id String,
    day Date,
    page String,
    page_views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day, page);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_page_stats
TO daily_page_stats
AS SELECT
    website_id,
    toDate(timestamp) AS day,
    page,
    count() AS page_views,
    uniqState(visitor_id) AS unique_visitors
FROM events
WHERE event_type = 'pageview'
GROUP BY website_id, day, page;

-- Top countries daily aggregation
CREATE TABLE IF NOT EXISTS daily_country_stats (
    website_id String,
    day Date,
    country String,
    country_code String,
    page_views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day, country);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_country_stats
TO daily_country_stats
AS SELECT
    website_id,
    toDate(timestamp) AS day,
    COALESCE(country, 'Unknown') AS country,
    COALESCE(country_code, '') AS country_code,
    count() AS page_views,
    uniqState(visitor_id) AS unique_visitors
FROM events
WHERE event_type = 'pageview'
GROUP BY website_id, day, country, country_code;

-- Top referrers daily aggregation
CREATE TABLE IF NOT EXISTS daily_referrer_stats (
    website_id String,
    day Date,
    referrer String,
    page_views SimpleAggregateFunction(sum, UInt64),
    unique_visitors AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day, referrer);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_referrer_stats
TO daily_referrer_stats
AS SELECT
    website_id,
    toDate(timestamp) AS day,
    COALESCE(referrer, 'direct') AS referrer,
    count() AS page_views,
    uniqState(visitor_id) AS unique_visitors
FROM events
WHERE event_type = 'pageview'
GROUP BY website_id, day, referrer;
