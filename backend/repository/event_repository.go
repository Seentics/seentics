package repository

import (
	"analytics-app/models"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

const (
	MaxBatchSize = 2000               // Increased from 1000 for better throughput
	BatchTimeout = 30 * time.Second   // Keep timeout reasonable for reliability
)

type EventRepository struct {
	db                     *pgxpool.Pool
	logger                 zerolog.Logger
	customEventsAggregated *CustomEventsAggregatedRepository
}

type BatchResult struct {
	Total     int     `json:"total"`
	Processed int     `json:"processed"`
	Failed    int     `json:"failed"`
	Errors    []error `json:"errors,omitempty"`
}

func NewEventRepository(db *pgxpool.Pool, logger zerolog.Logger) *EventRepository {
	return &EventRepository{
		db:                     db,
		logger:                 logger,
		customEventsAggregated: NewCustomEventsAggregatedRepository(db, logger),
	}
}

// GetTotalEventCount returns the total number of events
func (r *EventRepository) GetTotalEventCount(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM events`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetEventsToday returns the number of events created today
func (r *EventRepository) GetEventsToday(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM events WHERE DATE(created_at) = CURRENT_DATE`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetUniqueVisitorsToday returns the number of unique visitors today
func (r *EventRepository) GetUniqueVisitorsToday(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(DISTINCT visitor_id) FROM events WHERE DATE(created_at) = CURRENT_DATE`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetTotalPageviews returns the total number of pageview events
func (r *EventRepository) GetTotalPageviews(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM events WHERE event_type = 'pageview'`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}

func (r *EventRepository) Create(ctx context.Context, event *models.Event) error {
	r.prepareEvent(event)

	// Handle custom events with aggregation
	if event.EventType != "pageview" && event.EventType != "session_start" && event.EventType != "session_end" {
		// For custom events, aggregate them instead of storing individually
		if err := r.customEventsAggregated.UpsertCustomEvent(ctx, event); err != nil {
			r.logger.Error().Err(err).Str("event_id", event.ID.String()).Msg("Failed to aggregate custom event")
			return err
		}
		return nil
	}

	// For system events (pageview, session_start, session_end), store normally
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `INSERT INTO events (
		id, website_id, visitor_id, session_id, event_type, page, referrer, user_agent, ip_address,
		country, city, browser, device, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
		time_on_page, properties, timestamp, created_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`

	_, err := r.db.Exec(ctx, query, r.eventArgs(event)...)
	if err != nil {
		r.logger.Error().Err(err).Str("event_id", event.ID.String()).Msg("Failed to insert event")
	}
	return err
}

func (r *EventRepository) CreateBatch(ctx context.Context, events []models.Event) (*BatchResult, error) {
	if len(events) == 0 {
		return &BatchResult{}, nil
	}

	if len(events) > MaxBatchSize*5 {
		return nil, fmt.Errorf("batch too large: %d events", len(events))
	}

	result := &BatchResult{Total: len(events)}
	start := time.Now()

	// Separate system events from custom events
	var systemEvents []models.Event
	var customEvents []models.Event

	for _, event := range events {
		if event.EventType == "pageview" || event.EventType == "session_start" || event.EventType == "session_end" {
			systemEvents = append(systemEvents, event)
		} else {
			customEvents = append(customEvents, event)
		}
	}

	// Process system events in chunks (normal storage)
	if len(systemEvents) > 0 {
		for i := 0; i < len(systemEvents); i += MaxBatchSize {
			end := i + MaxBatchSize
			if end > len(systemEvents) {
				end = len(systemEvents)
			}

			chunkResult, err := r.processChunk(ctx, systemEvents[i:end])
			result.Processed += chunkResult.Processed
			result.Failed += chunkResult.Failed

			if err != nil {
				result.Errors = append(result.Errors, fmt.Errorf("system events chunk %d-%d: %w", i, end-1, err))
			}
		}
	}

	// Process custom events with aggregation
	for _, event := range customEvents {
		if err := r.customEventsAggregated.UpsertCustomEvent(ctx, &event); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Errorf("custom event aggregation failed: %w", err))
		} else {
			result.Processed++
		}
	}

	r.logger.Info().
		Int("total", result.Total).
		Int("processed", result.Processed).
		Int("failed", result.Failed).
		Int("system_events", len(systemEvents)).
		Int("custom_events", len(customEvents)).
		Dur("duration", time.Since(start)).
		Msg("Batch insert completed")

	return result, nil
}

func (r *EventRepository) processChunk(ctx context.Context, events []models.Event) (*BatchResult, error) {
	ctx, cancel := context.WithTimeout(ctx, BatchTimeout)
	defer cancel()

	// Use COPY for larger batches, regular batch for smaller ones
	if len(events) > 50 {
		return r.copyBatch(ctx, events)
	}
	return r.regularBatch(ctx, events)
}

func (r *EventRepository) copyBatch(ctx context.Context, events []models.Event) (*BatchResult, error) {
	// Prepare all events
	for i := range events {
		r.prepareEvent(&events[i])
	}

	columns := []string{
		"id", "website_id", "visitor_id", "session_id", "event_type", "page", "referrer", "user_agent", "ip_address",
		"country", "city", "browser", "device", "os", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
		"time_on_page", "properties", "timestamp", "created_at",
	}

	rows := make([][]interface{}, len(events))
	for i, event := range events {
		rows[i] = r.eventArgs(&event)
	}

	rowsAffected, err := r.db.CopyFrom(ctx, pgx.Identifier{"events"}, columns, pgx.CopyFromRows(rows))

	result := &BatchResult{Total: len(events)}
	if err != nil {
		result.Failed = len(events)
		return result, fmt.Errorf("copy failed: %w", err)
	}

	result.Processed = int(rowsAffected)
	result.Failed = len(events) - int(rowsAffected)
	return result, nil
}

func (r *EventRepository) regularBatch(ctx context.Context, events []models.Event) (*BatchResult, error) {
	batch := &pgx.Batch{}
	query := `INSERT INTO events (
		id, website_id, visitor_id, session_id, event_type, page, referrer, user_agent, ip_address,
		country, city, browser, device, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
		time_on_page, properties, timestamp, created_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`

	// Prepare events and queue them
	for i := range events {
		r.prepareEvent(&events[i])
		batch.Queue(query, r.eventArgs(&events[i])...)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	result := &BatchResult{Total: len(events)}

	// Execute all and count results
	for i := range events {
		if _, err := br.Exec(); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Errorf("event %d: %w", i, err))
		} else {
			result.Processed++
		}
	}

	return result, nil
}

func (r *EventRepository) GetByWebsiteID(ctx context.Context, websiteID string, limit, offset int) ([]models.Event, error) {
	if websiteID == "" {
		return nil, fmt.Errorf("website_id required")
	}

	if limit <= 0 || limit > 10000 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	query := `SELECT id, website_id, visitor_id, session_id, event_type, page, referrer, user_agent, ip_address,
		country, city, browser, device, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
		time_on_page, properties, timestamp, created_at
		FROM events WHERE website_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, query, websiteID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var event models.Event
		var propertiesJSON []byte

		err := rows.Scan(
			&event.ID, &event.WebsiteID, &event.VisitorID, &event.SessionID, &event.EventType,
			&event.Page, &event.Referrer, &event.UserAgent, &event.IPAddress,
			&event.Country, &event.City, &event.Browser, &event.Device, &event.OS,
			&event.UTMSource, &event.UTMMedium, &event.UTMCampaign, &event.UTMTerm, &event.UTMContent,
			&event.TimeOnPage, &propertiesJSON, &event.Timestamp, &event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}

		// Parse properties JSON
		if len(propertiesJSON) > 0 {
			if err := json.Unmarshal(propertiesJSON, &event.Properties); err != nil {
				r.logger.Warn().Err(err).Msg("Failed to parse properties JSON")
			}
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

func (r *EventRepository) HealthCheck(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var result int
	return r.db.QueryRow(ctx, "SELECT 1").Scan(&result)
}

// Helper methods

func (r *EventRepository) prepareEvent(event *models.Event) {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Validate required fields
	if event.WebsiteID == "" {
		r.logger.Warn().Str("event_id", event.ID.String()).Msg("Event missing website_id")
	}
	if event.VisitorID == "" {
		r.logger.Warn().Str("event_id", event.ID.String()).Msg("Event missing visitor_id")
	}
}
func (r *EventRepository) eventArgs(event *models.Event) []interface{} {
	// Convert properties to JSON
	var propertiesJSON interface{}
	if event.Properties != nil {
		if jsonBytes, err := json.Marshal(event.Properties); err == nil {
			propertiesJSON = jsonBytes
		} else {
			r.logger.Error().Err(err).Msg("Failed to marshal properties")
			propertiesJSON = nil
		}
	}

	return []interface{}{
		event.ID, event.WebsiteID, event.VisitorID, event.SessionID, event.EventType,
		event.Page, r.stringPtr(event.Referrer), r.stringPtr(event.UserAgent), r.stringPtr(event.IPAddress),
		r.stringPtr(event.Country), r.stringPtr(event.City), r.stringPtr(event.Browser), r.stringPtr(event.Device), r.stringPtr(event.OS),
		r.stringPtr(event.UTMSource), r.stringPtr(event.UTMMedium), r.stringPtr(event.UTMCampaign), r.stringPtr(event.UTMTerm), r.stringPtr(event.UTMContent),
		event.TimeOnPage, propertiesJSON, event.Timestamp, event.CreatedAt,
	}
}

// Helper to safely handle string pointers for NULL values
func (r *EventRepository) stringPtr(ptr *string) interface{} {
	if ptr == nil || *ptr == "" {
		return nil
	}
	return *ptr
}
