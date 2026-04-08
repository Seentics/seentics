-- ClickHouse reference / manual bootstrap schema (core also creates schema from Go where needed).
-- Merged baseline: events + aggregations + materialized views.

CREATE TABLE IF NOT EXISTS events (
    id             UUID,
    website_id     String,
    visitor_id     String,
    session_id     String,
    event_type     LowCardinality(String),
    page           String,
    referrer       Nullable(String),
    user_agent     Nullable(String),
    ip_address     Nullable(String),
    country        Nullable(String),
    country_code   LowCardinality(Nullable(String)),
    city           Nullable(String),
    region         Nullable(String),
    continent      LowCardinality(Nullable(String)),
    latitude       Float64 DEFAULT 0,
    longitude      Float64 DEFAULT 0,
    browser        LowCardinality(Nullable(String)),
    device         LowCardinality(Nullable(String)),
    os             LowCardinality(Nullable(String)),
    utm_source     LowCardinality(Nullable(String)),
    utm_medium     LowCardinality(Nullable(String)),
    utm_campaign   Nullable(String),
    utm_term       Nullable(String),
    utm_content    Nullable(String),
    time_on_page   Int64,
    language       LowCardinality(Nullable(String)),
    properties     String,
    timestamp      DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
    created_at     DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (website_id, timestamp, event_type)
TTL toDate(timestamp) + INTERVAL 2 YEAR;

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
