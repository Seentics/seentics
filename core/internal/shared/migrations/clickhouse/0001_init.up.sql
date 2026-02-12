-- ClickHouse high-performance events schema
CREATE TABLE IF NOT EXISTS events (
    id UUID,
    website_id String,
    visitor_id String,
    session_id String,
    event_type String,
    page String,
    referrer String,
    user_agent String,
    ip_address String,
    country String,
    country_code String,
    city String,
    region String,
    continent String,
    browser String,
    device String,
    os String,
    utm_source String,
    utm_medium String,
    utm_campaign String,
    utm_term String,
    utm_content String,
    time_on_page Int32,
    latitude Float64,
    longitude Float64,
    properties String, -- JSON string
    timestamp DateTime64(3, 'UTC'),
    created_at DateTime64(3, 'UTC') DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (website_id, event_type, timestamp, id);

-- Custom events aggregated
CREATE TABLE IF NOT EXISTS custom_events_aggregated (
    website_id String,
    event_type String,
    event_signature String,
    count AggregateFunction(count, UInt64),
    last_seen SimpleAggregateFunction(max, DateTime64(3, 'UTC'))
) ENGINE = AggregatingMergeTree()
ORDER BY (website_id, event_type, event_signature);
