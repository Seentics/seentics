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
		WITH period_visitors AS (
			SELECT DISTINCT visitor_id
			FROM events
			WHERE website_id = $1 AND timestamp >= $2
		),
		visitor_history AS (
			SELECT 
				pv.visitor_id,
				EXISTS (
					SELECT 1 FROM events e2 
					WHERE e2.website_id = $1 
					AND e2.visitor_id = pv.visitor_id 
					AND e2.timestamp < $2
					LIMIT 1
				) as is_returning
			FROM period_visitors pv
		),
		period_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE NOT is_returning) as new_visitors,
				COUNT(*) FILTER (WHERE is_returning) as returning_visitors
			FROM visitor_history
		),
		session_stats AS (
			SELECT 
				AVG(session_duration) as avg_duration
			FROM (
				SELECT 
					session_id,
					CASE 
						WHEN COUNT(*) > 1 THEN 
							LEAST(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 14400)
						ELSE 30
					END as session_duration
				FROM events
				WHERE website_id = $1 AND timestamp >= $2
				GROUP BY session_id
			) s
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

	// Fetch Top Entry Pages
	entryQuery := `
		WITH session_pages AS (
			SELECT 
				session_id,
				page,
				ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp ASC) as visit_order,
				COUNT(*) OVER (PARTITION BY session_id) as total_pages
			FROM events
			WHERE website_id = $1 AND timestamp >= $2 AND event_type = 'pageview'
		)
		SELECT 
			page,
			COUNT(*) as sessions,
			COALESCE(
				(COUNT(*) FILTER (WHERE total_pages = 1) * 100.0) / NULLIF(COUNT(*), 0), 
				0
			) as bounce_rate
		FROM session_pages
		WHERE visit_order = 1
		GROUP BY page
		ORDER BY sessions DESC
		LIMIT 10`

	entryRows, err := r.db.Query(ctx, entryQuery, websiteID, startDate)
	if err == nil {
		defer entryRows.Close()
		for entryRows.Next() {
			var stat models.PageInsightStat
			if err := entryRows.Scan(&stat.Page, &stat.Sessions, &stat.BounceRate); err == nil {
				insights.TopEntryPages = append(insights.TopEntryPages, stat)
			}
		}
	}

	// Fetch Top Exit Pages
	exitQuery := `
		WITH session_stats AS (
			SELECT 
				session_id,
				page,
				ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp DESC) as visit_order_desc
			FROM events
			WHERE website_id = $1 AND timestamp >= $2 AND event_type = 'pageview'
		),
		exit_counts AS (
			SELECT page, COUNT(*) as exit_sessions
			FROM session_stats
			WHERE visit_order_desc = 1
			GROUP BY page
		),
		total_page_views AS (
			SELECT page, COUNT(*) as total_views
			FROM events
			WHERE website_id = $1 AND timestamp >= $2 AND event_type = 'pageview'
			GROUP BY page
		)
		SELECT 
			ec.page,
			ec.exit_sessions,
			(ec.exit_sessions * 100.0 / NULLIF(tpv.total_views, 0)) as exit_rate
		FROM exit_counts ec
		JOIN total_page_views tpv ON ec.page = tpv.page
		ORDER BY ec.exit_sessions DESC
		LIMIT 10`

	exitRows, err := r.db.Query(ctx, exitQuery, websiteID, startDate)
	if err == nil {
		defer exitRows.Close()
		for exitRows.Next() {
			var stat models.PageInsightStat
			var exitRate float64
			if err := exitRows.Scan(&stat.Page, &stat.Sessions, &exitRate); err == nil {
				stat.ExitRate = &exitRate
				insights.TopExitPages = append(insights.TopExitPages, stat)
			}
		}
	}

	return &insights, nil
}
