package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ActivityTrendsAnalytics struct {
	db *pgxpool.Pool
}

func NewActivityTrendsAnalytics(db *pgxpool.Pool) *ActivityTrendsAnalytics {
	return &ActivityTrendsAnalytics{db: db}
}

func (r *ActivityTrendsAnalytics) GetActivityTrends(ctx context.Context, websiteID string, timezone string) (*models.ActivityTrendsResponse, error) {
	timezone = validateTimezone(timezone)

	query := `
		SELECT
			DATE_TRUNC('hour', timestamp AT TIME ZONE $2) as time_bucket,
			COUNT(DISTINCT visitor_id) as visitors,
			COUNT(*) as page_views,
			SUM(CASE WHEN event_type = 'session_start' THEN 1 ELSE 0 END) as sessions,
			TO_CHAR(DATE_TRUNC('hour', timestamp AT TIME ZONE $2), 'HH24:MI') as label
		FROM events
		WHERE website_id = $1
		AND timestamp >= NOW() - INTERVAL '24 hours'
		GROUP BY 1, 5
		ORDER BY 1 ASC
	`

	rows, err := r.db.Query(ctx, query, websiteID, timezone)
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
		t.Events = t.PageViews
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
