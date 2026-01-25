package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type VisitorInsightsAnalytics struct {
	db *pgxpool.Pool
}

func NewVisitorInsightsAnalytics(db *pgxpool.Pool) *VisitorInsightsAnalytics {
	return &VisitorInsightsAnalytics{db: db}
}

func (r *VisitorInsightsAnalytics) GetVisitorInsights(ctx context.Context, websiteID string, days int) (*models.VisitorInsights, error) {
	// Lookback period start date
	startDate := time.Now().AddDate(0, 0, -days)

	// Query to calculate New vs Returning visitors
	// - New Visitor: First seen in the selected range
	// - Returning Visitor: Seen before the start of the selected range AND seen in range

	// Note: This logic might need adjustment based on how `first_seen` is stored.
	// Assuming raw events doesn't store visitor profile, so we deduce from history.
	// For optimization, a `visitors` table tracking `first_seen` would be better.
	// Here we use a query that acts on the events table directly.

	query := `
		WITH visitor_status AS (
			SELECT 
				visitor_id,
				MIN(timestamp) as first_visit
			FROM events
			WHERE website_id = $1
			GROUP BY visitor_id
		),
		period_stats AS (
			SELECT
				SUM(CASE WHEN first_visit >= $2 THEN 1 ELSE 0 END) as new_visitors,
				SUM(CASE WHEN first_visit < $2 AND visitor_id IN (
					SELECT DISTINCT visitor_id FROM events 
					WHERE website_id = $1 AND timestamp >= $2
				) THEN 1 ELSE 0 END) as returning_visitors
			FROM visitor_status
			WHERE visitor_id IN (
				SELECT DISTINCT visitor_id FROM events 
				WHERE website_id = $1 AND timestamp >= $2
			)
		),
		session_stats AS (
			SELECT 
				AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))) as avg_duration
			FROM sessions
			WHERE website_id = $1 AND start_time >= $2
		)
		SELECT 
			COALESCE(new_visitors, 0),
			COALESCE(returning_visitors, 0),
			COALESCE(avg_duration, 0)
		FROM period_stats, session_stats
	`

	var insights models.VisitorInsights
	insights.WebsiteID = websiteID
	insights.DateRange = days

	err := r.db.QueryRow(ctx, query, websiteID, startDate).Scan(
		&insights.NewVisitors,
		&insights.ReturningVisitors,
		&insights.AverageSessionDuration,
	)

	if err != nil {
		// Log error but generally return zeroed struct if query fails
		// (e.g., table doesn't exist or logic error)
		return &models.VisitorInsights{WebsiteID: websiteID, DateRange: days}, nil
	}

	total := insights.NewVisitors + insights.ReturningVisitors
	if total > 0 {
		insights.NewVisitorPercentage = float64(insights.NewVisitors) / float64(total) * 100
		insights.ReturningVisitorPercentage = float64(insights.ReturningVisitors) / float64(total) * 100
	}

	return &insights, nil
}
