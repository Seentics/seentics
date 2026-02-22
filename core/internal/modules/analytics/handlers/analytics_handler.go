package handlers

import (
	"analytics-app/internal/modules/analytics/models"
	"analytics-app/internal/modules/analytics/services"
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

func (h *AnalyticsHandler) getUserID(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	return userID.(string)
}

func (h *AnalyticsHandler) parseTimezone(c *gin.Context) string {
	tz := c.DefaultQuery("timezone", "UTC")
	if tz == "" {
		return "UTC"
	}
	return tz
}

func (h *AnalyticsHandler) parseDays(c *gin.Context, defaultDays int) int {
	days := defaultDays
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}
	return days
}

func (h *AnalyticsHandler) parseLimit(c *gin.Context, defaultLimit int) int {
	limit := defaultLimit
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}
	return limit
}

func (h *AnalyticsHandler) parseFilters(c *gin.Context) models.AnalyticsFilters {
	return models.AnalyticsFilters{
		Country:     c.Query("country"),
		Device:      c.Query("device"),
		Browser:     c.Query("browser"),
		OS:          c.Query("os"),
		UTMSource:   c.Query("utm_source"),
		UTMMedium:   c.Query("utm_medium"),
		UTMCampaign: c.Query("utm_campaign"),
		PagePath:    c.Query("page_path"),
	}
}

func (h *AnalyticsHandler) handleError(c *gin.Context, err error, msg string) {
	h.logger.Error().Err(err).Msg(msg)

	status := http.StatusInternalServerError
	errStr := err.Error()
	if errStr == "website not found" {
		status = http.StatusNotFound
	} else if errStr == "unauthorized access to website data" || errStr == "unauthorized" {
		status = http.StatusForbidden
	}

	c.JSON(status, gin.H{"error": errStr})
}

func (h *AnalyticsHandler) GetDashboard(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	data, err := h.service.GetDashboard(c.Request.Context(), websiteID, days, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get dashboard data")
		return
	}

	c.JSON(http.StatusOK, data)
}

func (h *AnalyticsHandler) GetTopPages(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	pages, err := h.service.GetTopPages(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top pages")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id": websiteID,
		"top_pages":  pages,
	})
}

func (h *AnalyticsHandler) GetPageUTMBreakdown(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

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

	days := h.parseDays(c, 7)

	breakdown, err := h.service.GetPageUTMBreakdown(c.Request.Context(), websiteID, pagePath, days, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get page UTM breakdown")
		return
	}

	c.JSON(http.StatusOK, breakdown)
}

func (h *AnalyticsHandler) GetTopReferrers(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	referrers, err := h.service.GetTopReferrers(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top referrers")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":    websiteID,
		"top_referrers": referrers,
	})
}

func (h *AnalyticsHandler) GetTopSources(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	sources, err := h.service.GetTopSources(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top sources")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":  websiteID,
		"top_sources": sources,
	})
}

func (h *AnalyticsHandler) GetTopCountries(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	countries, err := h.service.GetTopCountries(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top countries")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":    websiteID,
		"top_countries": countries,
	})
}

func (h *AnalyticsHandler) GetTopResolutions(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)

	resolutions, err := h.service.GetTopResolutions(c.Request.Context(), websiteID, days, limit, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top resolutions")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":      websiteID,
		"top_resolutions": resolutions,
	})
}

func (h *AnalyticsHandler) GetTopBrowsers(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	browsers, err := h.service.GetTopBrowsers(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top browsers")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":   websiteID,
		"top_browsers": browsers,
	})
}

func (h *AnalyticsHandler) GetTopDevices(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	devices, err := h.service.GetTopDevices(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top devices")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":  websiteID,
		"top_devices": devices,
	})
}

func (h *AnalyticsHandler) GetTopOS(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	limit := h.parseLimit(c, 10)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	osList, err := h.service.GetTopOS(c.Request.Context(), websiteID, days, limit, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get top OS")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id": websiteID,
		"top_os":     osList,
	})
}

func (h *AnalyticsHandler) GetTrafficSummary(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	timezone := h.parseTimezone(c)

	summary, err := h.service.GetTrafficSummary(c.Request.Context(), websiteID, days, timezone, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get traffic summary")
		return
	}

	c.JSON(http.StatusOK, summary)
}

func (h *AnalyticsHandler) GetDailyStats(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 30)
	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	stats, err := h.service.GetDailyStats(c.Request.Context(), websiteID, days, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get daily stats")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":  websiteID,
		"daily_stats": stats,
		"timezone":    timezone,
	})
}

func (h *AnalyticsHandler) GetHourlyStats(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	timezone := h.parseTimezone(c)
	filters := h.parseFilters(c)

	stats, err := h.service.GetHourlyStats(c.Request.Context(), websiteID, 1, timezone, filters, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get hourly stats")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":   websiteID,
		"timezone":     timezone,
		"hourly_stats": stats,
	})
}

func (h *AnalyticsHandler) GetCustomEvents(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)

	customEvents, err := h.service.GetCustomEvents(c.Request.Context(), websiteID, days, userID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get custom events")
		c.JSON(http.StatusOK, gin.H{
			"website_id":    websiteID,
			"top_events":    []interface{}{},
			"timeseries":    []interface{}{},
			"total_events":  0,
			"unique_events": 0,
		})
		return
	}

	totalEvents := 0
	uniqueEvents := 0
	for _, event := range customEvents {
		totalEvents += event.Count
		uniqueEvents++
	}

	utmData, _ := h.service.GetUTMAnalytics(c.Request.Context(), websiteID, days, userID)

	c.JSON(http.StatusOK, gin.H{
		"website_id":      websiteID,
		"top_events":      customEvents,
		"timeseries":      []interface{}{},
		"total_events":    totalEvents,
		"unique_events":   uniqueEvents,
		"utm_performance": utmData,
	})
}

func (h *AnalyticsHandler) GetGoalStats(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)

	stats, err := h.service.GetGoalStats(c.Request.Context(), websiteID, days, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get goal stats")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id": websiteID,
		"goals":      stats,
	})
}

func (h *AnalyticsHandler) GetLiveVisitors(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	liveVisitors, err := h.service.GetLiveVisitors(c.Request.Context(), websiteID, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get live visitors")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":    websiteID,
		"live_visitors": liveVisitors,
	})
}

func (h *AnalyticsHandler) GetGeolocationBreakdown(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	timezone := h.parseTimezone(c)

	breakdown, err := h.service.GetGeolocationBreakdown(c.Request.Context(), websiteID, days, timezone, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get geolocation breakdown")
		return
	}

	c.JSON(http.StatusOK, breakdown)
}

func (h *AnalyticsHandler) GetUserRetention(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 30)

	retention, err := h.service.GetUserRetention(c.Request.Context(), websiteID, days, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get user retention data")
		return
	}

	c.JSON(http.StatusOK, retention)
}

func (h *AnalyticsHandler) GetVisitorInsights(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	timezone := h.parseTimezone(c)

	insights, err := h.service.GetVisitorInsights(c.Request.Context(), websiteID, days, timezone, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get visitor insights")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"website_id":       websiteID,
		"visitor_insights": insights,
	})
}

func (h *AnalyticsHandler) ExportAnalytics(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	days := h.parseDays(c, 7)
	format := c.DefaultQuery("format", "json")

	data, err := h.service.ExportWebsiteData(c.Request.Context(), websiteID, days, format, userID)
	if err != nil {
		h.handleError(c, err, "Failed to export analytics data")
		return
	}

	filename := fmt.Sprintf("analytics-%s-%d-days.%s", websiteID, days, format)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	if format == "csv" {
		c.Data(http.StatusOK, "text/csv", data)
	} else {
		c.Data(http.StatusOK, "application/json", data)
	}
}

func (h *AnalyticsHandler) ImportAnalytics(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.PostForm("websiteId")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "websiteId is required"})
		return
	}

	source := c.DefaultPostForm("source", "seentics")

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open file"})
		return
	}
	defer file.Close()

	data := make([]byte, fileHeader.Size)
	_, err = file.Read(data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	count, err := h.service.ImportWebsiteData(c.Request.Context(), websiteID, source, data, userID)
	if err != nil {
		h.handleError(c, err, "Failed to import analytics data")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data imported successfully",
		"count":   count,
	})
}

func (h *AnalyticsHandler) GetActivityTrends(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	timezone := h.parseTimezone(c)

	data, err := h.service.GetActivityTrends(c.Request.Context(), websiteID, timezone, userID)
	if err != nil {
		h.handleError(c, err, "Failed to get activity trends")
		return
	}

	c.JSON(http.StatusOK, data)
}
