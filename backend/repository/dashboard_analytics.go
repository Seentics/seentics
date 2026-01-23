package repository

import (
	"analytics-app/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardAnalytics struct {
	db *pgxpool.Pool
}

func NewDashboardAnalytics(db *pgxpool.Pool) *DashboardAnalytics {
	return &DashboardAnalytics{db: db}
}

// GetDashboardMetrics returns the main dashboard metrics for a website
func (da *DashboardAnalytics) GetDashboardMetrics(ctx context.Context, websiteID string, days int) (*models.DashboardMetrics, error) {
	query := `
		WITH session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count,
				-- Calculate session duration with realistic limits
				CASE 
					WHEN COUNT(*) > 1 THEN 
						-- Cap session duration at 30 minutes (1800 seconds) for realistic analytics
						LEAST(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 1800)
					ELSE 
						-- For single-page sessions, use time_on_page if available, otherwise 30 seconds
						COALESCE(MAX(time_on_page), 30)
				END as session_duration
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2
			AND event_type = 'pageview'
			GROUP BY session_id
		)
		SELECT 
			-- Page views (total pageview events)
			COUNT(*) as page_views,
			-- Total visitors (total number of visits/sessions)
			COUNT(DISTINCT e.session_id) as total_visitors,
			-- Unique visitors (distinct visitor_ids)
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			-- Sessions (distinct session_ids)
			COUNT(DISTINCT e.session_id) as sessions,
			-- Bounce rate (sessions with only 1 pageview)
			COALESCE(
				(COUNT(DISTINCT CASE WHEN s.page_count = 1 THEN e.session_id END) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate,
			-- Average session duration in seconds
			COALESCE(AVG(s.session_duration), 0) as avg_session_time,
			-- Pages per session
			COALESCE(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT e.session_id), 0), 0) as pages_per_session
		FROM events e
		INNER JOIN session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
		AND e.event_type = 'pageview'`

	var metrics models.DashboardMetrics
	err := da.db.QueryRow(ctx, query, websiteID, days).Scan(
		&metrics.PageViews, &metrics.TotalVisitors, &metrics.UniqueVisitors, &metrics.Sessions,
		&metrics.BounceRate, &metrics.AvgSessionTime, &metrics.PagesPerSession,
	)

	if err != nil {
		return nil, err
	}

	// Ensure bounce rate is reasonable (0-100%)
	if metrics.BounceRate > 100.0 {
		metrics.BounceRate = 100.0
	}
	if metrics.BounceRate < 0.0 {
		metrics.BounceRate = 0.0
	}

	return &metrics, nil
}

// GetComparisonMetrics returns comparison metrics between current and previous periods
func (da *DashboardAnalytics) GetComparisonMetrics(ctx context.Context, websiteID string, days int) (*models.ComparisonMetrics, error) {
	// Get current period metrics
	currentQuery := `
		WITH current_session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count,
				CASE 
					WHEN COUNT(*) > 1 THEN 
						-- Cap session duration at 30 minutes (1800 seconds) for realistic analytics
						LEAST(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 1800)
					ELSE 
						-- For single-page sessions, use time_on_page if available, otherwise 30 seconds
						COALESCE(MAX(time_on_page), 30)
				END as session_duration
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2
			AND event_type = 'pageview'
			GROUP BY session_id
		)
		SELECT 
			COUNT(*) as page_views,
			COUNT(DISTINCT e.session_id) as total_visitors,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COUNT(DISTINCT e.session_id) as sessions,
			COALESCE(
				(COUNT(DISTINCT CASE WHEN s.page_count = 1 THEN e.session_id END) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate,
			COALESCE(AVG(s.session_duration), 0) as avg_session_time
		FROM events e
		INNER JOIN current_session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
		AND e.event_type = 'pageview'`

	// Get previous period metrics
	previousQuery := `
		WITH previous_session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count,
				CASE 
					WHEN COUNT(*) > 1 THEN 
						-- Cap session duration at 30 minutes (1800 seconds) for realistic analytics
						LEAST(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 1800)
					ELSE 
						-- For single-page sessions, use time_on_page if available, otherwise 30 seconds
						COALESCE(MAX(time_on_page), 30)
				END as session_duration
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2
			AND timestamp < NOW() - INTERVAL '1 day' * $3
			AND event_type = 'pageview'
			GROUP BY session_id
		)
		SELECT 
			COUNT(*) as page_views,
			COUNT(DISTINCT e.session_id) as total_visitors,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COUNT(DISTINCT e.session_id) as sessions,
			COALESCE(
				(COUNT(DISTINCT CASE WHEN s.page_count = 1 THEN e.session_id END) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate,
			COALESCE(AVG(s.session_duration), 0) as avg_session_time
		FROM events e
		INNER JOIN previous_session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
		AND e.timestamp < NOW() - INTERVAL '1 day' * $3
		AND event_type = 'pageview'`

	// Execute current period query
	var current struct {
		PageViews      int     `db:"page_views"`
		TotalVisitors  int     `db:"total_visitors"`
		UniqueVisitors int     `db:"unique_visitors"`
		Sessions       int     `db:"sessions"`
		BounceRate     float64 `db:"bounce_rate"`
		AvgSessionTime float64 `db:"avg_session_time"`
	}

	err := da.db.QueryRow(ctx, currentQuery, websiteID, days).Scan(
		&current.PageViews, &current.TotalVisitors, &current.UniqueVisitors, &current.Sessions,
		&current.BounceRate, &current.AvgSessionTime,
	)
	if err != nil {
		return nil, err
	}

	// Execute previous period query
	var previous struct {
		PageViews      int     `db:"page_views"`
		TotalVisitors  int     `db:"total_visitors"`
		UniqueVisitors int     `db:"unique_visitors"`
		Sessions       int     `db:"sessions"`
		BounceRate     float64 `db:"bounce_rate"`
		AvgSessionTime float64 `db:"avg_session_time"`
	}

	err = da.db.QueryRow(ctx, previousQuery, websiteID, days*2, days).Scan(
		&previous.PageViews, &previous.TotalVisitors, &previous.UniqueVisitors, &previous.Sessions,
		&previous.BounceRate, &previous.AvgSessionTime,
	)
	if err != nil {
		// If no previous data, return zeros for safe calculation
		previous = struct {
			PageViews      int     `db:"page_views"`
			TotalVisitors  int     `db:"total_visitors"`
			UniqueVisitors int     `db:"unique_visitors"`
			Sessions       int     `db:"sessions"`
			BounceRate     float64 `db:"bounce_rate"`
			AvgSessionTime float64 `db:"avg_session_time"`
		}{}
	}

	// Calculate percentage changes with clamping and N/A handling
	minPrevCount := 10
	clamp := func(v float64) float64 {
		if v > 500 {
			return 500
		}
		if v < -500 {
			return -500
		}
		return v
	}

	calcInt := func(curr, prev int) *float64 {
		if prev < minPrevCount || prev == 0 {
			return nil
		}
		val := ((float64(curr) - float64(prev)) / float64(prev)) * 100.0
		c := clamp(val)
		return &c
	}
	calcFloat := func(curr, prev float64, prevCount int) *float64 {
		if prevCount < minPrevCount || prev == 0.0 {
			return nil
		}
		val := ((curr - prev) / prev) * 100.0
		c := clamp(val)
		return &c
	}

	return &models.ComparisonMetrics{
		TotalVisitorChange: calcInt(current.TotalVisitors, previous.TotalVisitors),
		VisitorChange:      calcInt(current.UniqueVisitors, previous.UniqueVisitors),
		PageviewChange:     calcInt(current.PageViews, previous.PageViews),
		SessionChange:      calcInt(current.Sessions, previous.Sessions),
		BounceChange:       calcFloat(current.BounceRate, previous.BounceRate, previous.Sessions),
		DurationChange:     calcFloat(current.AvgSessionTime, previous.AvgSessionTime, previous.Sessions),
	}, nil
}
