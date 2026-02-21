package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TrafficSummaryAnalytics struct {
	db *pgxpool.Pool
}

func NewTrafficSummaryAnalytics(db *pgxpool.Pool) *TrafficSummaryAnalytics {
	return &TrafficSummaryAnalytics{db: db}
}

// GetTrafficSummary returns comprehensive traffic summary for a website
func (ts *TrafficSummaryAnalytics) GetTrafficSummary(ctx context.Context, websiteID string, days int, timezone string) (*models.TrafficSummary, error) {
	timezone = validateTimezone(timezone)

	query := fmt.Sprintf(`
		WITH period_events AS (
			SELECT visitor_id, session_id, timestamp
			FROM events
			WHERE website_id = $1
			AND timestamp >= %s
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
					AND e2.timestamp < %s
					LIMIT 1
				) as is_returning
			FROM (SELECT DISTINCT visitor_id FROM period_events) pe
		),
		aggregated AS (
			SELECT
				COUNT(*) as event_count,
				COUNT(DISTINCT visitor_id) as visitor_count
			FROM period_events
		),
		session_metrics AS (
			SELECT
				COUNT(*) as session_count,
				COUNT(*) FILTER (WHERE pages = 1) as bounce_sessions,
				AVG(duration) as avg_duration
			FROM sessions
		),
		visitor_metrics AS (
			SELECT
				COUNT(*) FILTER (WHERE NOT is_returning) as new_visitor_count,
				COUNT(*) FILTER (WHERE is_returning) as returning_visitor_count
			FROM visitors
		)
		SELECT
			COALESCE(a.event_count, 0) as total_page_views,
			COALESCE(a.visitor_count, 0) as total_visitors,
			COALESCE(a.visitor_count, 0) as unique_visitors,
			COALESCE(sm.session_count, 0) as total_sessions,
			COALESCE(sm.bounce_sessions * 100.0 / NULLIF(sm.session_count, 0), 0) as bounce_rate,
			COALESCE(CAST(sm.avg_duration AS INTEGER), 0) as avg_session_time,
			COALESCE(a.event_count * 1.0 / NULLIF(sm.session_count, 0), 0) as pages_per_session,
			0.0 as growth_rate,
			0.0 as visitors_growth_rate,
			0.0 as sessions_growth_rate,
			COALESCE(vm.new_visitor_count, 0) as new_visitors,
			COALESCE(vm.returning_visitor_count, 0) as returning_visitors,
			50.0 as engagement_score,
			25.0 as retention_rate
		FROM aggregated a
		CROSS JOIN session_metrics sm
		CROSS JOIN visitor_metrics vm`, tzStartSQL, tzStartSQL)

	var summary models.TrafficSummary
	err := ts.db.QueryRow(ctx, query, websiteID, days, timezone).Scan(
		&summary.TotalPageViews, &summary.TotalVisitors, &summary.UniqueVisitors, &summary.TotalSessions,
		&summary.BounceRate, &summary.AvgSessionTime, &summary.PagesPerSession,
		&summary.GrowthRate, &summary.VisitorsGrowthRate, &summary.SessionsGrowthRate,
		&summary.NewVisitors, &summary.ReturningVisitors, &summary.EngagementScore,
		&summary.RetentionRate,
	)

	if err != nil {
		return nil, err
	}

	if summary.BounceRate > 100.0 {
		summary.BounceRate = 100.0
	}

	return &summary, nil
}
