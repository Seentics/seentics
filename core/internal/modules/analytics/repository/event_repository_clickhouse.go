package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type ClickHouseEventRepository struct {
	conn   driver.Conn
	logger zerolog.Logger
}

func NewClickHouseEventRepository(conn driver.Conn, logger zerolog.Logger) *ClickHouseEventRepository {
	return &ClickHouseEventRepository{
		conn:   conn,
		logger: logger,
	}
}

func (r *ClickHouseEventRepository) CreateSchema(ctx context.Context) error {
	queries := []string{
		// Main events table
		`CREATE TABLE IF NOT EXISTS events (
			id UUID,
			website_id String,
			visitor_id String,
			session_id String,
			event_type LowCardinality(String),
			page String,
			referrer Nullable(String),
			user_agent Nullable(String),
			ip_address Nullable(String),
			country Nullable(String),
			country_code LowCardinality(Nullable(String)),
			city Nullable(String),
			region Nullable(String),
			continent LowCardinality(Nullable(String)),
			latitude Float64 DEFAULT 0,
			longitude Float64 DEFAULT 0,
			browser LowCardinality(Nullable(String)),
			device LowCardinality(Nullable(String)),
			os LowCardinality(Nullable(String)),
			utm_source LowCardinality(Nullable(String)),
			utm_medium LowCardinality(Nullable(String)),
			utm_campaign Nullable(String),
			utm_term Nullable(String),
			utm_content Nullable(String),
			time_on_page Int64,
			properties String,
			timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			created_at DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1))
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(timestamp)
		ORDER BY (website_id, timestamp, event_type)
		TTL toDate(timestamp) + INTERVAL 2 YEAR`,

		// Daily aggregated stats
		`CREATE TABLE IF NOT EXISTS daily_stats (
			website_id String,
			day Date,
			page_views SimpleAggregateFunction(sum, UInt64),
			unique_visitors AggregateFunction(uniq, String),
			sessions AggregateFunction(uniq, String)
		) ENGINE = AggregatingMergeTree()
		PARTITION BY toYYYYMM(day)
		ORDER BY (website_id, day)`,

		`CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_stats
		TO daily_stats
		AS SELECT
			website_id,
			toDate(timestamp) AS day,
			count() AS page_views,
			uniqState(visitor_id) AS unique_visitors,
			uniqState(session_id) AS sessions
		FROM events
		WHERE event_type = 'pageview'
		GROUP BY website_id, day`,

		// Hourly aggregated stats
		`CREATE TABLE IF NOT EXISTS hourly_stats (
			website_id String,
			hour DateTime,
			page_views SimpleAggregateFunction(sum, UInt64),
			unique_visitors AggregateFunction(uniq, String),
			sessions AggregateFunction(uniq, String)
		) ENGINE = AggregatingMergeTree()
		PARTITION BY toYYYYMM(hour)
		ORDER BY (website_id, hour)
		TTL hour + INTERVAL 90 DAY`,

		`CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_stats
		TO hourly_stats
		AS SELECT
			website_id,
			toStartOfHour(timestamp) AS hour,
			count() AS page_views,
			uniqState(visitor_id) AS unique_visitors,
			uniqState(session_id) AS sessions
		FROM events
		WHERE event_type = 'pageview'
		GROUP BY website_id, hour`,

		// Daily page stats
		`CREATE TABLE IF NOT EXISTS daily_page_stats (
			website_id String,
			day Date,
			page String,
			page_views SimpleAggregateFunction(sum, UInt64),
			unique_visitors AggregateFunction(uniq, String)
		) ENGINE = AggregatingMergeTree()
		PARTITION BY toYYYYMM(day)
		ORDER BY (website_id, day, page)`,

		`CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_page_stats
		TO daily_page_stats
		AS SELECT
			website_id,
			toDate(timestamp) AS day,
			page,
			count() AS page_views,
			uniqState(visitor_id) AS unique_visitors
		FROM events
		WHERE event_type = 'pageview'
		GROUP BY website_id, day, page`,

		// Daily country stats
		`CREATE TABLE IF NOT EXISTS daily_country_stats (
			website_id String,
			day Date,
			country String,
			country_code String,
			page_views SimpleAggregateFunction(sum, UInt64),
			unique_visitors AggregateFunction(uniq, String)
		) ENGINE = AggregatingMergeTree()
		PARTITION BY toYYYYMM(day)
		ORDER BY (website_id, day, country)`,

		`CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_country_stats
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
		GROUP BY website_id, day, country, country_code`,

		// Daily referrer stats
		`CREATE TABLE IF NOT EXISTS daily_referrer_stats (
			website_id String,
			day Date,
			referrer String,
			page_views SimpleAggregateFunction(sum, UInt64),
			unique_visitors AggregateFunction(uniq, String)
		) ENGINE = AggregatingMergeTree()
		PARTITION BY toYYYYMM(day)
		ORDER BY (website_id, day, referrer)`,

		`CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_referrer_stats
		TO daily_referrer_stats
		AS SELECT
			website_id,
			toDate(timestamp) AS day,
			COALESCE(referrer, 'direct') AS referrer,
			count() AS page_views,
			uniqState(visitor_id) AS unique_visitors
		FROM events
		WHERE event_type = 'pageview'
		GROUP BY website_id, day, referrer`,
	}

	for _, q := range queries {
		if err := r.conn.Exec(ctx, q); err != nil {
			// Check if it's "Table already exists" or similar common non-fatal errors
			if strings.Contains(err.Error(), "already exists") {
				continue
			}
			return fmt.Errorf("failed to execute ClickHouse schema statement: %w", err)
		}
	}

	// Ensure columns added after initial schema creation exist on pre-existing tables.
	alterQueries := []string{
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude Float64 DEFAULT 0 AFTER continent`,
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude Float64 DEFAULT 0 AFTER latitude`,
		// Optimize column types and codecs for existing tables
		`ALTER TABLE events MODIFY COLUMN IF EXISTS timestamp CODEC(Delta, ZSTD(1))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS created_at CODEC(Delta, ZSTD(1))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS event_type LowCardinality(String)`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS browser LowCardinality(Nullable(String))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS device LowCardinality(Nullable(String))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS os LowCardinality(Nullable(String))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS continent LowCardinality(Nullable(String))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS country_code LowCardinality(Nullable(String))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS utm_source LowCardinality(Nullable(String))`,
		`ALTER TABLE events MODIFY COLUMN IF EXISTS utm_medium LowCardinality(Nullable(String))`,
	}
	for _, q := range alterQueries {
		if err := r.conn.Exec(ctx, q); err != nil {
			if strings.Contains(err.Error(), "already exists") {
				continue
			}
			r.logger.Warn().Err(err).Msg("ClickHouse ALTER TABLE failed")
		}
	}

	return nil
}

func (r *ClickHouseEventRepository) Create(ctx context.Context, event *models.Event) error {
	_, err := r.CreateBatch(ctx, []models.Event{*event})
	return err
}

func (r *ClickHouseEventRepository) CreateBatch(ctx context.Context, events []models.Event) (*BatchResult, error) {
	if len(events) == 0 {
		return &BatchResult{}, nil
	}

	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO events")
	if err != nil {
		return nil, fmt.Errorf("failed to prepare batch: %w", err)
	}

	for _, event := range events {
		if event.ID == uuid.Nil {
			event.ID = uuid.New()
		}
		if event.CreatedAt.IsZero() {
			event.CreatedAt = time.Now()
		}
		if event.Timestamp.IsZero() {
			event.Timestamp = time.Now()
		}

		propertiesJSON := "{}"
		if event.Properties != nil {
			if bytes, err := json.Marshal(event.Properties); err == nil {
				propertiesJSON = string(bytes)
			}
		}

		timeOnPage := int64(0)
		if event.TimeOnPage != nil {
			timeOnPage = int64(*event.TimeOnPage)
		}

		lat := float64(0)
		if event.Latitude != nil {
			lat = *event.Latitude
		}
		lng := float64(0)
		if event.Longitude != nil {
			lng = *event.Longitude
		}

		err = batch.Append(
			event.ID,
			event.WebsiteID,
			event.VisitorID,
			event.SessionID,
			event.EventType,
			event.Page,
			event.Referrer,
			event.UserAgent,
			event.IPAddress,
			event.Country,
			event.CountryCode,
			event.City,
			event.Region,
			event.Continent,
			lat,
			lng,
			event.Browser,
			event.Device,
			event.OS,
			event.UTMSource,
			event.UTMMedium,
			event.UTMCampaign,
			event.UTMTerm,
			event.UTMContent,
			timeOnPage,
			propertiesJSON,
			event.Timestamp,
			event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to append to batch: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return nil, fmt.Errorf("failed to send batch: %w", err)
	}

	return &BatchResult{
		Total:     len(events),
		Processed: len(events),
		Failed:    0,
	}, nil
}

func (r *ClickHouseEventRepository) GetTotalEventCount(ctx context.Context) (int64, error) {
	var count uint64
	err := r.conn.QueryRow(ctx, "SELECT count() FROM events").Scan(&count)
	return int64(count), err
}

func (r *ClickHouseEventRepository) GetEventsToday(ctx context.Context) (int64, error) {
	var count uint64
	err := r.conn.QueryRow(ctx, "SELECT count() FROM events WHERE toDate(timestamp) = today()").Scan(&count)
	return int64(count), err
}

func (r *ClickHouseEventRepository) GetUniqueVisitorsToday(ctx context.Context) (int64, error) {
	var count uint64
	err := r.conn.QueryRow(ctx, "SELECT count(DISTINCT visitor_id) FROM events WHERE toDate(timestamp) = today()").Scan(&count)
	return int64(count), err
}

func (r *ClickHouseEventRepository) GetTotalPageviews(ctx context.Context) (int64, error) {
	var count uint64
	err := r.conn.QueryRow(ctx, "SELECT count() FROM events WHERE event_type = 'pageview'").Scan(&count)
	return int64(count), err
}

func (r *ClickHouseEventRepository) GetByWebsiteID(ctx context.Context, websiteID string, limit, offset int) ([]models.Event, error) {
	query := `
		SELECT
			id, website_id, visitor_id, session_id, event_type, page, referrer, user_agent,
			ip_address, country, country_code, city, region, continent, latitude, longitude,
			browser, device, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
			time_on_page, properties, timestamp, created_at
		FROM events
		WHERE website_id = ?
		ORDER BY timestamp DESC
		LIMIT ? OFFSET ?`

	rows, err := r.conn.Query(ctx, query, websiteID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var event models.Event
		var propertiesJSON string
		var timeOnPage int64
		var lat, lng float64

		err := rows.Scan(
			&event.ID, &event.WebsiteID, &event.VisitorID, &event.SessionID, &event.EventType, &event.Page, &event.Referrer, &event.UserAgent,
			&event.IPAddress, &event.Country, &event.CountryCode, &event.City, &event.Region, &event.Continent, &lat, &lng,
			&event.Browser, &event.Device, &event.OS, &event.UTMSource, &event.UTMMedium, &event.UTMCampaign, &event.UTMTerm, &event.UTMContent,
			&timeOnPage, &propertiesJSON, &event.Timestamp, &event.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		top := int(timeOnPage)
		event.TimeOnPage = &top
		if lat != 0 {
			event.Latitude = &lat
		}
		if lng != 0 {
			event.Longitude = &lng
		}

		if propertiesJSON != "" {
			var props map[string]interface{}
			if err := json.Unmarshal([]byte(propertiesJSON), &props); err == nil {
				event.Properties = props
			}
		}

		events = append(events, event)
	}

	return events, nil
}

func (r *ClickHouseEventRepository) DeleteByWebsiteID(ctx context.Context, websiteID string) error {
	// Issue the async DELETE mutation.
	query := `ALTER TABLE events DELETE WHERE website_id = ?`
	if err := r.conn.Exec(ctx, query, websiteID); err != nil {
		r.logger.Error().Err(err).Str("website_id", websiteID).Msg("Failed to delete events from ClickHouse")
		return err
	}
	// Force a merge so the mutation is applied immediately and disk space is reclaimed.
	// Without this, ClickHouse keeps deleted rows on disk until the next background merge.
	if err := r.conn.Exec(ctx, "OPTIMIZE TABLE events FINAL"); err != nil {
		// Non-fatal — the mutation will still be applied eventually by background merges.
		r.logger.Warn().Err(err).Msg("OPTIMIZE TABLE events FINAL failed (non-fatal)")
	}
	return nil
}

func (r *ClickHouseEventRepository) HealthCheck(ctx context.Context) error {
	return r.conn.Ping(ctx)
}
