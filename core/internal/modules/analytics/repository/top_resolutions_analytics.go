package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TopResolutionsAnalytics struct {
	db *pgxpool.Pool
}

func NewTopResolutionsAnalytics(db *pgxpool.Pool) *TopResolutionsAnalytics {
	return &TopResolutionsAnalytics{db: db}
}

// GetTopResolutions returns the top screen resolutions for a website
func (tr *TopResolutionsAnalytics) GetTopResolutions(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			CONCAT(properties->>'screen_width', 'x', properties->>'screen_height') as name,
			COUNT(*) as count
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '1 day' * $2
		AND event_type = 'pageview'
		AND properties->>'screen_width' IS NOT NULL
		AND properties->>'screen_height' IS NOT NULL
		GROUP BY name
		ORDER BY count DESC
		LIMIT $3`

	rows, err := tr.db.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var total int
	var items []models.TopItem
	for rows.Next() {
		var item models.TopItem
		if err := rows.Scan(&item.Name, &item.Count); err != nil {
			continue
		}
		total += item.Count
		items = append(items, item)
	}

	// Calculate percentages
	if total > 0 {
		for i := range items {
			items[i].Percentage = float64(items[i].Count) / float64(total) * 100
		}
	}

	return items, nil
}
