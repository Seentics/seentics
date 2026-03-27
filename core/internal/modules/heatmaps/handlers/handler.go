package handlers

import (
	"net/http"

	"github.com/Seentics/seentics/internal/modules/heatmaps/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// HeatmapHandler exposes heatmap endpoints
type HeatmapHandler struct {
	service *services.HeatmapService
	logger  zerolog.Logger
}

// NewHeatmapHandler creates a new HeatmapHandler
func NewHeatmapHandler(service *services.HeatmapService, logger zerolog.Logger) *HeatmapHandler {
	return &HeatmapHandler{service: service, logger: logger}
}

// ListPages godoc
// GET /heatmaps/:website_id/pages
func (h *HeatmapHandler) ListPages(c *gin.Context) {
	websiteID, err := uuid.Parse(c.Param("website_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid website_id"})
		return
	}

	pages, err := h.service.ListPages(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID.String()).Msg("heatmap: list pages failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"pages": pages})
}

// GetHeatmap godoc
// GET /heatmaps/:website_id/data?page_path=&event_type=
func (h *HeatmapHandler) GetHeatmap(c *gin.Context) {
	websiteID, err := uuid.Parse(c.Param("website_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid website_id"})
		return
	}

	pagePath := c.Query("page_path")
	if pagePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page_path is required"})
		return
	}

	eventType := c.Query("event_type")
	if eventType == "" {
		eventType = "click"
	}

	data, err := h.service.GetHeatmap(c.Request.Context(), websiteID, pagePath, eventType)
	if err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID.String()).Msg("heatmap: get data failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}
