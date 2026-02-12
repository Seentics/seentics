package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"encoding/json"
	"fmt"
	"time"

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
	query := `
	CREATE TABLE IF NOT EXISTS events (
		id UUID,
		website_id String,
		visitor_id String,
		session_id String,
		event_type String,
		page String,
		referrer Nullable(String),
		user_agent Nullable(String),
		ip_address Nullable(String),
		country Nullable(String),
		country_code Nullable(String),
		city Nullable(String),
		region Nullable(String),
		continent Nullable(String),
		browser Nullable(String),
		device Nullable(String),
		os Nullable(String),
		utm_source Nullable(String),
		utm_medium Nullable(String),
		utm_campaign Nullable(String),
		utm_term Nullable(String),
		utm_content Nullable(String),
		time_on_page Int64,
		properties String,
		timestamp DateTime64(3, 'UTC'),
		created_at DateTime64(3, 'UTC')
	) ENGINE = MergeTree()
	PARTITION BY toYYYYMM(timestamp)
	ORDER BY (website_id, timestamp, event_type)`

	return r.conn.Exec(ctx, query)
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
			ip_address, country, country_code, city, region, continent, browser, device, 
			os, utm_source, utm_medium, utm_campaign, utm_term, utm_content, time_on_page, 
			properties, timestamp, created_at
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

		err := rows.Scan(
			&event.ID, &event.WebsiteID, &event.VisitorID, &event.SessionID, &event.EventType, &event.Page, &event.Referrer, &event.UserAgent,
			&event.IPAddress, &event.Country, &event.CountryCode, &event.City, &event.Region, &event.Continent, &event.Browser, &event.Device,
			&event.OS, &event.UTMSource, &event.UTMMedium, &event.UTMCampaign, &event.UTMTerm, &event.UTMContent, &timeOnPage,
			&propertiesJSON, &event.Timestamp, &event.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		top := int(timeOnPage)
		event.TimeOnPage = &top

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

func (r *ClickHouseEventRepository) HealthCheck(ctx context.Context) error {
	return r.conn.Ping(ctx)
}
