package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/rs/zerolog"
)

type ClickHouseAnalyticsRepository struct {
	conn   driver.Conn
	pg     MainAnalyticsRepository
	logger zerolog.Logger
}

func NewClickHouseAnalyticsRepository(conn driver.Conn, pg MainAnalyticsRepository, logger zerolog.Logger) *ClickHouseAnalyticsRepository {
	return &ClickHouseAnalyticsRepository{
		conn:   conn,
		pg:     pg,
		logger: logger,
	}
}

func (r *ClickHouseAnalyticsRepository) buildFilterClause(filters models.AnalyticsFilters) (string, []interface{}) {
	var clauses []string
	var params []interface{}

	if filters.Country != "" {
		clauses = append(clauses, "country = ?")
		params = append(params, filters.Country)
	}
	if filters.Device != "" && filters.Device != "all" {
		clauses = append(clauses, "device = ?")
		params = append(params, filters.Device)
	}
	if filters.Browser != "" {
		clauses = append(clauses, "browser = ?")
		params = append(params, filters.Browser)
	}
	if filters.OS != "" {
		clauses = append(clauses, "os = ?")
		params = append(params, filters.OS)
	}
	if filters.UTMSource != "" {
		clauses = append(clauses, "utm_source = ?")
		params = append(params, filters.UTMSource)
	}
	if filters.UTMMedium != "" {
		clauses = append(clauses, "utm_medium = ?")
		params = append(params, filters.UTMMedium)
	}
	if filters.UTMCampaign != "" {
		clauses = append(clauses, "utm_campaign = ?")
		params = append(params, filters.UTMCampaign)
	}
	if filters.PagePath != "" {
		clauses = append(clauses, "page = ?")
		params = append(params, filters.PagePath)
	}

	clause := ""
	if len(clauses) > 0 {
		clause = " AND " + strings.Join(clauses, " AND ")
	}

	return clause, params
}

// GetDashboardMetrics returns the main dashboard metrics for a website from ClickHouse
func (r *ClickHouseAnalyticsRepository) GetDashboardMetrics(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) (*models.DashboardMetrics, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		WITH session_stats AS (
			SELECT 
				session_id,
				any(visitor_id) as visitor_id,
				count(*) as page_count,
				if(count(*) > 1, 
					least(dateDiff('second', min(timestamp), max(timestamp)), 1800),
					any(time_on_page)
				) as session_duration
			FROM events
			WHERE website_id = ? 
			AND timestamp >= now() - interval ? day
			AND event_type = 'pageview'
			%s
			GROUP BY session_id
		)
		SELECT 
			COALESCE(SUM(page_count), 0) as page_views,
			COUNT(DISTINCT session_id) as total_visitors, -- seentics uses total_visitors for sessions
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(DISTINCT session_id) as sessions,
			COALESCE(
				(countIf(page_count = 1) * 100.0) / 
				NULLIF(COUNT(*), 0), 0
			) as bounce_rate,
			COALESCE(AVG(session_duration), 0) as avg_session_time,
			COALESCE(SUM(page_count) * 1.0 / NULLIF(COUNT(*), 0), 0) as pages_per_session
		FROM session_stats`, filterClause)

	var metrics models.DashboardMetrics
	args := append([]interface{}{websiteID, days}, filterParams...)

	var pageViews, totalVisitors, uniqueVisitors, sessions uint64
	err := r.conn.QueryRow(ctx, query, args...).Scan(
		&pageViews, &totalVisitors, &uniqueVisitors, &sessions,
		&metrics.BounceRate, &metrics.AvgSessionTime, &metrics.PagesPerSession,
	)
	if err != nil {
		r.logger.Error().Err(err).Msg("ClickHouse Dashboard metrics query failed")
		return nil, err
	}
	metrics.PageViews = int(pageViews)
	metrics.TotalVisitors = int(totalVisitors)
	metrics.UniqueVisitors = int(uniqueVisitors)
	metrics.Sessions = int(sessions)

	return &metrics, nil
}

// GetComparisonMetrics returns comparison metrics from ClickHouse
func (r *ClickHouseAnalyticsRepository) GetComparisonMetrics(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) (*models.ComparisonMetrics, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		WITH period_stats AS (
			SELECT 
				if(timestamp >= now() - interval ? day, 1, 2) as period,
				session_id,
				any(visitor_id) as visitor_id,
				count(*) as page_count,
				if(count(*) > 1, 
					least(dateDiff('second', min(timestamp), max(timestamp)), 1800),
					any(time_on_page)
				) as session_duration
			FROM events
			WHERE website_id = ? 
			AND timestamp >= now() - interval ? day
			AND event_type = 'pageview'
			%s
			GROUP BY period, session_id
		)
		SELECT 
			period,
			COALESCE(SUM(page_count), 0) as page_views,
			COUNT(DISTINCT session_id) as total_visitors,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(DISTINCT session_id) as sessions,
			COALESCE((countIf(page_count = 1) * 100.0) / NULLIF(COUNT(*), 0), 0) as bounce_rate,
			COALESCE(AVG(session_duration), 0) as avg_session_time
		FROM period_stats
		GROUP BY period
		ORDER BY period ASC`, filterClause)

	type periodResult struct {
		Period         uint8
		PageViews      uint64
		TotalVisitors  uint64
		UniqueVisitors uint64
		Sessions       uint64
		BounceRate     float64
		AvgSessionTime float64
	}

	results := make(map[int]periodResult)
	args := append([]interface{}{days, websiteID, days * 2}, filterParams...)

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var r periodResult
		if err := rows.Scan(&r.Period, &r.PageViews, &r.TotalVisitors, &r.UniqueVisitors, &r.Sessions, &r.BounceRate, &r.AvgSessionTime); err != nil {
			return nil, err
		}
		results[int(r.Period)] = r
	}

	current := results[1]
	previous := results[2]

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
			PageViews:       int(current.PageViews),
			TotalVisitors:   int(current.TotalVisitors),
			UniqueVisitors:  int(current.UniqueVisitors),
			Sessions:        int(current.Sessions),
			BounceRate:      current.BounceRate,
			AvgSessionTime:  current.AvgSessionTime,
			PagesPerSession: currentPagesPerSession,
		},
		PreviousPeriod: models.DashboardMetrics{
			PageViews:       int(previous.PageViews),
			TotalVisitors:   int(previous.TotalVisitors),
			UniqueVisitors:  int(previous.UniqueVisitors),
			Sessions:        int(previous.Sessions),
			BounceRate:      previous.BounceRate,
			AvgSessionTime:  previous.AvgSessionTime,
			PagesPerSession: previousPagesPerSession,
		},
		TotalVisitorChange: calcInt(int(current.TotalVisitors), int(previous.TotalVisitors)),
		VisitorChange:      calcInt(int(current.UniqueVisitors), int(previous.UniqueVisitors)),
		PageviewChange:     calcInt(int(current.PageViews), int(previous.PageViews)),
		SessionChange:      calcInt(int(current.Sessions), int(previous.Sessions)),
		BounceChange:       calcFloat(current.BounceRate, previous.BounceRate, int(previous.Sessions)),
		DurationChange:     calcFloat(current.AvgSessionTime, previous.AvgSessionTime, int(previous.Sessions)),
	}, nil
}

// GetUTMAnalytics returns UTM metrics from ClickHouse
func (r *ClickHouseAnalyticsRepository) GetUTMAnalytics(ctx context.Context, websiteID string, days int) (map[string]interface{}, error) {
	query := `
		SELECT 
			COALESCE(utm_source, 'direct') as source,
			COALESCE(utm_medium, 'none') as medium,
			COALESCE(utm_campaign, 'none') as campaign,
			COUNT(*) as visits,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY utm_source, utm_medium, utm_campaign
		ORDER BY visits DESC`

	rows, err := r.conn.Query(ctx, query, websiteID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	breakdown := map[string]interface{}{
		"sources":   make([]map[string]interface{}, 0),
		"mediums":   make([]map[string]interface{}, 0),
		"campaigns": make([]map[string]interface{}, 0),
	}

	sourceMap := make(map[string]map[string]interface{})
	mediumMap := make(map[string]map[string]interface{})
	campaignMap := make(map[string]map[string]interface{})

	for rows.Next() {
		var source, medium, campaign string
		var visits, uniqueVisitors uint64
		if err := rows.Scan(&source, &medium, &campaign, &visits, &uniqueVisitors); err != nil {
			continue
		}

		if s, ok := sourceMap[source]; ok {
			s["visits"] = s["visits"].(uint64) + visits
			s["unique_visitors"] = s["unique_visitors"].(uint64) + uniqueVisitors
		} else {
			sourceMap[source] = map[string]interface{}{"source": source, "visits": visits, "unique_visitors": uniqueVisitors}
		}

		if m, ok := mediumMap[medium]; ok {
			m["visits"] = m["visits"].(uint64) + visits
			m["unique_visitors"] = m["unique_visitors"].(uint64) + uniqueVisitors
		} else {
			mediumMap[medium] = map[string]interface{}{"medium": medium, "visits": visits, "unique_visitors": uniqueVisitors}
		}

		if c, ok := campaignMap[campaign]; ok {
			c["visits"] = c["visits"].(uint64) + visits
			c["unique_visitors"] = c["unique_visitors"].(uint64) + uniqueVisitors
		} else {
			campaignMap[campaign] = map[string]interface{}{"campaign": campaign, "visits": visits, "unique_visitors": uniqueVisitors}
		}
	}

	for _, v := range sourceMap {
		breakdown["sources"] = append(breakdown["sources"].([]map[string]interface{}), v)
	}
	for _, v := range mediumMap {
		breakdown["mediums"] = append(breakdown["mediums"].([]map[string]interface{}), v)
	}
	for _, v := range campaignMap {
		breakdown["campaigns"] = append(breakdown["campaigns"].([]map[string]interface{}), v)
	}

	return breakdown, nil
}

// GetTopPages returns top pages from ClickHouse
func (r *ClickHouseAnalyticsRepository) GetTopPages(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.PageStat, error) {
	query := `
		SELECT 
			page,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COALESCE(avg(time_on_page), 0) as avg_time
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY page
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []models.PageStat
	for rows.Next() {
		var p models.PageStat
		var views, unique uint64
		var avgTime float64
		if err := rows.Scan(&p.Page, &views, &unique, &avgTime); err != nil {
			continue
		}
		p.Views = int(views)
		p.Unique = int(unique)
		p.AvgTime = &avgTime
		pages = append(pages, p)
	}

	return pages, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopPagesWithTimeBucket(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.PageStat, error) {
	return r.GetTopPages(ctx, websiteID, days, timezone, limit)
}

func (r *ClickHouseAnalyticsRepository) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int) (map[string]interface{}, error) {
	// Simplified version of UTM breakdown for a specific page
	query := `
		SELECT 
			COALESCE(utm_source, 'direct') as source,
			COUNT(*) as visits
		FROM events
		WHERE website_id = ? 
		AND page = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY utm_source
		ORDER BY visits DESC`

	rows, err := r.conn.Query(ctx, query, websiteID, pagePath, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sources := make([]map[string]interface{}, 0)
	for rows.Next() {
		var source string
		var visits uint64
		if err := rows.Scan(&source, &visits); err != nil {
			continue
		}
		sources = append(sources, map[string]interface{}{"source": source, "visits": visits})
	}

	return map[string]interface{}{"sources": sources}, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopReferrers(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.ReferrerStat, error) {
	query := `
		SELECT 
			COALESCE(referrer, 'direct') as referrer,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY referrer
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var referrers []models.ReferrerStat
	for rows.Next() {
		var ref models.ReferrerStat
		var views, unique uint64
		if err := rows.Scan(&ref.Referrer, &views, &unique); err != nil {
			continue
		}
		ref.Views = int(views)
		ref.Unique = int(unique)
		referrers = append(referrers, ref)
	}
	return referrers, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopSources(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.SourceStat, error) {
	query := `
		SELECT 
			COALESCE(utm_source, 'direct') as source,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY source
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sources []models.SourceStat
	for rows.Next() {
		var s models.SourceStat
		var views, unique uint64
		if err := rows.Scan(&s.Source, &views, &unique); err != nil {
			continue
		}
		s.Views = int(views)
		s.UniqueVisitors = int(unique)
		sources = append(sources, s)
	}
	return sources, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopCountries(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.CountryStat, error) {
	query := `
		SELECT 
			COALESCE(country, 'Unknown') as country,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY country
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.CountryStat
	for rows.Next() {
		var s models.CountryStat
		var views, unique uint64
		if err := rows.Scan(&s.Country, &views, &unique); err != nil {
			continue
		}
		s.Views = int(views)
		s.Unique = int(unique)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopBrowsers(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.BrowserStat, error) {
	query := `
		SELECT 
			COALESCE(browser, 'Unknown') as browser,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY browser
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.BrowserStat
	for rows.Next() {
		var s models.BrowserStat
		var views, unique uint64
		if err := rows.Scan(&s.Browser, &views, &unique); err != nil {
			continue
		}
		s.Views = int(views)
		s.Unique = int(unique)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopDevices(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.DeviceStat, error) {
	query := `
		SELECT 
			COALESCE(device, 'Unknown') as device,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY device
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.DeviceStat
	for rows.Next() {
		var s models.DeviceStat
		var views, unique uint64
		if err := rows.Scan(&s.Device, &views, &unique); err != nil {
			continue
		}
		s.Views = int(views)
		s.Unique = int(unique)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopOS(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.OSStat, error) {
	query := `
		SELECT 
			COALESCE(os, 'Unknown') as os,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY os
		ORDER BY views DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.OSStat
	for rows.Next() {
		var s models.OSStat
		var views, unique uint64
		if err := rows.Scan(&s.OS, &views, &unique); err != nil {
			continue
		}
		s.Views = int(views)
		s.Unique = int(unique)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetTrafficSummary(ctx context.Context, websiteID string, days int, timezone string) (*models.TrafficSummary, error) {
	// Direct implementation in ClickHouse
	query := `
		SELECT 
			count(*) as total_page_views,
			count(DISTINCT visitor_id) as total_visitors,
			count(DISTINCT visitor_id) as unique_visitors,
			count(DISTINCT session_id) as total_sessions,
			(countIf(page_count = 1) * 100.0 / count(DISTINCT session_id)) as bounce_rate,
			avg(session_duration) as avg_session_time,
			(count(*) / count(DISTINCT session_id)) as pages_per_session
		FROM (
			SELECT 
				session_id,
				visitor_id,
				count(*) as page_count,
				max(timestamp) - min(timestamp) as session_duration
			FROM events
			WHERE website_id = ? 
			AND timestamp >= now() - interval ? day
			AND event_type = 'pageview'
			GROUP BY session_id, visitor_id
		)`

	var summary models.TrafficSummary
	err := r.conn.QueryRow(ctx, query, websiteID, days).Scan(
		&summary.TotalPageViews, &summary.TotalVisitors, &summary.UniqueVisitors, &summary.TotalSessions,
		&summary.BounceRate, &summary.AvgSessionTime, &summary.PagesPerSession,
	)

	if err != nil {
		return nil, err
	}

	return &summary, nil
}

func (r *ClickHouseAnalyticsRepository) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.DailyStat, error) {
	query := `
		SELECT 
			formatDateTime(toStartOfDay(timestamp, ?), '%Y-%m-%d') as date,
			count(*) as views,
			count(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY date
		ORDER BY date ASC`

	rows, err := r.conn.Query(ctx, query, timezone, websiteID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.DailyStat
	for rows.Next() {
		var s models.DailyStat
		var views, unique uint64
		if err := rows.Scan(&s.Date, &views, &unique); err != nil {
			continue
		}
		s.Views = int(views)
		s.Unique = int(unique)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.HourlyStat, error) {
	query := `
		SELECT 
			formatDateTime(toStartOfHour(timestamp, ?), '%Y-%m-%d %H:00:00') as hour,
			count(*) as views,
			count(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		GROUP BY hour
		ORDER BY hour ASC`

	rows, err := r.conn.Query(ctx, query, timezone, websiteID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.HourlyStat
	for rows.Next() {
		var s models.HourlyStat
		var hourStr string
		var views, unique uint64
		if err := rows.Scan(&hourStr, &views, &unique); err != nil {
			continue
		}
		s.Hour = hourStr
		s.HourLabel = hourStr
		s.Views = int(views)
		s.Unique = int(unique)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetCustomEventStats(ctx context.Context, websiteID string, days int) ([]models.CustomEventStat, error) {
	query := `
		SELECT 
			event_type,
			count(*) as count,
			count(DISTINCT visitor_id) as unique_users
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval ? day
		AND event_type != 'pageview'
		GROUP BY event_type
		ORDER BY count DESC`

	rows, err := r.conn.Query(ctx, query, websiteID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.CustomEventStat
	for rows.Next() {
		var s models.CustomEventStat
		var count, unique uint64
		if err := rows.Scan(&s.EventType, &count, &unique); err != nil {
			continue
		}
		s.Count = int(count)
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *ClickHouseAnalyticsRepository) GetLiveVisitors(ctx context.Context, websiteID string) (int, error) {
	query := `
		SELECT count(DISTINCT visitor_id)
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval 5 minute
		AND event_type = 'pageview'`

	var count uint64
	err := r.conn.QueryRow(ctx, query, websiteID).Scan(&count)
	return int(count), err
}

func (r *ClickHouseAnalyticsRepository) GetTopContinents(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			COALESCE(continent, 'Unknown') as name,
			count(*) as count
		FROM events
		WHERE website_id = ? 
		AND timestamp >= ? AND timestamp <= ?
		AND event_type = 'pageview'
		GROUP BY name
		ORDER BY count DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var count uint64
		if err := rows.Scan(&item.Name, &count); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopRegions(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			COALESCE(region, 'Unknown') as name,
			count(*) as count
		FROM events
		WHERE website_id = ? 
		AND timestamp >= ? AND timestamp <= ?
		AND event_type = 'pageview'
		GROUP BY name
		ORDER BY count DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var count uint64
		if err := rows.Scan(&item.Name, &count); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetGeolocationBreakdown(ctx context.Context, websiteID string, startDate, endDate time.Time) (*models.GeolocationBreakdown, error) {
	// Porting the specific breakdown logic
	g := &models.GeolocationBreakdown{}

	var err error
	g.Countries, err = r.GetTopCountriesByRange(ctx, websiteID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	g.Continents, err = r.GetTopContinents(ctx, websiteID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	return g, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopCountriesByRange(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT
			COALESCE(country, 'Unknown') as name,
			count(DISTINCT visitor_id) as count
		FROM events
		WHERE website_id = ?
		AND timestamp >= ? AND timestamp <= ?
		AND event_type = 'pageview'
		GROUP BY name
		ORDER BY count DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var count uint64
		if err := rows.Scan(&item.Name, &count); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetVisitorInsights(ctx context.Context, websiteID string, days int, timezone string) (*models.VisitorInsights, error) {
	insights := &models.VisitorInsights{
		WebsiteID: websiteID,
		DateRange: days,
	}

	// 1. New vs Returning and Avg Duration
	query := `
		SELECT
			countIf(min_timestamp >= now() - interval ? day) as new_visitors,
			countIf(min_timestamp < now() - interval ? day) as returning_visitors,
			avg(avg_duration) as avg_duration
		FROM (
			SELECT 
				visitor_id, 
				min(timestamp) as min_timestamp,
				max(timestamp) - min(timestamp) as avg_duration
			FROM events
			WHERE website_id = ?
			GROUP BY visitor_id
			HAVING max(timestamp) >= now() - interval ? day
		)`

	var newVisitors, returningVisitors uint64
	err := r.conn.QueryRow(ctx, query, days, days, websiteID, days).Scan(
		&newVisitors, &returningVisitors, &insights.AverageSessionDuration,
	)
	if err != nil {
		r.logger.Warn().Err(err).Msg("Failed to get visitor insights from ClickHouse")
	}
	insights.NewVisitors = int(newVisitors)
	insights.ReturningVisitors = int(returningVisitors)

	total := insights.NewVisitors + insights.ReturningVisitors
	if total > 0 {
		insights.NewVisitorPercentage = float64(insights.NewVisitors) / float64(total) * 100
		insights.ReturningVisitorPercentage = float64(insights.ReturningVisitors) / float64(total) * 100
	}

	// 2. Top Entry Pages
	entryQuery := `
		SELECT 
			page,
			count(*) as sessions,
			(countIf(page_count = 1) * 100.0) / count(*) as bounce_rate
		FROM (
			SELECT 
				session_id,
				argMin(page, timestamp) as page,
				count(*) as page_count
			FROM events
			WHERE website_id = ? AND timestamp >= now() - interval ? day AND event_type = 'pageview'
			GROUP BY session_id
		)
		GROUP BY page
		ORDER BY sessions DESC
		LIMIT 10`

	rows, err := r.conn.Query(ctx, entryQuery, websiteID, days)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s models.PageInsightStat
			var sessions uint64
			if err := rows.Scan(&s.Page, &sessions, &s.BounceRate); err == nil {
				s.Sessions = int(sessions)
				insights.TopEntryPages = append(insights.TopEntryPages, s)
			}
		}
	}

	// 3. Top Exit Pages
	exitQuery := `
		SELECT 
			page,
			count(*) as exit_sessions,
			(count(*) * 100.0 / any(total_page_sessions)) as exit_rate
		FROM (
			SELECT 
				session_id,
				argMax(page, timestamp) as page
			FROM events
			WHERE website_id = ? AND timestamp >= now() - interval ? day AND event_type = 'pageview'
			GROUP BY session_id
		) AS exits
		INNER JOIN (
			SELECT page, count(DISTINCT session_id) as total_page_sessions
			FROM events
			WHERE website_id = ? AND timestamp >= now() - interval ? day AND event_type = 'pageview'
			GROUP BY page
		) AS totals ON exits.page = totals.page
		GROUP BY page
		ORDER BY exit_sessions DESC
		LIMIT 10`

	rows, err = r.conn.Query(ctx, exitQuery, websiteID, days, websiteID, days)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s models.PageInsightStat
			var sessions uint64
			var exitRate float64
			if err := rows.Scan(&s.Page, &sessions, &exitRate); err == nil {
				s.Sessions = int(sessions)
				s.ExitRate = &exitRate
				insights.TopExitPages = append(insights.TopExitPages, s)
			}
		}
	}

	return insights, nil
}

func (r *ClickHouseAnalyticsRepository) GetActivityTrends(ctx context.Context, websiteID string, timezone string) (*models.ActivityTrendsResponse, error) {
	query := `
		SELECT 
			toStartOfHour(timestamp) as time_bucket,
			count(DISTINCT visitor_id) as visitors,
			count(*) as page_views,
			countIf(event_type = 'session_start') as sessions,
			formatDateTime(toStartOfHour(timestamp), '%H:%M') as label
		FROM events
		WHERE website_id = ? 
		AND timestamp >= now() - interval 24 hour
		GROUP BY time_bucket
		ORDER BY time_bucket ASC`

	rows, err := r.conn.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trends []models.ActivityTrendItem
	for rows.Next() {
		var t models.ActivityTrendItem
		var visitors, pageViews, sessions uint64
		if err := rows.Scan(&t.Timestamp, &visitors, &pageViews, &sessions, &t.Label); err != nil {
			continue
		}
		t.Visitors = int(visitors)
		t.PageViews = int(pageViews)
		t.Sessions = int(sessions)
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

func (r *ClickHouseAnalyticsRepository) GetUserRetention(ctx context.Context, websiteID string) (*models.RetentionData, error) {
	// Using ClickHouse retention function for Day 1, 7, 30
	query := `
		SELECT
			retention(
				timestamp >= now() - interval 2 day AND timestamp < now() - interval 1 day,
				timestamp >= now() - interval 1 day
			) as d1,
			retention(
				timestamp >= now() - interval 8 day AND timestamp < now() - interval 7 day,
				timestamp >= now() - interval 7 day
			) as d7,
			retention(
				timestamp >= now() - interval 31 day AND timestamp < now() - interval 30 day,
				timestamp >= now() - interval 30 day
			) as d30
		FROM events
		WHERE website_id = ?`

	var d1, d7, d30 []uint8
	err := r.conn.QueryRow(ctx, query, websiteID).Scan(&d1, &d7, &d30)
	if err != nil {
		return &models.RetentionData{WebsiteID: websiteID, DateRange: 30}, nil
	}

	data := &models.RetentionData{
		WebsiteID: websiteID,
		DateRange: 30,
	}

	// Calculate percentages
	if len(d1) >= 2 && d1[0] > 0 {
		data.Day1 = float64(d1[1]) / float64(d1[0]) * 100
	}
	if len(d7) >= 2 && d7[0] > 0 {
		data.Day7 = float64(d7[1]) / float64(d7[0]) * 100
	}
	if len(d30) >= 2 && d30[0] > 0 {
		data.Day30 = float64(d30[1]) / float64(d30[0]) * 100
	}

	return data, nil
}

func (r *ClickHouseAnalyticsRepository) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.EventItem, error) {
	return r.pg.GetGoalStats(ctx, websiteID, days)
}

func (r *ClickHouseAnalyticsRepository) GetTopResolutions(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	// Resolutions usually come from screen properties
	return r.pg.GetTopResolutions(ctx, websiteID, days, limit)
}
