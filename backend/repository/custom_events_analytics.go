package repository

import (
	"analytics-app/models"
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomEventsAnalytics struct {
	db *pgxpool.Pool
}

func NewCustomEventsAnalytics(db *pgxpool.Pool) *CustomEventsAnalytics {
	return &CustomEventsAnalytics{db: db}
}

// GetCustomEventStats returns custom event statistics for a website
func (ce *CustomEventsAnalytics) GetCustomEventStats(ctx context.Context, websiteID string, days int) ([]models.CustomEventStat, error) {
	// Get aggregated event counts from the custom_events_aggregated table
	query := `
		SELECT 
			event_type,
			SUM(count) as total_count,
			sample_properties
		FROM custom_events_aggregated
		WHERE website_id = $1 
		AND last_seen >= NOW() - INTERVAL '1 day' * $2
		GROUP BY event_type, sample_properties
		ORDER BY total_count DESC
		LIMIT 50`

	rows, err := ce.db.Query(ctx, query, websiteID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.CustomEventStat
	for rows.Next() {
		var event models.CustomEventStat
		var propertiesJSON []byte

		err := rows.Scan(&event.EventType, &event.Count, &propertiesJSON)
		if err != nil {
			continue
		}

		// Parse sample properties
		if len(propertiesJSON) > 0 {
			var properties models.Properties
			if err := json.Unmarshal(propertiesJSON, &properties); err == nil {
				event.SampleProperties = properties
				event.SampleEvent = properties
				event.CommonProperties = ce.extractCommonProperties(properties)
			}
		}

		events = append(events, event)
	}

	return events, nil
}

// extractCommonProperties extracts common property keys from sample properties
func (ce *CustomEventsAnalytics) extractCommonProperties(props models.Properties) models.Properties {
	if props == nil {
		return models.Properties{}
	}

	// For now, return the sample properties as common properties
	// In a more sophisticated implementation, you could analyze multiple events
	// and find properties that appear in most events of the same type
	return props
}
