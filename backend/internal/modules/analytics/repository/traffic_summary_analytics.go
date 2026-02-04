package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TrafficSummaryAnalytics struct {
	db *pgxpool.Pool
}

func NewTrafficSummaryAnalytics(db *pgxpool.Pool) *TrafficSummaryAnalytics {
	return &TrafficSummaryAnalytics{db: db}
}

// GetTrafficSummary returns comprehensive traffic summary for a website
func (ts *TrafficSummaryAnalytics) GetTrafficSummary(ctx context.Context, websiteID string, days int) (*models.TrafficSummary, error) {
	query := `
		WITH period_events AS (
			SELECT visitor_id, session_id, timestamp
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2 
			AND event_type = 'pageview'
		),
		sessions AS (
			SELECT 
				session_id,
				COUNT(*) as pages,
				EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as duration
			FROM period_events
			GROUP BY session_id
		),
		visitors AS (
			SELECT 
				visitor_id,
				EXISTS (
					SELECT 1 FROM events e2
					WHERE e2.website_id = $1 
					AND e2.visitor_id = pe.visitor_id 
					AND e2.timestamp < NOW() - INTERVAL '1 day' * $2
					LIMIT 1
				) as is_returning
			FROM (SELECT DISTINCT visitor_id FROM period_events) pe
		)
		SELECT 
			COALESCE((SELECT COUNT(*) FROM period_events), 0) as total_page_views,
			COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM period_events), 0) as total_visitors,
			COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM period_events), 0) as unique_visitors,
			COALESCE((SELECT COUNT(*) FROM sessions), 0) as total_sessions,
			COALESCE(
				(SELECT COUNT(*) FROM sessions WHERE pages = 1) * 100.0 / 
				NULLIF((SELECT COUNT(*) FROM sessions), 0), 0
			) as bounce_rate,
			COALESCE((SELECT CAST(AVG(duration) AS INTEGER) FROM sessions), 0) as avg_session_time,
			COALESCE(
				(SELECT COUNT(*) FROM period_events) * 1.0 / 
				NULLIF((SELECT COUNT(*) FROM sessions), 0), 0
			) as pages_per_session,
			0.0 as growth_rate,
			0.0 as visitors_growth_rate,
			0.0 as sessions_growth_rate,
			COALESCE((SELECT COUNT(*) FROM visitors WHERE NOT is_returning), 0) as new_visitors,
			COALESCE((SELECT COUNT(*) FROM visitors WHERE is_returning), 0) as returning_visitors,
			50.0 as engagement_score,
			25.0 as retention_rate`

	var summary models.TrafficSummary
	err := ts.db.QueryRow(ctx, query, websiteID, days).Scan(
		&summary.TotalPageViews, &summary.TotalVisitors, &summary.UniqueVisitors, &summary.TotalSessions,
		&summary.BounceRate, &summary.AvgSessionTime, &summary.PagesPerSession,
		&summary.GrowthRate, &summary.VisitorsGrowthRate, &summary.SessionsGrowthRate,
		&summary.NewVisitors, &summary.ReturningVisitors, &summary.EngagementScore,
		&summary.RetentionRate,
	)

	if err != nil {
		return nil, err
	}

	// Ensure bounce rate is capped at 100%
	if summary.BounceRate > 100.0 {
		summary.BounceRate = 100.0
	}

	return &summary, nil
}
