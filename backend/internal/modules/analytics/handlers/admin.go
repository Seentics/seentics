package handlers

import (
	"analytics-app/internal/modules/analytics/repository"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type AdminHandler struct {
	eventRepo *repository.EventRepository
	logger    zerolog.Logger
}

func NewAdminHandler(eventRepo *repository.EventRepository, logger zerolog.Logger) *AdminHandler {
	return &AdminHandler{
		eventRepo: eventRepo,
		logger:    logger,
	}
}

// GetAnalyticsStats returns analytics statistics for admin dashboard
func (h *AdminHandler) GetAnalyticsStats(c *gin.Context) {
	ctx := c.Request.Context()

	// Get total event count
	totalEvents, err := h.eventRepo.GetTotalEventCount(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get total event count")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch analytics statistics"})
		return
	}

	// Get events today
	eventsToday, err := h.eventRepo.GetEventsToday(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get events today")
		eventsToday = 0 // Default to 0 if error
	}

	// Get unique visitors today
	uniqueVisitorsToday, err := h.eventRepo.GetUniqueVisitorsToday(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get unique visitors today")
		uniqueVisitorsToday = 0 // Default to 0 if error
	}

	// Get total pageviews
	totalPageviews, err := h.eventRepo.GetTotalPageviews(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get total pageviews")
		totalPageviews = 0 // Default to 0 if error
	}

	stats := gin.H{
		"total_events":          totalEvents,
		"events_today":          eventsToday,
		"unique_visitors_today": uniqueVisitorsToday,
		"total_pageviews":       totalPageviews,
	}

	c.JSON(http.StatusOK, stats)
}
