package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
)

// pgMetadataRepo defines the minimal PG interface used for goal/resolution metadata.
type pgMetadataRepo interface {
	GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.EventItem, error)
	GetTopResolutions(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error)
}

type ClickHouseAnalyticsRepository struct {
	conn   driver.Conn
	pg     pgMetadataRepo
	logger zerolog.Logger
}

func NewClickHouseAnalyticsRepository(conn driver.Conn, pg pgMetadataRepo, logger zerolog.Logger) *ClickHouseAnalyticsRepository {
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
	if filters.PropKey != "" && filters.PropValue != "" {
		clauses = append(clauses, "JSONExtractString(properties, ?) = ?")
		params = append(params, filters.PropKey, filters.PropValue)
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
			COUNT(*) as total_visitors,
			uniq(visitor_id) as unique_visitors,
			COUNT(*) as sessions,
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
			uniq(visitor_id) as unique_visitors,
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

// GetUTMAnalytics returns UTM metrics from ClickHouse using 3 parallel aggregated queries
func (r *ClickHouseAnalyticsRepository) GetUTMAnalytics(ctx context.Context, websiteID string, days int) (map[string]interface{}, error) {
	baseWhere := `website_id = ? AND timestamp >= now() - interval ? day AND event_type = 'pageview'`

	var sources, mediums, campaigns []map[string]interface{}

	eg, egCtx := errgroup.WithContext(ctx)

	eg.Go(func() error {
		q := fmt.Sprintf(`SELECT COALESCE(utm_source, 'direct') as source, COUNT(*) as visits, uniq(visitor_id) as unique_visitors FROM events WHERE %s GROUP BY source ORDER BY visits DESC LIMIT 10`, baseWhere)
		rows, err := r.conn.Query(egCtx, q, websiteID, days)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var source string
			var visits, unique uint64
			if err := rows.Scan(&source, &visits, &unique); err == nil {
				sources = append(sources, map[string]interface{}{"source": source, "visits": visits, "unique_visitors": unique})
			}
		}
		return nil
	})

	eg.Go(func() error {
		q := fmt.Sprintf(`SELECT COALESCE(utm_medium, 'none') as medium, COUNT(*) as visits, uniq(visitor_id) as unique_visitors FROM events WHERE %s GROUP BY medium ORDER BY visits DESC LIMIT 10`, baseWhere)
		rows, err := r.conn.Query(egCtx, q, websiteID, days)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var medium string
			var visits, unique uint64
			if err := rows.Scan(&medium, &visits, &unique); err == nil {
				mediums = append(mediums, map[string]interface{}{"medium": medium, "visits": visits, "unique_visitors": unique})
			}
		}
		return nil
	})

	eg.Go(func() error {
		q := fmt.Sprintf(`SELECT COALESCE(utm_campaign, 'none') as campaign, COUNT(*) as visits, uniq(visitor_id) as unique_visitors FROM events WHERE %s GROUP BY campaign ORDER BY visits DESC LIMIT 10`, baseWhere)
		rows, err := r.conn.Query(egCtx, q, websiteID, days)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var campaign string
			var visits, unique uint64
			if err := rows.Scan(&campaign, &visits, &unique); err == nil {
				campaigns = append(campaigns, map[string]interface{}{"campaign": campaign, "visits": visits, "unique_visitors": unique})
			}
		}
		return nil
	})

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	if sources == nil {
		sources = make([]map[string]interface{}, 0)
	}
	if mediums == nil {
		mediums = make([]map[string]interface{}, 0)
	}
	if campaigns == nil {
		campaigns = make([]map[string]interface{}, 0)
	}

	return map[string]interface{}{
		"sources":   sources,
		"mediums":   mediums,
		"campaigns": campaigns,
	}, nil
}

// GetTopPages returns top pages from ClickHouse with filter support
func (r *ClickHouseAnalyticsRepository) GetTopPages(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.PageStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		WITH page_visits AS (
			SELECT
				page,
				session_id,
				visitor_id,
				timestamp,
				leadInFrame(timestamp, 1, timestamp) OVER (
					PARTITION BY session_id ORDER BY timestamp
					ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
				) as next_ts
			FROM events
			WHERE website_id = ?
			AND timestamp >= now() - interval ? day
			AND event_type = 'pageview'
			%s
		),
		session_stats AS (
			SELECT session_id, count() as page_count
			FROM page_visits
			GROUP BY session_id
		)
		SELECT
			pv.page,
			count() as views,
			uniq(pv.visitor_id) as unique_visitors,
			avg(
				if(
					pv.next_ts > pv.timestamp AND dateDiff('second', pv.timestamp, pv.next_ts) <= 1800,
					dateDiff('second', pv.timestamp, pv.next_ts),
					NULL
				)
			) as avg_time,
			uniqIf(pv.session_id, ss.page_count = 1) * 100.0 / uniq(pv.session_id) as bounce_rate
		FROM page_visits pv
		INNER JOIN session_stats ss ON pv.session_id = ss.session_id
		GROUP BY pv.page
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []models.PageStat
	for rows.Next() {
		var p models.PageStat
		var views, unique uint64
		var avgTime, bounceRate float64
		if err := rows.Scan(&p.Page, &views, &unique, &avgTime, &bounceRate); err != nil {
			continue
		}
		p.Views = int(views)
		p.Unique = int(unique)
		p.AvgTime = &avgTime
		p.BounceRate = &bounceRate
		pages = append(pages, p)
	}

	return pages, nil
}

func (r *ClickHouseAnalyticsRepository) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int) (map[string]interface{}, error) {
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
		ORDER BY visits DESC
		LIMIT 100`

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

// GetTopReferrers with filter support
func (r *ClickHouseAnalyticsRepository) GetTopReferrers(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.ReferrerStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(referrer, 'direct') as referrer,
			COUNT(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY referrer
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
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

// GetTopSources with filter support
func (r *ClickHouseAnalyticsRepository) GetTopSources(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.SourceStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(utm_source, 'direct') as source,
			COUNT(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY source
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
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

// GetTopCountries with filter support
func (r *ClickHouseAnalyticsRepository) GetTopCountries(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.CountryStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(country, 'Unknown') as country,
			COUNT(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY country
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
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

// GetTopBrowsers with filter support
func (r *ClickHouseAnalyticsRepository) GetTopBrowsers(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.BrowserStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(browser, 'Unknown') as browser,
			COUNT(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY browser
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
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

// GetTopDevices with filter support
func (r *ClickHouseAnalyticsRepository) GetTopDevices(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.DeviceStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(device, 'Unknown') as device,
			COUNT(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY device
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
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

// GetTopOS with filter support
func (r *ClickHouseAnalyticsRepository) GetTopOS(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.OSStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(os, 'Unknown') as os,
			COUNT(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY os
		ORDER BY views DESC
		LIMIT ?`, filterClause)

	args := append([]interface{}{websiteID, days}, filterParams...)
	args = append(args, limit)

	rows, err := r.conn.Query(ctx, query, args...)
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
	query := `
		SELECT
			COALESCE(SUM(page_count), 0) as total_page_views,
			COUNT(*) as total_sessions,
			uniq(visitor_id) as unique_visitors,
			COALESCE((countIf(page_count = 1) * 100.0) / NULLIF(COUNT(*), 0), 0) as bounce_rate,
			COALESCE(AVG(session_duration), 0) as avg_session_time,
			COALESCE(SUM(page_count) * 1.0 / NULLIF(COUNT(*), 0), 0) as pages_per_session
		FROM (
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
			GROUP BY session_id
		)`

	var summary models.TrafficSummary
	err := r.conn.QueryRow(ctx, query, websiteID, days).Scan(
		&summary.TotalPageViews, &summary.TotalSessions, &summary.UniqueVisitors,
		&summary.BounceRate, &summary.AvgSessionTime, &summary.PagesPerSession,
	)
	summary.TotalVisitors = summary.UniqueVisitors

	if err != nil {
		return nil, err
	}

	return &summary, nil
}

// GetDailyStats with filter support
func (r *ClickHouseAnalyticsRepository) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) ([]models.DailyStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			formatDateTime(toStartOfDay(timestamp, ?), '%%Y-%%m-%%d') as date,
			count(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY date
		ORDER BY date ASC`, filterClause)

	args := append([]interface{}{timezone, websiteID, days}, filterParams...)

	rows, err := r.conn.Query(ctx, query, args...)
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

// GetHourlyStats with filter support
func (r *ClickHouseAnalyticsRepository) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) ([]models.HourlyStat, error) {
	filterClause, filterParams := r.buildFilterClause(filters)

	query := fmt.Sprintf(`
		SELECT
			formatDateTime(toStartOfHour(timestamp, ?), '%%Y-%%m-%%d %%H:00:00') as hour,
			count(*) as views,
			uniq(visitor_id) as unique_visitors
		FROM events
		WHERE website_id = ?
		AND timestamp >= now() - interval ? day
		AND event_type = 'pageview'
		%s
		GROUP BY hour
		ORDER BY hour ASC`, filterClause)

	args := append([]interface{}{timezone, websiteID, days}, filterParams...)

	rows, err := r.conn.Query(ctx, query, args...)
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
			uniq(visitor_id) as unique_users
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
		SELECT uniq(visitor_id)
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
		SELECT name, count, count * 100.0 / SUM(count) OVER () as percentage
		FROM (
			SELECT
				COALESCE(continent, 'Unknown') as name,
				count(*) as count
			FROM events
			WHERE website_id = ?
			AND timestamp >= ? AND timestamp <= ?
			AND event_type = 'pageview'
			GROUP BY name
		)
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
		if err := rows.Scan(&item.Name, &count, &item.Percentage); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopRegions(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT name, count, count * 100.0 / SUM(count) OVER () as percentage
		FROM (
			SELECT
				COALESCE(region, 'Unknown') as name,
				count(*) as count
			FROM events
			WHERE website_id = ?
			AND timestamp >= ? AND timestamp <= ?
			AND event_type = 'pageview'
			GROUP BY name
		)
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
		if err := rows.Scan(&item.Name, &count, &item.Percentage); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetGeolocationBreakdown(ctx context.Context, websiteID string, startDate, endDate time.Time) (*models.GeolocationBreakdown, error) {
	g := &models.GeolocationBreakdown{}

	eg, egCtx := errgroup.WithContext(ctx)

	eg.Go(func() error {
		var err error
		g.Countries, err = r.GetTopCountriesByRange(egCtx, websiteID, startDate, endDate, 14)
		return err
	})
	eg.Go(func() error {
		var err error
		g.Continents, err = r.GetTopContinents(egCtx, websiteID, startDate, endDate, 14)
		return err
	})
	eg.Go(func() error {
		var err error
		g.Cities, err = r.GetTopCitiesByRange(egCtx, websiteID, startDate, endDate, 14)
		return err
	})
	eg.Go(func() error {
		var err error
		g.Regions, err = r.GetTopRegions(egCtx, websiteID, startDate, endDate, 14)
		return err
	})

	if err := eg.Wait(); err != nil {
		return nil, err
	}
	return g, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopCitiesByRange(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT name, count, count * 100.0 / SUM(count) OVER () as percentage
		FROM (
			SELECT
				COALESCE(city, 'Unknown') as name,
				uniq(visitor_id) as count
			FROM events
			WHERE website_id = ?
			AND timestamp >= ? AND timestamp <= ?
			AND event_type = 'pageview'
			GROUP BY name
		)
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
		if err := rows.Scan(&item.Name, &count, &item.Percentage); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopCountriesByRange(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT name, count, count * 100.0 / SUM(count) OVER () as percentage
		FROM (
			SELECT
				COALESCE(country, 'Unknown') as name,
				uniq(visitor_id) as count
			FROM events
			WHERE website_id = ?
			AND timestamp >= ? AND timestamp <= ?
			AND event_type = 'pageview'
			GROUP BY name
		)
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
		if err := rows.Scan(&item.Name, &count, &item.Percentage); err != nil {
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

	g, gCtx := errgroup.WithContext(ctx)

	// Query 1: New/returning visitors + avg duration
	g.Go(func() error {
		query := `
			SELECT
				countIf(min_timestamp >= now() - interval ? day) as new_visitors,
				countIf(min_timestamp < now() - interval ? day) as returning_visitors,
				COALESCE(avg(session_duration), 0) as avg_duration
			FROM (
				SELECT
					visitor_id,
					min(timestamp) as min_timestamp,
					if(count(*) > 1,
						least(dateDiff('second', min(timestamp), max(timestamp)), 1800),
						0
					) as session_duration
				FROM events
				WHERE website_id = ?
				AND timestamp >= now() - interval ? day
				AND event_type = 'pageview'
				GROUP BY visitor_id
			)`

		var newVisitors, returningVisitors uint64
		err := r.conn.QueryRow(gCtx, query, days, days, websiteID, days*2).Scan(
			&newVisitors, &returningVisitors, &insights.AverageSessionDuration,
		)
		if err != nil {
			r.logger.Warn().Err(err).Msg("Failed to get visitor insights from ClickHouse")
			return nil
		}
		insights.NewVisitors = int(newVisitors)
		insights.ReturningVisitors = int(returningVisitors)
		return nil
	})

	// Query 2: Top entry pages
	g.Go(func() error {
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

		rows, err := r.conn.Query(gCtx, entryQuery, websiteID, days)
		if err != nil {
			return nil
		}
		defer rows.Close()
		for rows.Next() {
			var s models.PageInsightStat
			var sessions uint64
			if err := rows.Scan(&s.Page, &sessions, &s.BounceRate); err == nil {
				s.Sessions = int(sessions)
				insights.TopEntryPages = append(insights.TopEntryPages, s)
			}
		}
		return nil
	})

	// Query 3: Top exit pages
	g.Go(func() error {
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
				SELECT page, uniq(session_id) as total_page_sessions
				FROM events
				WHERE website_id = ? AND timestamp >= now() - interval ? day AND event_type = 'pageview'
				GROUP BY page
			) AS totals ON exits.page = totals.page
			GROUP BY page
			ORDER BY exit_sessions DESC
			LIMIT 10`

		rows, err := r.conn.Query(gCtx, exitQuery, websiteID, days, websiteID, days)
		if err != nil {
			return nil
		}
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
		return nil
	})

	_ = g.Wait()

	total := insights.NewVisitors + insights.ReturningVisitors
	if total > 0 {
		insights.NewVisitorPercentage = float64(insights.NewVisitors) / float64(total) * 100
		insights.ReturningVisitorPercentage = float64(insights.ReturningVisitors) / float64(total) * 100
	}

	return insights, nil
}

func (r *ClickHouseAnalyticsRepository) GetActivityTrends(ctx context.Context, websiteID string, timezone string) (*models.ActivityTrendsResponse, error) {
	if timezone == "" {
		timezone = "UTC"
	}
	query := `
		SELECT
			toStartOfHour(toTimeZone(timestamp, ?)) as time_bucket,
			uniq(visitor_id) as visitors,
			count(*) as page_views,
			countIf(event_type = 'session_start') as sessions,
			formatDateTime(toStartOfHour(toTimeZone(timestamp, ?)), '%H:%M') as label
		FROM events
		WHERE website_id = ?
		AND toDate(toTimeZone(timestamp, ?)) = toDate(toTimeZone(now(), ?))
		GROUP BY time_bucket
		ORDER BY time_bucket ASC`

	rows, err := r.conn.Query(ctx, query, timezone, timezone, websiteID, timezone, timezone)
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

func (r *ClickHouseAnalyticsRepository) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.EventItem, error) {
	return r.pg.GetGoalStats(ctx, websiteID, days)
}

func (r *ClickHouseAnalyticsRepository) GetTopResolutions(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	return r.pg.GetTopResolutions(ctx, websiteID, days, limit)
}

func (r *ClickHouseAnalyticsRepository) GetRecentActivity(ctx context.Context, websiteID string, limit int) ([]models.RecentActivity, error) {
	query := `
		SELECT
			page,
			COALESCE(country, '') as country,
			COALESCE(device, '') as device,
			COALESCE(browser, '') as browser,
			COALESCE(referrer, '') as referrer,
			formatDateTime(timestamp, '%Y-%m-%dT%H:%i:%S', 'UTC') as ts
		FROM events
		WHERE website_id = ?
		AND event_type = 'pageview'
		AND timestamp >= now() - interval 1 day
		ORDER BY timestamp DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []models.RecentActivity
	for rows.Next() {
		var a models.RecentActivity
		if err := rows.Scan(&a.Page, &a.Country, &a.Device, &a.Browser, &a.Referrer, &a.Timestamp); err != nil {
			continue
		}
		activities = append(activities, a)
	}
	return activities, nil
}

func (r *ClickHouseAnalyticsRepository) GetPageFlows(ctx context.Context, websiteID string, days int, limit int) ([]models.PageFlow, error) {
	query := `
		SELECT from_page, to_page, count(*) as cnt
		FROM (
			SELECT
				page as from_page,
				leadInFrame(page) OVER (PARTITION BY session_id ORDER BY timestamp ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) as to_page
			FROM events
			WHERE website_id = ?
			AND event_type = 'pageview'
			AND timestamp >= now() - interval ? day
		)
		WHERE to_page != '' AND from_page != to_page
		GROUP BY from_page, to_page
		ORDER BY cnt DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flows []models.PageFlow
	for rows.Next() {
		var f models.PageFlow
		var count uint64
		if err := rows.Scan(&f.FromPage, &f.ToPage, &count); err != nil {
			continue
		}
		f.Count = int(count)
		flows = append(flows, f)
	}
	return flows, nil
}

func (r *ClickHouseAnalyticsRepository) GetEntryPages(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	query := `
		SELECT page as name, count(*) as cnt
		FROM (
			SELECT session_id, argMin(page, timestamp) as page
			FROM events
			WHERE website_id = ?
			AND event_type = 'pageview'
			AND timestamp >= now() - interval ? day
			GROUP BY session_id
		)
		GROUP BY page
		ORDER BY cnt DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
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

func (r *ClickHouseAnalyticsRepository) GetExitPages(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	query := `
		SELECT page as name, count(*) as cnt
		FROM (
			SELECT session_id, argMax(page, timestamp) as page
			FROM events
			WHERE website_id = ?
			AND event_type = 'pageview'
			AND timestamp >= now() - interval ? day
			GROUP BY session_id
		)
		GROUP BY page
		ORDER BY cnt DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
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

func (r *ClickHouseAnalyticsRepository) GetAvgPathLength(ctx context.Context, websiteID string, days int) (float64, error) {
	query := `
		SELECT avg(pages) FROM (
			SELECT session_id, uniq(page) as pages
			FROM events
			WHERE website_id = ?
			AND event_type = 'pageview'
			AND timestamp >= now() - interval ? day
			GROUP BY session_id
		)`

	var avg float64
	err := r.conn.QueryRow(ctx, query, websiteID, days).Scan(&avg)
	return avg, err
}

func (r *ClickHouseAnalyticsRepository) GetRealtimeData(ctx context.Context, websiteID string) (*models.RealtimeData, error) {
	data := &models.RealtimeData{}

	// Active visitors (unique in last 5 min)
	q1 := `SELECT uniq(visitor_id), count(*) FROM events WHERE website_id = ? AND timestamp >= now() - interval 5 minute AND event_type = 'pageview'`
	var uv, pv uint64
	if err := r.conn.QueryRow(ctx, q1, websiteID).Scan(&uv, &pv); err != nil {
		return nil, err
	}
	data.ActiveVisitors = int(uv)
	data.PageViews = int(pv)

	// Active pages (last 5 min)
	q2 := `SELECT page, uniq(visitor_id) as visitors FROM events WHERE website_id = ? AND timestamp >= now() - interval 5 minute AND event_type = 'pageview' GROUP BY page ORDER BY visitors DESC LIMIT 10`
	rows, err := r.conn.Query(ctx, q2, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p models.RealtimePage
		var v uint64
		if err := rows.Scan(&p.Page, &v); err != nil {
			continue
		}
		p.Visitors = int(v)
		data.ActivePages = append(data.ActivePages, p)
	}

	// Top referrers (last 5 min)
	q3 := `SELECT COALESCE(referrer, '(direct)') as ref, uniq(visitor_id) as visitors FROM events WHERE website_id = ? AND timestamp >= now() - interval 5 minute AND event_type = 'pageview' GROUP BY ref ORDER BY visitors DESC LIMIT 10`
	rows3, err := r.conn.Query(ctx, q3, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows3.Close()
	for rows3.Next() {
		var item models.RealtimeItem
		var v uint64
		if err := rows3.Scan(&item.Name, &v); err != nil {
			continue
		}
		item.Visitors = int(v)
		data.TopReferrers = append(data.TopReferrers, item)
	}

	// Top countries (last 5 min)
	q4 := `SELECT COALESCE(country, 'Unknown') as c, uniq(visitor_id) as visitors FROM events WHERE website_id = ? AND timestamp >= now() - interval 5 minute AND event_type = 'pageview' GROUP BY c ORDER BY visitors DESC LIMIT 10`
	rows4, err := r.conn.Query(ctx, q4, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows4.Close()
	for rows4.Next() {
		var item models.RealtimeItem
		var v uint64
		if err := rows4.Scan(&item.Name, &v); err != nil {
			continue
		}
		item.Visitors = int(v)
		data.TopCountries = append(data.TopCountries, item)
	}

	// Top devices (last 5 min)
	q5 := `SELECT COALESCE(device, 'Unknown') as d, uniq(visitor_id) as visitors FROM events WHERE website_id = ? AND timestamp >= now() - interval 5 minute AND event_type = 'pageview' GROUP BY d ORDER BY visitors DESC LIMIT 10`
	rows5, err := r.conn.Query(ctx, q5, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows5.Close()
	for rows5.Next() {
		var item models.RealtimeItem
		var v uint64
		if err := rows5.Scan(&item.Name, &v); err != nil {
			continue
		}
		item.Visitors = int(v)
		data.TopDevices = append(data.TopDevices, item)
	}

	// Top browsers (last 5 min)
	q6 := `SELECT COALESCE(browser, 'Unknown') as b, uniq(visitor_id) as visitors FROM events WHERE website_id = ? AND timestamp >= now() - interval 5 minute AND event_type = 'pageview' GROUP BY b ORDER BY visitors DESC LIMIT 10`
	rows6, err := r.conn.Query(ctx, q6, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows6.Close()
	for rows6.Next() {
		var item models.RealtimeItem
		var v uint64
		if err := rows6.Scan(&item.Name, &v); err != nil {
			continue
		}
		item.Visitors = int(v)
		data.TopBrowsers = append(data.TopBrowsers, item)
	}

	// Ensure non-nil slices for JSON
	if data.ActivePages == nil {
		data.ActivePages = []models.RealtimePage{}
	}
	if data.TopReferrers == nil {
		data.TopReferrers = []models.RealtimeItem{}
	}
	if data.TopCountries == nil {
		data.TopCountries = []models.RealtimeItem{}
	}
	if data.TopDevices == nil {
		data.TopDevices = []models.RealtimeItem{}
	}
	if data.TopBrowsers == nil {
		data.TopBrowsers = []models.RealtimeItem{}
	}

	return data, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopLanguages(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.TopItem, error) {
	// Try dedicated language column first; fall back to properties JSON for legacy data
	query := `
		SELECT name, count, count * 100.0 / SUM(count) OVER () as percentage
		FROM (
			SELECT
				COALESCE(
					NULLIF(language, ''),
					NULLIF(JSONExtractString(properties, 'language'), ''),
					'Unknown'
				) as name,
				count(*) as count
			FROM events
			WHERE website_id = ?
			AND timestamp >= now() - interval ? day
			AND event_type = 'pageview'
			GROUP BY name
		)
		ORDER BY count DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var count uint64
		if err := rows.Scan(&item.Name, &count, &item.Percentage); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) GetTopCities(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.TopItem, error) {
	query := `
		SELECT name, count, count * 100.0 / SUM(count) OVER () as percentage
		FROM (
			SELECT
				COALESCE(city, 'Unknown') as name,
				count(*) as count
			FROM events
			WHERE website_id = ?
			AND timestamp >= now() - interval ? day
			AND event_type = 'pageview'
			GROUP BY name
		)
		ORDER BY count DESC
		LIMIT ?`

	rows, err := r.conn.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var count uint64
		if err := rows.Scan(&item.Name, &count, &item.Percentage); err != nil {
			continue
		}
		item.Count = int(count)
		items = append(items, item)
	}
	return items, nil
}

func (r *ClickHouseAnalyticsRepository) DeleteAllWebsiteData(ctx context.Context, websiteID string) error {
	tables := []string{
		"events",
		"daily_stats",
		"hourly_stats",
		"daily_page_stats",
		"daily_country_stats",
		"daily_referrer_stats",
		"custom_events_aggregated",
	}

	for _, table := range tables {
		delQuery := fmt.Sprintf("ALTER TABLE %s DELETE WHERE website_id = ?", table)
		if err := r.conn.Exec(ctx, delQuery, websiteID); err != nil {
			r.logger.Warn().Err(err).Str("table", table).Str("website_id", websiteID).Msg("Failed to issue DELETE mutation to ClickHouse")
			continue
		}
		// Run OPTIMIZE in the background — it is a heavy blocking operation and must not
		// block the request. ClickHouse will eventually merge on its own; this just speeds it up.
		go func(t string) {
			optQuery := fmt.Sprintf("OPTIMIZE TABLE %s FINAL", t)
			if err := r.conn.Exec(context.Background(), optQuery); err != nil {
				r.logger.Warn().Err(err).Str("table", t).Msg("Background OPTIMIZE TABLE FINAL failed (non-fatal)")
			}
		}(table)
	}

	return nil
}
