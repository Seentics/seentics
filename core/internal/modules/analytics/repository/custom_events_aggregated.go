package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

type CustomEventsAggregatedRepository struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

func NewCustomEventsAggregatedRepository(db *pgxpool.Pool, logger zerolog.Logger) *CustomEventsAggregatedRepository {
	return &CustomEventsAggregatedRepository{
		db:     db,
		logger: logger,
	}
}

// UpsertCustomEvent creates or updates a custom event aggregation
func (r *CustomEventsAggregatedRepository) UpsertCustomEvent(ctx context.Context, event *models.Event, increment int) error {
	if event.EventType == "pageview" || event.EventType == "session_start" || event.EventType == "session_end" {
		// Don't aggregate system events
		return nil
	}

	// Create event signature from properties
	signature := r.createEventSignature(event.EventType, event.Properties)

	// Prepare properties JSON
	var propertiesJSON []byte
	if event.Properties != nil {
		var err error
		propertiesJSON, err = json.Marshal(event.Properties)
		if err != nil {
			r.logger.Error().Err(err).Msg("Failed to marshal properties for aggregation")
			return err
		}
	}

	now := time.Now()
	oneHourAgo := now.Add(-time.Hour)

	// OPTIMIZATION: Try UPDATE first (most common case for high volume)
	// This avoids a SELECT round-trip
	updateQuery := `
		UPDATE custom_events_aggregated 
		SET count = count + $4, last_seen = $5, updated_at = $5,
			sample_properties = CASE 
				WHEN last_seen < $5 THEN $6
				ELSE sample_properties
			END
		WHERE website_id = $1 AND event_signature = $2 
		AND last_seen >= $3
		RETURNING id
	`

	var id string
	err := r.db.QueryRow(ctx, updateQuery, event.WebsiteID, signature, oneHourAgo, increment, now, propertiesJSON).Scan(&id)

	if err == nil {
		// Update successful
		return nil
	}

	// If UPDATE failed (no rows), then INSERT
	// Note: In high concurrency, a race condition could still cause duplicates here
	// without a UNIQUE constraint, but this reduces the window significantly compared to Read-then-Write.
	insertQuery := `
		INSERT INTO custom_events_aggregated (
			website_id, event_type, event_signature, count, sample_properties, 
			first_seen, last_seen, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6)
	`

	_, err = r.db.Exec(ctx, insertQuery, event.WebsiteID, event.EventType, signature, increment, propertiesJSON, now)
	if err != nil {
		r.logger.Error().Err(err).
			Str("website_id", event.WebsiteID).
			Str("event_type", event.EventType).
			Str("signature", signature).
			Msg("Failed to upsert custom event aggregation")
		return err
	}

	r.logger.Debug().
		Str("website_id", event.WebsiteID).
		Str("event_type", event.EventType).
		Int("increment", increment).
		Msg("Custom event aggregated successfully")

	return nil
}

// GetCustomEventStats returns aggregated custom event statistics
func (r *CustomEventsAggregatedRepository) GetCustomEventStats(ctx context.Context, websiteID string, days int) ([]models.CustomEventStat, error) {
	query := `
		SELECT 
			event_type,
			SUM(count) AS total_count,
			sample_properties
		FROM custom_events_aggregated
		WHERE website_id = $1
		AND last_seen >= NOW() - INTERVAL '1 day' * $2
		GROUP BY event_type, event_signature, sample_properties
		ORDER BY total_count DESC
		LIMIT 100`

	rows, err := r.db.Query(ctx, query, websiteID, days)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var events []models.CustomEventStat
	for rows.Next() {
		var event models.CustomEventStat
		var propertiesJSON []byte

		err := rows.Scan(&event.EventType, &event.Count, &propertiesJSON)
		if err != nil {
			r.logger.Warn().Err(err).Msg("Failed to scan custom event stat")
			continue
		}

		// Parse sample properties
		if len(propertiesJSON) > 0 {
			var properties models.Properties
			if err := json.Unmarshal(propertiesJSON, &properties); err == nil {
				event.SampleProperties = properties
				event.SampleEvent = properties
				event.CommonProperties = r.extractCommonProperties(properties)
			}
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// createEventSignature creates a unique signature for an event based on its type and key identifying properties
// This ensures that different interactive elements (different buttons, different forms)
// are tracked as separate conversion targets.
func (r *CustomEventsAggregatedRepository) createEventSignature(eventType string, properties models.Properties) string {
	// Start with lowercase event type
	signatureParts := []string{strings.ToLower(eventType)}

	// Add key identifying properties if they exist
	// These specific keys distinguish between different targets of the same event type
	identifyKeys := []string{
		"element_id",
		"element_text",
		"element_tag",
		"form_id",
		"form_name",
		"href",
		"page",  // Distinguish same button on different pages
		"depth", // For scroll_depth events
	}

	for _, key := range identifyKeys {
		if val, ok := properties[key]; ok {
			signatureParts = append(signatureParts, fmt.Sprintf("%s:%v", key, val))
		}
	}

	signatureData := strings.Join(signatureParts, "|")

	// Create SHA-256 hash of the identifying data
	hash := sha256.Sum256([]byte(signatureData))
	return hex.EncodeToString(hash[:])
}

// extractCommonProperties extracts common property keys from sample properties
func (r *CustomEventsAggregatedRepository) extractCommonProperties(props models.Properties) models.Properties {
	if props == nil {
		return models.Properties{}
	}

	// For now, return the sample properties as common properties
	// In a more sophisticated implementation, you could analyze multiple events
	// and find properties that appear in most events of the same type
	return props
}

// CleanupOldEvents removes old aggregated events (optional cleanup)
func (r *CustomEventsAggregatedRepository) CleanupOldEvents(ctx context.Context, olderThanDays int) error {
	query := `
		DELETE FROM custom_events_aggregated 
		WHERE last_seen < NOW() - INTERVAL '1 day' * $1
	`

	result, err := r.db.Exec(ctx, query, olderThanDays)
	if err != nil {
		return fmt.Errorf("cleanup failed: %w", err)
	}

	rowsAffected := result.RowsAffected()
	r.logger.Info().
		Int64("rows_deleted", rowsAffected).
		Int("older_than_days", olderThanDays).
		Msg("Cleaned up old aggregated custom events")

	return nil
}
