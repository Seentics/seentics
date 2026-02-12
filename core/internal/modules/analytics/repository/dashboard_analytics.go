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
				MAX(visitor_id) as visitor_id,
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
			%s
			GROUP BY session_id
		)
		SELECT 
			COALESCE(SUM(page_count), 0) as page_views,
			COUNT(*) as total_visitors,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as sessions,
			COALESCE(
				(COUNT(*) FILTER (WHERE page_count = 1) * 100.0) / 
				NULLIF(COUNT(*), 0), 0
			) as bounce_rate,
			COALESCE(AVG(session_duration), 0) as avg_session_time,
			COALESCE(SUM(page_count) * 1.0 / NULLIF(COUNT(*), 0), 0) as pages_per_session
		FROM session_stats`, filterClause)

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
	filterClause, filterParams := da.buildFilterClause(filters)

	// Combine current and previous period queries into one for performance
	combinedQuery := fmt.Sprintf(`
		WITH period_stats AS (
			SELECT 
				CASE 
					WHEN timestamp >= NOW() - INTERVAL '1 day' * $2 THEN 1 -- current
					ELSE 2 -- previous
				END as period,
				session_id,
				MAX(visitor_id) as visitor_id,
				COUNT(*) as page_count,
				CASE 
					WHEN COUNT(*) > 1 THEN 
						LEAST(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 1800)
					ELSE 
						COALESCE(MAX(time_on_page), 30)
				END as session_duration
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * ($2 * 2)
			AND event_type = 'pageview'
			%s
			GROUP BY 1, 2
		)
		SELECT 
			period,
			COALESCE(SUM(page_count), 0) as page_views,
			COUNT(*) as total_visitors,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as sessions,
			COALESCE((COUNT(*) FILTER (WHERE page_count = 1) * 100.0) / NULLIF(COUNT(*), 0), 0) as bounce_rate,
			COALESCE(AVG(session_duration), 0) as avg_session_time
		FROM period_stats
		GROUP BY period
		ORDER BY period ASC`, filterClause)

	type periodResult struct {
		Period         int
		PageViews      int
		TotalVisitors  int
		UniqueVisitors int
		Sessions       int
		BounceRate     float64
		AvgSessionTime float64
	}

	results := make(map[int]periodResult)
	allParams := append([]interface{}{websiteID, days}, filterParams...)

	rows, err := da.db.Query(ctx, combinedQuery, allParams...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var r periodResult
		if err := rows.Scan(&r.Period, &r.PageViews, &r.TotalVisitors, &r.UniqueVisitors, &r.Sessions, &r.BounceRate, &r.AvgSessionTime); err != nil {
			return nil, err
		}
		results[r.Period] = r
	}

	current := results[1]
	previous := results[2]

	// Calculate percentage changes with clamping and N/A handling
	clamp := func(v float64) float64 {
		if v > 1000 {
			return 1000
		}
		if v < -100 {
			return -100
		}
		return v
	}

	calcInt := func(curr, prev int) *float64 {
		if prev <= 0 {
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

	// Calculate pages per session for both periods
	currentPagesPerSession := 0.0
	if current.Sessions > 0 {
		currentPagesPerSession = float64(current.PageViews) / float64(current.Sessions)
	}
	previousPagesPerSession := 0.0
	if previous.Sessions > 0 {
		previousPagesPerSession = float64(previous.PageViews) / float64(previous.Sessions)
	}

	return &models.ComparisonMetrics{
		CurrentPeriod: models.DashboardMetrics{
			PageViews:       current.PageViews,
			TotalVisitors:   current.TotalVisitors,
			UniqueVisitors:  current.UniqueVisitors,
			Sessions:        current.Sessions,
			BounceRate:      current.BounceRate,
			AvgSessionTime:  current.AvgSessionTime,
			PagesPerSession: currentPagesPerSession,
		},
		PreviousPeriod: models.DashboardMetrics{
			PageViews:       previous.PageViews,
			TotalVisitors:   previous.TotalVisitors,
			UniqueVisitors:  previous.UniqueVisitors,
			Sessions:        previous.Sessions,
			BounceRate:      previous.BounceRate,
			AvgSessionTime:  previous.AvgSessionTime,
			PagesPerSession: previousPagesPerSession,
		},
		TotalVisitorChange: calcInt(current.TotalVisitors, previous.TotalVisitors),
		VisitorChange:      calcInt(current.UniqueVisitors, previous.UniqueVisitors),
		PageviewChange:     calcInt(current.PageViews, previous.PageViews),
		SessionChange:      calcInt(current.Sessions, previous.Sessions),
		BounceChange:       calcFloat(current.BounceRate, previous.BounceRate, previous.Sessions),
		DurationChange:     calcFloat(current.AvgSessionTime, previous.AvgSessionTime, previous.Sessions),
	}, nil
}
