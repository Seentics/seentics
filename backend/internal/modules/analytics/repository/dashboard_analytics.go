package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardAnalytics struct {
	db *pgxpool.Pool
}

func NewDashboardAnalytics(db *pgxpool.Pool) *DashboardAnalytics {
	return &DashboardAnalytics{db: db}
}

func (da *DashboardAnalytics) buildFilterClause(filters models.AnalyticsFilters) (string, []interface{}) {
	clause := ""
	params := []interface{}{}
	paramIdx := 3 // Starting from $3 since $1 is website_id and $2 is days

	if filters.Country != "" {
		clause += fmt.Sprintf(" AND country = $%d", paramIdx)
		params = append(params, filters.Country)
		paramIdx++
	}
	if filters.Device != "" && filters.Device != "all" {
		clause += fmt.Sprintf(" AND device = $%d", paramIdx)
		params = append(params, filters.Device)
		paramIdx++
	}
	if filters.Browser != "" {
		clause += fmt.Sprintf(" AND browser = $%d", paramIdx)
		params = append(params, filters.Browser)
		paramIdx++
	}
	if filters.OS != "" {
		clause += fmt.Sprintf(" AND os = $%d", paramIdx)
		params = append(params, filters.OS)
		paramIdx++
	}
	if filters.UTMSource != "" {
		clause += fmt.Sprintf(" AND utm_source = $%d", paramIdx)
		params = append(params, filters.UTMSource)
		paramIdx++
	}
	if filters.UTMMedium != "" {
		clause += fmt.Sprintf(" AND utm_medium = $%d", paramIdx)
		params = append(params, filters.UTMMedium)
		paramIdx++
	}
	if filters.UTMCampaign != "" {
		clause += fmt.Sprintf(" AND utm_campaign = $%d", paramIdx)
		params = append(params, filters.UTMCampaign)
		paramIdx++
	}
	if filters.PagePath != "" {
		clause += fmt.Sprintf(" AND page = $%d", paramIdx)
		params = append(params, filters.PagePath)
		paramIdx++
	}

	return clause, params
}

// GetDashboardMetrics returns the main dashboard metrics for a website
func (da *DashboardAnalytics) GetDashboardMetrics(ctx context.Context, websiteID string, days int, filters models.AnalyticsFilters) (*models.DashboardMetrics, error) {
	filterClause, filterParams := da.buildFilterClause(filters)

	query := fmt.Sprintf(`
		WITH session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count,
				CASE 
					WHEN COUNT(*) > 1 THEN 
						LEAST(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 1800)
					ELSE 
						COALESCE(MAX(time_on_page), 30)
				END as session_duration
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2
			AND event_type = 'pageview'
			%s
			GROUP BY session_id
		)
		SELECT 
			COUNT(*) as page_views,
			COUNT(DISTINCT e.visitor_id) as total_visitors,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COUNT(DISTINCT e.session_id) as sessions,
			COALESCE(
				(COUNT(DISTINCT CASE WHEN s.page_count = 1 THEN e.session_id END) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate,
			COALESCE(AVG(s.session_duration), 0) as avg_session_time,
			COALESCE(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT e.session_id), 0), 0) as pages_per_session
		FROM events e
		INNER JOIN session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
		AND e.event_type = 'pageview'
		%s`, filterClause, filterClause)

	var metrics models.DashboardMetrics
	allParams := append([]interface{}{websiteID, days}, filterParams...)
	err := da.db.QueryRow(ctx, query, allParams...).Scan(
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
func (da *DashboardAnalytics) GetComparisonMetrics(ctx context.Context, websiteID string, days int, filters models.AnalyticsFilters) (*models.ComparisonMetrics, error) {
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
			COUNT(DISTINCT e.visitor_id) as total_visitors,
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
			COUNT(DISTINCT e.visitor_id) as total_visitors,
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
	clamp := func(v float64) float64 {
		if v > 1000 { // Increased from 500 for better growth visibility
			return 1000
		}
		if v < -100 { // Cannot decrease more than 100%
			return -100
		}
		return v
	}

	calcInt := func(curr, prev int) *float64 {
		if prev <= 0 {
			// If it's the first data point, we return nil (UI can show "New" or N/A)
			return nil
		}
		val := ((float64(curr) - float64(prev)) / float64(prev)) * 100.0
		c := clamp(val)
		return &c
	}
	calcFloat := func(curr, prev float64, prevCount int) *float64 {
		if prevCount <= 0 || prev <= 0 {
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
