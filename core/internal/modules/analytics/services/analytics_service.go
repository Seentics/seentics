package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/cache"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
)

type AnalyticsService struct {
	repo     repository.MainAnalyticsRepository
	websites *websiteServicePkg.WebsiteService
	cache    *cache.Cache
	logger   zerolog.Logger
}

func NewAnalyticsService(repo repository.MainAnalyticsRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger, appCache ...*cache.Cache) *AnalyticsService {
	svc := &AnalyticsService{
		repo:     repo,
		websites: websites,
		logger:   logger,
	}
	if len(appCache) > 0 {
		svc.cache = appCache[0]
	}
	return svc
}

// resolveWebsiteID canonicalizes the website ID to its hex SiteID form
func (s *AnalyticsService) resolveWebsiteID(ctx context.Context, websiteID string) string {
	if s.websites == nil {
		return websiteID
	}
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return websiteID
	}
	return website.SiteID
}

// validateOwnership ensures the website belongs to the user
func (s *AnalyticsService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", fmt.Errorf("unauthorized access to website data")
	}

	return w.SiteID, nil
}

func (s *AnalyticsService) GetDashboard(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters, userID string) (*models.DashboardData, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	websiteID = canonicalID

	g, gCtx := errgroup.WithContext(ctx)

	var metrics *models.DashboardMetrics
	var comparison *models.ComparisonMetrics
	var liveVisitors int

	g.Go(func() error {
		var err error
		metrics, err = s.repo.GetDashboardMetrics(gCtx, websiteID, days, timezone, filters)
		if err != nil {
			s.logger.Error().Err(err).Msg("Failed to get dashboard metrics")
			return fmt.Errorf("failed to get dashboard metrics: %w", err)
		}
		return nil
	})

	if days <= 30 {
		g.Go(func() error {
			var err error
			comparison, err = s.repo.GetComparisonMetrics(gCtx, websiteID, days, timezone, filters)
			if err != nil {
				s.logger.Warn().Err(err).Msg("Failed to get comparison metrics")
				return nil
			}
			return nil
		})
	}

	g.Go(func() error {
		var err error
		liveVisitors, err = s.repo.GetLiveVisitors(gCtx, websiteID)
		if err != nil {
			s.logger.Warn().Err(err).Msg("Failed to get live visitors")
			liveVisitors = 0
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

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
		TopResolutions:    []models.TopItem{},
		NewVisitors:       0,
		ReturningVisitors: 0,
	}, nil
}

func (s *AnalyticsService) GetTopPages(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.PageStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopPages(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int, userID string) (map[string]interface{}, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetPageUTMBreakdown(ctx, canonicalID, pagePath, days)
}

func (s *AnalyticsService) GetTopReferrers(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.ReferrerStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopReferrers(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetTopSources(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.SourceStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopSources(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetTopCountries(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.CountryStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopCountries(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetTopBrowsers(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.BrowserStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopBrowsers(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetTopDevices(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.DeviceStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopDevices(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetTopResolutions(ctx context.Context, websiteID string, days, limit int, userID string) ([]models.TopItem, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopResolutions(ctx, canonicalID, days, limit)
}

func (s *AnalyticsService) GetTopOS(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.OSStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopOS(ctx, canonicalID, days, timezone, limit, filters)
}

func (s *AnalyticsService) GetTrafficSummary(ctx context.Context, websiteID string, days int, timezone string, userID string) (*models.TrafficSummary, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTrafficSummary(ctx, canonicalID, days, timezone)
}

func (s *AnalyticsService) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.DailyStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	if days <= 0 {
		days = 30
	}
	return s.repo.GetDailyStats(ctx, canonicalID, days, timezone, filters)
}

func (s *AnalyticsService) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.HourlyStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHourlyStats(ctx, canonicalID, days, timezone, filters)
}

func (s *AnalyticsService) GetCustomEvents(ctx context.Context, websiteID string, days int, userID string) ([]models.CustomEventStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetCustomEventStats(ctx, canonicalID, days)
}

// CustomEventsData holds combined custom events and UTM data from a single ownership check.
type CustomEventsData struct {
	Events []models.CustomEventStat
	UTM    map[string]interface{}
}

// GetCustomEventsWithUTM validates ownership once then fetches both custom events and UTM data.
func (s *AnalyticsService) GetCustomEventsWithUTM(ctx context.Context, websiteID string, days int, userID string) (*CustomEventsData, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	events, err := s.repo.GetCustomEventStats(ctx, canonicalID, days)
	if err != nil {
		return nil, err
	}
	utm, err := s.repo.GetUTMAnalytics(ctx, canonicalID, days)
	if err != nil {
		utm = map[string]interface{}{}
	}
	return &CustomEventsData{Events: events, UTM: utm}, nil
}

func (s *AnalyticsService) GetLiveVisitors(ctx context.Context, websiteID string, userID string) (int, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return 0, err
	}

	// Fast path: read from Redis HyperLogLog (sub-ms, no ClickHouse query)
	if s.cache != nil {
		hlKey := fmt.Sprintf("active:%s", canonicalID)
		count, err := s.cache.PFCount(hlKey)
		if err == nil && count > 0 {
			return int(count), nil
		}
	}

	// Fallback: query ClickHouse
	return s.repo.GetLiveVisitors(ctx, canonicalID)
}

func (s *AnalyticsService) GetUTMAnalytics(ctx context.Context, websiteID string, days int, userID string) (map[string]interface{}, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetUTMAnalytics(ctx, canonicalID, days)
}

func (s *AnalyticsService) GetGeolocationBreakdown(ctx context.Context, websiteID string, days int, timezone string, userID string) (*models.GeolocationBreakdown, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	startDate := startOfToday.AddDate(0, 0, -(days - 1)).UTC()
	endDate := time.Now().UTC()

	breakdown, err := s.repo.GetGeolocationBreakdown(ctx, canonicalID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get geolocation breakdown: %w", err)
	}

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

func (s *AnalyticsService) GetVisitorInsights(ctx context.Context, websiteID string, days int, timezone string, userID string) (*models.VisitorInsights, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetVisitorInsights(ctx, canonicalID, days, timezone)
}

func (s *AnalyticsService) GetActivityTrends(ctx context.Context, websiteID string, timezone string, userID string) (*models.ActivityTrendsResponse, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetActivityTrends(ctx, canonicalID, timezone)
}

func (s *AnalyticsService) GetGoalStats(ctx context.Context, websiteID string, days int, userID string) ([]models.EventItem, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetGoalStats(ctx, canonicalID, days)
}

func (s *AnalyticsService) ExportWebsiteData(ctx context.Context, websiteID string, days int, format string, userID string) ([]byte, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	websiteID = canonicalID

	metrics, err := s.repo.GetDashboardMetrics(ctx, websiteID, days, "UTC", models.AnalyticsFilters{})
	if err != nil {
		return nil, err
	}

	pages, _ := s.repo.GetTopPages(ctx, websiteID, days, "UTC", 100, models.AnalyticsFilters{})
	sources, _ := s.repo.GetTopSources(ctx, websiteID, days, "UTC", 100, models.AnalyticsFilters{})

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

func (s *AnalyticsService) ImportWebsiteData(ctx context.Context, websiteID string, source string, data []byte, userID string) (int, error) {
	_, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return 0, err
	}
	return 0, fmt.Errorf("import not implemented")
}

func (s *AnalyticsService) GetRecentActivity(ctx context.Context, websiteID string, limit int, userID string) ([]models.RecentActivity, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetRecentActivity(ctx, canonicalID, limit)
}

func (s *AnalyticsService) GetPathAnalysis(ctx context.Context, websiteID string, days int, userID string) (*models.PathAnalysis, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	g, gCtx := errgroup.WithContext(ctx)

	var entryPages []models.TopItem
	var exitPages []models.TopItem
	var pageFlows []models.PageFlow
	var avgPathLength float64

	g.Go(func() error {
		var e error
		entryPages, e = s.repo.GetEntryPages(gCtx, canonicalID, days, 10)
		return e
	})
	g.Go(func() error {
		var e error
		exitPages, e = s.repo.GetExitPages(gCtx, canonicalID, days, 10)
		return e
	})
	g.Go(func() error {
		var e error
		pageFlows, e = s.repo.GetPageFlows(gCtx, canonicalID, days, 30)
		return e
	})
	g.Go(func() error {
		var e error
		avgPathLength, e = s.repo.GetAvgPathLength(gCtx, canonicalID, days)
		return e
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return &models.PathAnalysis{
		TopEntryPages: entryPages,
		TopExitPages:  exitPages,
		PageFlows:     pageFlows,
		AvgPathLength: avgPathLength,
	}, nil
}
