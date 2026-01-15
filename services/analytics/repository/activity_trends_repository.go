package repository

import (
	"analytics-app/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ActivityTrendsAnalytics struct {
	db *pgxpool.Pool
}

func NewActivityTrendsAnalytics(db *pgxpool.Pool) *ActivityTrendsAnalytics {
	return &ActivityTrendsAnalytics{db: db}
}

func (r *ActivityTrendsAnalytics) GetActivityTrends(ctx context.Context, websiteID string) (*models.ActivityTrendsResponse, error) {
	// Returns activity trends for the last 24 hours, grouped by hour

	query := `
		SELECT 
			DATE_TRUNC('hour', timestamp) as time_bucket,
			COUNT(DISTINCT visitor_id) as visitors,
			COUNT(*) as page_views,
			SUM(CASE WHEN event_type = 'session_start' THEN 1 ELSE 0 END) as sessions,
			TO_CHAR(DATE_TRUNC('hour', timestamp), 'HH24:MI') as label
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '24 hours'
		GROUP BY 1
		ORDER BY 1 ASC
	`

	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trends []models.ActivityTrendItem
	for rows.Next() {
		var t models.ActivityTrendItem
		if err := rows.Scan(&t.Timestamp, &t.Visitors, &t.PageViews, &t.Sessions, &t.Label); err != nil {
			continue
		}
		// Fill missing fields with basic calculation
		t.Events = t.PageViews // Assuming most events are pageviews for now + custom events
		if t.Sessions > 0 {
			t.Engagement = float64(t.PageViews) / float64(t.Sessions)
		}
		trends = append(trends, t)
	}

	return &models.ActivityTrendsResponse{
		WebsiteID: websiteID,
		Trends:    trends,
	}, nil
}
