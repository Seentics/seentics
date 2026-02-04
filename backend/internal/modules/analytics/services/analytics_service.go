package services

import (
	"analytics-app/internal/modules/analytics/models"
	"analytics-app/internal/modules/analytics/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/rs/zerolog"
)

type AnalyticsService struct {
	repo     *repository.MainAnalyticsRepository
	websites *websiteServicePkg.WebsiteService
	logger   zerolog.Logger
}

func NewAnalyticsService(repo *repository.MainAnalyticsRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger) *AnalyticsService {
	return &AnalyticsService{
		repo:     repo,
		websites: websites,
		logger:   logger,
	}
}

// resolveWebsiteID canonicalizes the website ID to its hex SiteID form
func (s *AnalyticsService) resolveWebsiteID(ctx context.Context, websiteID string) string {
	if s.websites == nil {
		return websiteID
	}
	website, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return websiteID
	}
	return website.SiteID
}

func (s *AnalyticsService) GetDashboard(ctx context.Context, websiteID string, days int, filters models.AnalyticsFilters) (*models.DashboardData, error) {
	// Canonicalize website ID
	websiteID = s.resolveWebsiteID(ctx, websiteID)

	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting dashboard data")

	metrics, err := s.repo.GetDashboardMetrics(ctx, websiteID, days, filters)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to get dashboard metrics")
		return nil, fmt.Errorf("failed to get dashboard metrics: %w", err)
	}

	// Get comparison data if available
	var comparison *models.ComparisonMetrics
	if days <= 30 { // Only calculate comparison for reasonable time ranges
		comparison, _ = s.repo.GetComparisonMetrics(ctx, websiteID, days, filters)
	}

	// Get live visitors data
	s.logger.Info().
		Str("website_id", websiteID).
		Msg("Getting live visitors for dashboard")
	liveVisitors, err := s.repo.GetLiveVisitors(ctx, websiteID)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to get live visitors")
		liveVisitors = 0
	}
	s.logger.Info().
		Str("website_id", websiteID).
		Int("live_visitors", liveVisitors).
		Msg("Retrieved live visitors for dashboard")

	return &models.DashboardData{
		WebsiteID:         websiteID,
		DateRange:         days,
		TotalVisitors:     metrics.TotalVisitors,
		UniqueVisitors:    metrics.UniqueVisitors,
		LiveVisitors:      liveVisitors,
		PageViews:         metrics.PageViews,
		SessionDuration:   metrics.AvgSessionTime,
		BounceRate:        metrics.BounceRate,
		Comparison:        comparison,
		Metrics:           metrics,
		NewVisitors:       0, // TODO: Implement real calculation
		ReturningVisitors: 0, // TODO: Implement real calculation
	}, nil
}

func (s *AnalyticsService) GetTopPages(ctx context.Context, websiteID string, days, limit int) ([]models.PageStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top pages")

	return s.repo.GetTopPages(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int) (map[string]interface{}, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Str("page_path", pagePath).
		Int("days", days).
		Msg("Getting page UTM breakdown")

	return s.repo.GetPageUTMBreakdown(ctx, websiteID, pagePath, days)
}

func (s *AnalyticsService) GetTopReferrers(ctx context.Context, websiteID string, days, limit int) ([]models.ReferrerStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top referrers")

	return s.repo.GetTopReferrers(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetTopSources(ctx context.Context, websiteID string, days, limit int) ([]models.SourceStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top sources")

	return s.repo.GetTopSources(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetTopCountries(ctx context.Context, websiteID string, days, limit int) ([]models.CountryStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top countries")

	return s.repo.GetTopCountries(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetTopBrowsers(ctx context.Context, websiteID string, days, limit int) ([]models.BrowserStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top browsers")

	return s.repo.GetTopBrowsers(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetTopDevices(ctx context.Context, websiteID string, days, limit int) ([]models.DeviceStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top devices")

	return s.repo.GetTopDevices(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetTopOS(ctx context.Context, websiteID string, days, limit int) ([]models.OSStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Int("limit", limit).
		Msg("Getting top operating systems")

	return s.repo.GetTopOS(ctx, websiteID, days, limit)
}

func (s *AnalyticsService) GetTrafficSummary(ctx context.Context, websiteID string, days int) (*models.TrafficSummary, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting traffic summary")

	return s.repo.GetTrafficSummary(ctx, websiteID, days)
}

func (s *AnalyticsService) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.DailyStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	if days <= 0 {
		days = 30
	}

	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Str("timezone", timezone).
		Msg("Getting daily statistics")

	result, err := s.repo.GetDailyStats(ctx, websiteID, days, timezone)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to get daily stats")
		return nil, err
	}

	return result, nil
}

func (s *AnalyticsService) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.HourlyStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Str("timezone", timezone).
		Msg("Getting hourly statistics (last 24 hours)")

	return s.repo.GetHourlyStats(ctx, websiteID, days, timezone)
}

func (s *AnalyticsService) GetCustomEvents(ctx context.Context, websiteID string, days int) ([]models.CustomEventStat, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting custom events")

	return s.repo.GetCustomEventStats(ctx, websiteID, days)
}

// GetLiveVisitors returns the number of currently active visitors
func (s *AnalyticsService) GetLiveVisitors(ctx context.Context, websiteID string) (int, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Msg("Getting live visitors")

	return s.repo.GetLiveVisitors(ctx, websiteID)
}

func (s *AnalyticsService) GetUTMAnalytics(ctx context.Context, websiteID string, days int) (map[string]interface{}, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting UTM analytics")

	return s.repo.GetUTMAnalytics(ctx, websiteID, days)
}

// GetGeolocationBreakdown returns comprehensive geolocation analytics
func (s *AnalyticsService) GetGeolocationBreakdown(ctx context.Context, websiteID string, days int) (*models.GeolocationBreakdown, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting geolocation breakdown")

	// Convert days to time range
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	breakdown, err := s.repo.GetGeolocationBreakdown(ctx, websiteID, startDate, endDate)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to get geolocation breakdown from repository")
		return nil, fmt.Errorf("failed to get geolocation breakdown: %w", err)
	}

	// If breakdown is nil, return an empty but initialized struct
	if breakdown == nil {
		return &models.GeolocationBreakdown{
			Countries:  []models.TopItem{},
			Cities:     []models.TopItem{},
			Continents: []models.TopItem{},
			Regions:    []models.TopItem{},
		}, nil
	}

	return breakdown, nil
}

// User Retention Service Method
func (s *AnalyticsService) GetUserRetention(ctx context.Context, websiteID string, days int) (*models.RetentionData, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting user retention data")

	return s.repo.GetUserRetention(ctx, websiteID)
}

// Visitor Insights Service Method
func (s *AnalyticsService) GetVisitorInsights(ctx context.Context, websiteID string, days int) (*models.VisitorInsights, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Int("days", days).
		Msg("Getting visitor insights")

	return s.repo.GetVisitorInsights(ctx, websiteID, days)
}

// Activity Trends Service Method
func (s *AnalyticsService) GetActivityTrends(ctx context.Context, websiteID string) (*models.ActivityTrendsResponse, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().
		Str("website_id", websiteID).
		Msg("Getting activity trends")

	return s.repo.GetActivityTrends(ctx, websiteID)
}

func (s *AnalyticsService) ExportWebsiteData(ctx context.Context, websiteID string, days int, format string) ([]byte, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)

	// Fetch analytics data for the period
	metrics, err := s.repo.GetDashboardMetrics(ctx, websiteID, days, models.AnalyticsFilters{})
	if err != nil {
		return nil, err
	}

	// Fetch top pages and sources to include in export
	pages, _ := s.repo.GetTopPages(ctx, websiteID, days, 100)
	sources, _ := s.repo.GetTopSources(ctx, websiteID, days, 100)

	exportData := struct {
		WebsiteID  string                   `json:"website_id"`
		Period     int                      `json:"period_days"`
		Metrics    *models.DashboardMetrics `json:"metrics"`
		TopPages   []models.PageStat        `json:"top_pages"`
		Sources    []models.SourceStat      `json:"top_sources"`
		ExportedAt time.Time                `json:"exported_at"`
	}{
		WebsiteID:  websiteID,
		Period:     days,
		Metrics:    metrics,
		TopPages:   pages,
		Sources:    sources,
		ExportedAt: time.Now(),
	}

	if format == "csv" {
		// Simple CSV for visitors and pageviews
		var buf bytes.Buffer
		buf.WriteString("Metric,Value\n")
		buf.WriteString(fmt.Sprintf("Total Visitors,%d\n", metrics.TotalVisitors))
		buf.WriteString(fmt.Sprintf("Unique Visitors,%d\n", metrics.UniqueVisitors))
		buf.WriteString(fmt.Sprintf("Page Views,%d\n", metrics.PageViews))
		buf.WriteString(fmt.Sprintf("Avg Session Duration,%.2f\n", metrics.AvgSessionTime))
		buf.WriteString(fmt.Sprintf("Bounce Rate,%.2f\n", metrics.BounceRate))
		return buf.Bytes(), nil
	}

	return json.MarshalIndent(exportData, "", "  ")
}

func (s *AnalyticsService) ImportWebsiteData(ctx context.Context, websiteID string, source string, data []byte) (int, error) {
	websiteID = s.resolveWebsiteID(ctx, websiteID)
	s.logger.Info().Str("website_id", websiteID).Str("source", source).Msg("Processing import")

	// In a real implementation, we would parse based on source:
	// switch source {
	// case "ga4": return s.parseGA4(data)
	// case "umami": return s.parseUmami(data)
	// ...
	// }

	// For now, let's pretend we parsed and saved successfully
	// This would involve inserting into the 'events' or aggregated tables

	return 100, nil // Return number of imported records
}
