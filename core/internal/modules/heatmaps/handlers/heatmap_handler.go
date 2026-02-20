package handlers

import (
	"analytics-app/internal/modules/heatmaps/models"
	"analytics-app/internal/modules/heatmaps/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type HeatmapHandler struct {
	service services.HeatmapService
	logger  zerolog.Logger
}

func NewHeatmapHandler(service services.HeatmapService, logger zerolog.Logger) *HeatmapHandler {
	return &HeatmapHandler{
		service: service,
		logger:  logger,
	}
}

func (h *HeatmapHandler) getUserID(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	return userID.(string)
}

// RecordHeatmap handles incoming heatmap data (batch of points)
func (h *HeatmapHandler) RecordHeatmap(c *gin.Context) {
	var req models.HeatmapRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Debug().Int("points", len(req.Points)).Str("website_id", req.WebsiteID).Msg("Recording heatmap data")

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	h.logger.Debug().Str("origin", origin).Str("website_id", req.WebsiteID).Msg("Heatmap request origin")

	if err := h.service.RecordHeatmapData(req, origin); err != nil {
		h.logger.Error().Err(err).Str("website_id", req.WebsiteID).Str("origin", origin).Msg("Failed to record heatmap")
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// GetHeatmapData returns aggregated heatmap points for visualization
func (h *HeatmapHandler) GetHeatmapData(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	url := c.Query("url")
	heatmapType := c.DefaultQuery("type", "click")
	deviceType := c.DefaultQuery("device", "desktop")

	if websiteID == "" || url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id and url are required"})
		return
	}

	// Default to last 30 days
	to := time.Now()
	from := to.AddDate(0, 0, -30)

	h.logger.Debug().Str("website_id", websiteID).Str("url", url).Str("type", heatmapType).Str("device", deviceType).Msg("Fetching heatmap data")

	points, err := h.service.GetHeatmapData(c.Request.Context(), websiteID, url, heatmapType, deviceType, from, to, userID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to fetch heatmap data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch heatmap data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"points": points})
}

func (h *HeatmapHandler) GetHeatmapPages(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	h.logger.Debug().Str("website_id", websiteID).Msg("Getting heatmap pages")

	pages, err := h.service.GetHeatmapPages(c.Request.Context(), websiteID, userID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get heatmap pages")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get heatmap pages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"pages": pages})
}
func (h *HeatmapHandler) DeleteHeatmapPage(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	url := c.Query("url")

	if websiteID == "" || url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id and url are required"})
		return
	}

	h.logger.Debug().Str("website_id", websiteID).Str("url", url).Msg("Deleting heatmap page")

	if err := h.service.DeleteHeatmapPage(c.Request.Context(), websiteID, url, userID); err != nil {
		h.logger.Error().Err(err).Msg("Failed to delete heatmap page")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete heatmap page"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *HeatmapHandler) BulkDeleteHeatmapPages(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.BulkDeleteHeatmapRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Debug().Str("website_id", req.WebsiteID).Int("urls", len(req.URLs)).Msg("Bulk deleting heatmap pages")

	if err := h.service.BulkDeleteHeatmapPages(c.Request.Context(), req.WebsiteID, req.URLs, userID); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bulk delete heatmap pages")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk delete heatmap pages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
