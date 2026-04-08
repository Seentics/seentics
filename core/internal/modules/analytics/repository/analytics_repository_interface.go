package repository

import (
	"context"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"
)

type MainAnalyticsRepository interface {
	GetDashboardMetrics(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) (*models.DashboardMetrics, error)
	GetComparisonMetrics(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) (*models.ComparisonMetrics, error)
	GetUTMAnalytics(ctx context.Context, websiteID string, days int, timezone string) (map[string]interface{}, error)
	GetTopPages(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.PageStat, error)
	GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int, timezone string) (map[string]interface{}, error)
	GetTopReferrers(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.ReferrerStat, error)
	GetTopSources(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.SourceStat, error)
	GetTopCountries(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.CountryStat, error)
	GetTopBrowsers(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.BrowserStat, error)
	GetTopDevices(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.DeviceStat, error)
	GetTopOS(ctx context.Context, websiteID string, days int, timezone string, limit int, filters models.AnalyticsFilters) ([]models.OSStat, error)
	GetTrafficSummary(ctx context.Context, websiteID string, days int, timezone string) (*models.TrafficSummary, error)
	GetDailyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) ([]models.DailyStat, error)
	GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters) ([]models.HourlyStat, error)
	GetCustomEventStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.CustomEventStat, error)
	GetLiveVisitors(ctx context.Context, websiteID string) (int, error)
	GetTopContinents(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error)
	GetTopRegions(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error)
	GetGeolocationBreakdown(ctx context.Context, websiteID string, startDate, endDate time.Time) (*models.GeolocationBreakdown, error)
	GetVisitorInsights(ctx context.Context, websiteID string, days int, timezone string) (*models.VisitorInsights, error)
	GetActivityTrends(ctx context.Context, websiteID string, timezone string) (*models.ActivityTrendsResponse, error)
	GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.GoalStatItem, error)
	GetTopResolutions(ctx context.Context, websiteID string, days int, limit int, timezone string) ([]models.TopItem, error)
	GetRecentActivity(ctx context.Context, websiteID string, limit int) ([]models.RecentActivity, error)
	GetPageFlows(ctx context.Context, websiteID string, days int, limit int, timezone string) ([]models.PageFlow, error)
	GetEntryPages(ctx context.Context, websiteID string, days int, limit int, timezone string) ([]models.TopItem, error)
	GetExitPages(ctx context.Context, websiteID string, days int, limit int, timezone string) ([]models.TopItem, error)
	GetAvgPathLength(ctx context.Context, websiteID string, days int, timezone string) (float64, error)
	GetRealtimeData(ctx context.Context, websiteID string, timezone string) (*models.RealtimeData, error)
	GetTopLanguages(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.TopItem, error)
	GetTopCities(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.TopItem, error)
	DeleteAllWebsiteData(ctx context.Context, websiteID string) error
}
