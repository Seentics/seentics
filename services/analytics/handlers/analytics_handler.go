package handlers

import (
	"analytics-app/services"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type AnalyticsHandler struct {
	service *services.AnalyticsService
	logger  zerolog.Logger
}

func NewAnalyticsHandler(service *services.AnalyticsService, logger zerolog.Logger) *AnalyticsHandler {
	return &AnalyticsHandler{
		service: service,
		logger:  logger,
	}
}

func (h *AnalyticsHandler) GetDashboard(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	data, err := h.service.GetDashboard(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get dashboard data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dashboard data"})
		return
	}

	c.JSON(http.StatusOK, data)
}

func (h *AnalyticsHandler) GetTopPages(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	pages, err := h.service.GetTopPages(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top pages")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top pages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id": websiteID,
		"date_range": fmt.Sprintf("%d days", days),
		"top_pages":  pages,
	})
}

func (h *AnalyticsHandler) GetPageUTMBreakdown(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	pagePath := c.Query("page_path")
	if pagePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page_path query parameter is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	// Get page UTM breakdown from repository
	breakdown, err := h.service.GetPageUTMBreakdown(c.Request.Context(), websiteID, pagePath, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get page UTM breakdown")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get page UTM breakdown"})
		return
	}

	c.JSON(http.StatusOK, breakdown)
}

func (h *AnalyticsHandler) GetTopReferrers(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	referrers, err := h.service.GetTopReferrers(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top referrers")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top referrers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":    websiteID,
		"date_range":    fmt.Sprintf("%d days", days),
		"top_referrers": referrers,
	})
}

func (h *AnalyticsHandler) GetTopSources(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	sources, err := h.service.GetTopSources(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top sources")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top sources"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":  websiteID,
		"date_range":  fmt.Sprintf("%d days", days),
		"top_sources": sources,
	})
}

func (h *AnalyticsHandler) GetTopCountries(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	countries, err := h.service.GetTopCountries(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top countries")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top countries"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":    websiteID,
		"date_range":    fmt.Sprintf("%d days", days),
		"top_countries": countries,
	})
}

func (h *AnalyticsHandler) GetTopBrowsers(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	browsers, err := h.service.GetTopBrowsers(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top browsers")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top browsers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":   websiteID,
		"date_range":   fmt.Sprintf("%d days", days),
		"top_browsers": browsers,
	})
}

func (h *AnalyticsHandler) GetTopDevices(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	devices, err := h.service.GetTopDevices(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top devices")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top devices"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":  websiteID,
		"date_range":  fmt.Sprintf("%d days", days),
		"top_devices": devices,
	})
}

func (h *AnalyticsHandler) GetTopOS(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	osList, err := h.service.GetTopOS(c.Request.Context(), websiteID, days, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get top OS")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top OS"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id": websiteID,
		"date_range": fmt.Sprintf("%d days", days),
		"top_os":     osList,
	})
}

func (h *AnalyticsHandler) GetTrafficSummary(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	summary, err := h.service.GetTrafficSummary(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get traffic summary")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get traffic summary"})
		return
	}

	c.JSON(http.StatusOK, summary)
}

func (h *AnalyticsHandler) GetDailyStats(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 30
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	// Get real data from database via service
	stats, err := h.service.GetDailyStats(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get daily stats")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get daily stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":  websiteID,
		"date_range":  fmt.Sprintf("%d days", days),
		"daily_stats": stats,
	})
}

func (h *AnalyticsHandler) GetHourlyStats(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	// Get timezone from query parameter, default to UTC
	timezone := c.Query("timezone")
	if timezone == "" {
		timezone = "UTC"
	}

	// Debug logging
	fmt.Printf("DEBUG Handler: timezone=%s\n", timezone)

	// Always fetch last 24 hours for hourly stats
	stats, err := h.service.GetHourlyStats(c.Request.Context(), websiteID, 1, timezone)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get hourly stats")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get hourly stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":   websiteID,
		"date_range":   "24 hours",
		"timezone":     timezone,
		"hourly_stats": stats,
	})
}

func (h *AnalyticsHandler) GetCustomEvents(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	// Get custom events data from repository
	customEvents, err := h.service.GetCustomEvents(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get custom events")
		// Return empty data in the format the frontend expects
		c.JSON(http.StatusOK, gin.H{
			"website_id":    websiteID,
			"date_range":    fmt.Sprintf("%d days", days),
			"top_events":    []interface{}{},
			"timeseries":    []interface{}{},
			"total_events":  0,
			"unique_events": 0,
		})
		return
	}

	// Calculate totals from custom events data
	totalEvents := 0
	uniqueEvents := 0
	for _, event := range customEvents {
		totalEvents += event.Count
		// For now, assume each event type represents a unique event
		uniqueEvents++
	}

	// Get UTM performance data for this website
	utmData, _ := h.service.GetUTMAnalytics(c.Request.Context(), websiteID, days)

	// Transform the data to match frontend expectations
	transformedEvents := gin.H{
		"website_id":      websiteID,
		"date_range":      fmt.Sprintf("%d days", days),
		"top_events":      customEvents,
		"timeseries":      []interface{}{}, // TODO: Add timeseries data
		"total_events":    totalEvents,
		"unique_events":   uniqueEvents,
		"utm_performance": utmData,
	}

	c.JSON(http.StatusOK, transformedEvents)
}

func (h *AnalyticsHandler) GetActivityTrends(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	trends, err := h.service.GetActivityTrends(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get activity trends")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity trends"})
		return
	}

	c.JSON(http.StatusOK, trends)
}

// GetLiveVisitors returns the number of currently active visitors
func (h *AnalyticsHandler) GetLiveVisitors(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	// Get visitors active in the last 5 minutes
	liveVisitors, err := h.service.GetLiveVisitors(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get live visitors")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get live visitors"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":    websiteID,
		"live_visitors": liveVisitors,
		"timestamp":     "now",
	})
}

// GetGeolocationBreakdown returns comprehensive geolocation analytics
func (h *AnalyticsHandler) GetGeolocationBreakdown(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	breakdown, err := h.service.GetGeolocationBreakdown(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get geolocation breakdown")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get geolocation breakdown"})
		return
	}

	c.JSON(http.StatusOK, breakdown)
}

// GetUserRetention returns user retention cohort data
func (h *AnalyticsHandler) GetUserRetention(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 30 // Default to 30 days for retention
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	retention, err := h.service.GetUserRetention(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get user retention data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user retention data"})
		return
	}

	c.JSON(http.StatusOK, retention)
}

// GetVisitorInsights returns visitor insights (new vs returning)
func (h *AnalyticsHandler) GetVisitorInsights(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	insights, err := h.service.GetVisitorInsights(c.Request.Context(), websiteID, days)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get visitor insights")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get visitor insights"})
		return
	}

	c.JSON(http.StatusOK, insights)
}
