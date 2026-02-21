package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresAnalyticsRepository combines all specialized analytics repositories
type PostgresAnalyticsRepository struct {
	dashboard       *DashboardAnalytics
	topPages        *TopPagesAnalytics
	topReferrers    *TopReferrersAnalytics
	topSources      *TopSourcesAnalytics
	topCountries    *TopCountriesAnalytics
	topBrowsers     *TopBrowsersAnalytics
	topDevices      *TopDevicesAnalytics
	topOS           *TopOSAnalytics
	geolocation     *TopGeolocationAnalytics
	trafficSummary  *TrafficSummaryAnalytics
	timeSeries      *TimeSeriesAnalytics
	customEvents    *CustomEventsAnalytics
	retention       *RetentionAnalytics
	visitorInsights *VisitorInsightsAnalytics
	activityTrends  *ActivityTrendsAnalytics
	goals           *GoalAnalytics
	topResolutions  *TopResolutionsAnalytics
}

// NewPostgresAnalyticsRepository creates a new main analytics repository
func NewPostgresAnalyticsRepository(db *pgxpool.Pool) *PostgresAnalyticsRepository {
	return &PostgresAnalyticsRepository{
		dashboard:       NewDashboardAnalytics(db),
		topPages:        NewTopPagesAnalytics(db),
		topReferrers:    NewTopReferrersAnalytics(db),
		topSources:      NewTopSourcesAnalytics(db),
		topCountries:    NewTopCountriesAnalytics(db),
		topBrowsers:     NewTopBrowsersAnalytics(db),
		topDevices:      NewTopDevicesAnalytics(db),
		topOS:           NewTopOSAnalytics(db),
		geolocation:     NewTopGeolocationAnalytics(db),
		trafficSummary:  NewTrafficSummaryAnalytics(db),
		timeSeries:      NewTimeSeriesAnalytics(db),
		customEvents:    NewCustomEventsAnalytics(db),
		retention:       NewRetentionAnalytics(db),
		visitorInsights: NewVisitorInsightsAnalytics(db),
		activityTrends:  NewActivityTrendsAnalytics(db),
		goals:           NewGoalAnalytics(db),
		topResolutions:  NewTopResolutionsAnalytics(db),
	}
}

// Dashboard Analytics Methods
func (r *PostgresAnalyticsRepository) GetDashboardMetrics(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) (*models.DashboardMetrics, error) {
	return r.dashboard.GetDashboardMetrics(ctx, websiteID, days, timezone, filters)
}

func (r *PostgresAnalyticsRepository) GetComparisonMetrics(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) (*models.ComparisonMetrics, error) {
	return r.dashboard.GetComparisonMetrics(ctx, websiteID, days, timezone, filters)
}

func (r *PostgresAnalyticsRepository) GetUTMAnalytics(ctx context.Context, websiteID string, days int) (map[string]interface{}, error) {
	return r.dashboard.GetUTMAnalytics(ctx, websiteID, days)
}

// Top Pages Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopPages(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.PageStat, error) {
	return r.topPages.GetTopPages(ctx, websiteID, days, timezone, limit)
}

func (r *PostgresAnalyticsRepository) GetTopPagesWithTimeBucket(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.PageStat, error) {
	return r.topPages.GetTopPagesWithTimeBucket(ctx, websiteID, days, timezone, limit)
}

func (r *PostgresAnalyticsRepository) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int) (map[string]interface{}, error) {
	return r.topPages.GetPageUTMBreakdown(ctx, websiteID, pagePath, days)
}

// Top Referrers Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopReferrers(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.ReferrerStat, error) {
	return r.topReferrers.GetTopReferrers(ctx, websiteID, days, timezone, limit)
}

// Top Sources Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopSources(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.SourceStat, error) {
	return r.topSources.GetTopSources(ctx, websiteID, days, timezone, limit)
}

// Top Countries Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopCountries(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.CountryStat, error) {
	return r.topCountries.GetTopCountries(ctx, websiteID, days, timezone, limit)
}

// Top Browsers Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopBrowsers(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.BrowserStat, error) {
	return r.topBrowsers.GetTopBrowsers(ctx, websiteID, days, timezone, limit)
}

// Top Devices Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopDevices(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.DeviceStat, error) {
	return r.topDevices.GetTopDevices(ctx, websiteID, days, timezone, limit)
}

// Top OS Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopOS(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.OSStat, error) {
	return r.topOS.GetTopOS(ctx, websiteID, days, timezone, limit)
}

// Traffic Summary Analytics Methods
func (r *PostgresAnalyticsRepository) GetTrafficSummary(ctx context.Context, websiteID string, days int, timezone string) (*models.TrafficSummary, error) {
	return r.trafficSummary.GetTrafficSummary(ctx, websiteID, days, timezone)
}

// Time Series Analytics Methods
func (r *PostgresAnalyticsRepository) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.DailyStat, error) {
	return r.timeSeries.GetDailyStats(ctx, websiteID, days, timezone)
}

func (r *PostgresAnalyticsRepository) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.HourlyStat, error) {
	return r.timeSeries.GetHourlyStats(ctx, websiteID, days, timezone)
}

// Custom Events Analytics Methods
func (r *PostgresAnalyticsRepository) GetCustomEventStats(ctx context.Context, websiteID string, days int) ([]models.CustomEventStat, error) {
	return r.customEvents.GetCustomEventStats(ctx, websiteID, days)
}

// GetLiveVisitors returns the number of currently active visitors
func (r *PostgresAnalyticsRepository) GetLiveVisitors(ctx context.Context, websiteID string) (int, error) {
	query := `
		SELECT COUNT(DISTINCT visitor_id) as live_visitors
		FROM events
		WHERE website_id = $1
		AND timestamp >= NOW() - INTERVAL '5 minutes'
		AND event_type = 'pageview'`

	var liveVisitors int
	err := r.dashboard.db.QueryRow(ctx, query, websiteID).Scan(&liveVisitors)
	if err != nil {
		return 0, err
	}

	return liveVisitors, nil
}

// Geolocation Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopContinents(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	return r.geolocation.GetTopContinents(ctx, websiteID, startDate, endDate, limit)
}

func (r *PostgresAnalyticsRepository) GetTopRegions(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	return r.geolocation.GetTopRegions(ctx, websiteID, startDate, endDate, limit)
}

func (r *PostgresAnalyticsRepository) GetGeolocationBreakdown(ctx context.Context, websiteID string, startDate, endDate time.Time) (*models.GeolocationBreakdown, error) {
	return r.geolocation.GetGeolocationBreakdown(ctx, websiteID, startDate, endDate)
}

// User Retention Analytics Methods
func (r *PostgresAnalyticsRepository) GetUserRetention(ctx context.Context, websiteID string) (*models.RetentionData, error) {
	return r.retention.GetUserRetention(ctx, websiteID)
}

// Visitor Insights Analytics Methods
func (r *PostgresAnalyticsRepository) GetVisitorInsights(ctx context.Context, websiteID string, days int, timezone string) (*models.VisitorInsights, error) {
	return r.visitorInsights.GetVisitorInsights(ctx, websiteID, days, timezone)
}

// Activity Trends Analytics Methods
func (r *PostgresAnalyticsRepository) GetActivityTrends(ctx context.Context, websiteID string, timezone string) (*models.ActivityTrendsResponse, error) {
	return r.activityTrends.GetActivityTrends(ctx, websiteID, timezone)
}

func (r *PostgresAnalyticsRepository) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.EventItem, error) {
	return r.goals.GetGoalStats(ctx, websiteID, days)
}

// Top Devices Analytics Methods
func (r *PostgresAnalyticsRepository) GetTopResolutions(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	return r.topResolutions.GetTopResolutions(ctx, websiteID, days, limit)
}
