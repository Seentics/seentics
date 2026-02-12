package handlers

import (
	"analytics-app/internal/modules/funnels/models"
	"analytics-app/internal/modules/funnels/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type FunnelHandler struct {
	service *services.FunnelService
}

func NewFunnelHandler(service *services.FunnelService) *FunnelHandler {
	return &FunnelHandler{
		service: service,
	}
}

func (h *FunnelHandler) getUserID(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	return userID.(string)
}

// ListFunnels godoc
// @Summary List all funnels for a website
// @Tags funnels
// @Produce json
// @Param website_id path string true "Website ID"
// @Success 200 {array} models.Funnel
// @Router /api/websites/{website_id}/funnels [get]
func (h *FunnelHandler) ListFunnels(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")

	funnels, err := h.service.ListFunnels(c.Request.Context(), websiteID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"funnels": funnels,
		"total":   len(funnels),
	})
}

// GetFunnel godoc
// @Summary Get a funnel by ID
// @Tags funnels
// @Produce json
// @Param website_id path string true "Website ID"
// @Param funnel_id path string true "Funnel ID"
// @Success 200 {object} models.Funnel
// @Router /api/websites/{website_id}/funnels/{funnel_id} [get]
func (h *FunnelHandler) GetFunnel(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	funnelID := c.Param("funnel_id")

	funnel, err := h.service.GetFunnel(c.Request.Context(), funnelID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Funnel not found"})
		return
	}

	c.JSON(http.StatusOK, funnel)
}

// CreateFunnel godoc
// @Summary Create a new funnel
// @Tags funnels
// @Accept json
// @Produce json
// @Param website_id path string true "Website ID"
// @Param funnel body models.CreateFunnelRequest true "Funnel data"
// @Success 201 {object} models.Funnel
// @Router /api/websites/{website_id}/funnels [post]
func (h *FunnelHandler) CreateFunnel(c *gin.Context) {
	websiteID := c.Param("website_id")

	var req models.CreateFunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		userID = "system"
	}

	funnel, err := h.service.CreateFunnel(c.Request.Context(), &req, websiteID, userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, funnel)
}

// UpdateFunnel godoc
// @Summary Update an existing funnel
// @Tags funnels
// @Accept json
// @Produce json
// @Param website_id path string true "Website ID"
// @Param funnel_id path string true "Funnel ID"
// @Param funnel body models.UpdateFunnelRequest true "Update data"
// @Success 200 {object} models.Funnel
// @Router /api/websites/{website_id}/funnels/{funnel_id} [put]
func (h *FunnelHandler) UpdateFunnel(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	funnelID := c.Param("funnel_id")

	var req models.UpdateFunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	funnel, err := h.service.UpdateFunnel(c.Request.Context(), funnelID, &req, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, funnel)
}

// DeleteFunnel godoc
// @Summary Delete a funnel
// @Tags funnels
// @Param website_id path string true "Website ID"
// @Param funnel_id path string true "Funnel ID"
// @Success 204
// @Router /api/websites/{website_id}/funnels/{funnel_id} [delete]
func (h *FunnelHandler) DeleteFunnel(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	funnelID := c.Param("funnel_id")

	if err := h.service.DeleteFunnel(c.Request.Context(), funnelID, userID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetFunnelStats godoc
// @Summary Get funnel statistics
// @Tags funnels
// @Produce json
// @Param website_id path string true "Website ID"
// @Param funnel_id path string true "Funnel ID"
// @Success 200 {object} models.FunnelStats
// @Router /api/websites/{website_id}/funnels/{funnel_id}/stats [get]
func (h *FunnelHandler) GetFunnelStats(c *gin.Context) {
	funnelID := c.Param("funnel_id")

	stats, err := h.service.GetFunnelStats(c.Request.Context(), funnelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetActiveFunnels retrieves only active funnels
func (h *FunnelHandler) GetActiveFunnels(c *gin.Context) {
	websiteID := c.Query("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	funnels, err := h.service.GetActiveFunnels(c.Request.Context(), websiteID, origin)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"funnels": funnels,
		"total":   len(funnels),
	})
}

// TrackFunnelEvent records a funnel progression
func (h *FunnelHandler) TrackFunnelEvent(c *gin.Context) {
	var req models.TrackFunnelEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	err := h.service.TrackFunnelEvent(c.Request.Context(), &req, origin)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// TrackBatchFunnelEvents records multiple funnel events
func (h *FunnelHandler) TrackBatchFunnelEvents(c *gin.Context) {
	var req models.BatchFunnelEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	// Process each event
	for _, event := range req.Events {
		// Ensure website ID matches batch request
		event.WebsiteID = req.WebsiteID

		err := h.service.TrackFunnelEvent(c.Request.Context(), &event, origin)
		if err != nil {
			// Log error or continue
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "count": len(req.Events)})
}
