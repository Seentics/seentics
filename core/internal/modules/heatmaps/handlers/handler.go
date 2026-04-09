package handlers

import (
	"net/http"
	"strings"

	"github.com/Seentics/seentics/internal/modules/heatmaps/services"
	websiteServices "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// HeatmapHandler exposes heatmap endpoints
type HeatmapHandler struct {
	service  *services.HeatmapService
	websites *websiteServices.WebsiteService
	logger   zerolog.Logger
}

// NewHeatmapHandler creates a new HeatmapHandler
func NewHeatmapHandler(service *services.HeatmapService, websites *websiteServices.WebsiteService, logger zerolog.Logger) *HeatmapHandler {
	return &HeatmapHandler{service: service, websites: websites, logger: logger}
}

func (h *HeatmapHandler) resolveWebsiteUUID(c *gin.Context) (uuid.UUID, bool) {
	raw := strings.TrimSpace(c.Param("website_id"))
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return uuid.Nil, false
	}
	if _, err := uuid.Parse(raw); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid website_id"})
		return uuid.Nil, false
	}
	w, err := h.websites.GetWebsiteByID(c.Request.Context(), raw)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found"})
		return uuid.Nil, false
	}
	return w.ID, true
}

// ListPages godoc
// GET /heatmaps/:website_id/pages
func (h *HeatmapHandler) ListPages(c *gin.Context) {
	websiteID, ok := h.resolveWebsiteUUID(c)
	if !ok {
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
	websiteID, ok := h.resolveWebsiteUUID(c)
	if !ok {
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
// DeleteHeatmaps godoc
// DELETE /heatmaps/:website_id/bulk-delete
func (h *HeatmapHandler) DeleteHeatmaps(c *gin.Context) {
	websiteID, ok := h.resolveWebsiteUUID(c)
	if !ok {
		return
	}

	var req struct {
		PagePaths []string `json:"pagePaths"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.DeleteHeatmaps(c.Request.Context(), websiteID, req.PagePaths); err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID.String()).Msg("heatmap: bulk delete failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
