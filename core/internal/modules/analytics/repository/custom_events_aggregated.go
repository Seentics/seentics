package repository

import (
	"github.com/Seentics/seentics/internal/modules/analytics/models"
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

	// Atomic upsert using CTE to avoid race conditions:
	// 1. Try UPDATE first (most common case for high volume)
	// 2. If no rows updated, INSERT (only when UPDATE found nothing)
	// The CTE ensures atomicity within a single statement.
	query := `
		WITH updated AS (
			UPDATE custom_events_aggregated
			SET count = count + $4, last_seen = $5, updated_at = $5,
				sample_properties = CASE
					WHEN last_seen < $5 THEN $6
					ELSE sample_properties
				END
			WHERE website_id = $1 AND event_signature = $2
			AND last_seen >= $3
			RETURNING id
		)
		INSERT INTO custom_events_aggregated (
			website_id, event_type, event_signature, count, sample_properties,
			first_seen, last_seen, created_at, updated_at
		)
		SELECT $1, $7, $2, $4, $6, $5, $5, $5, $5
		WHERE NOT EXISTS (SELECT 1 FROM updated)
	`

	_, err := r.db.Exec(ctx, query, event.WebsiteID, signature, oneHourAgo, increment, now, propertiesJSON, event.EventType)
	if err != nil {
		r.logger.Error().Err(err).
			Str("website_id", event.WebsiteID).
			Str("event_type", event.EventType).
			Str("signature", signature).
			Msg("Failed to upsert custom event aggregation")
		return err
	}

	return nil
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
