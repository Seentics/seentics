package handlers

import (
	"fmt"
	"net/http"

	"github.com/Seentics/seentics/internal/modules/automations/models"
	"github.com/Seentics/seentics/internal/modules/automations/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// AutomationHandler exposes automation management endpoints
type AutomationHandler struct {
	service *services.AutomationService
	logger  zerolog.Logger
}

// NewAutomationHandler creates a new AutomationHandler
func NewAutomationHandler(service *services.AutomationService, logger zerolog.Logger) *AutomationHandler {
	return &AutomationHandler{service: service, logger: logger}
}

func (h *AutomationHandler) getUserID(c *gin.Context) string {
	if v, exists := c.Get("user_id"); exists {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// Create godoc
// POST /websites/:website_id/automations
func (h *AutomationHandler) Create(c *gin.Context) {
	websiteID := c.Param("website_id")
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.CreateAutomationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	auto, err := h.service.Create(c.Request.Context(), websiteID, userID, req)
	if err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID).Msg("automation: create failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, auto)
}

// List godoc
// GET /websites/:website_id/automations
func (h *AutomationHandler) List(c *gin.Context) {
	websiteID := c.Param("website_id")

	automations, err := h.service.List(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID).Msg("automation: list failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"automations": automations})
}

// Get godoc
// GET /websites/:website_id/automations/:id
func (h *AutomationHandler) Get(c *gin.Context) {
	websiteID := c.Param("website_id")
	id := c.Param("id")

	auto, err := h.service.Get(c.Request.Context(), id, websiteID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "automation not found"})
		return
	}

	c.JSON(http.StatusOK, auto)
}

// Update godoc
// PUT /websites/:website_id/automations/:id
func (h *AutomationHandler) Update(c *gin.Context) {
	websiteID := c.Param("website_id")
	id := c.Param("id")

	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	auto, err := h.service.Update(c.Request.Context(), id, websiteID, req)
	if err != nil {
		h.logger.Error().Err(err).Str("id", id).Msg("automation: update failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, auto)
}

// Delete godoc
// DELETE /websites/:website_id/automations/:id
func (h *AutomationHandler) Delete(c *gin.Context) {
	websiteID := c.Param("website_id")
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id, websiteID); err != nil {
		h.logger.Error().Err(err).Str("id", id).Msg("automation: delete failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListExecutions godoc
// GET /websites/:website_id/automations/:id/executions
func (h *AutomationHandler) ListExecutions(c *gin.Context) {
	websiteID := c.Param("website_id")
	id := c.Param("id")

	limit := 50
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	execs, err := h.service.ListExecutions(c.Request.Context(), id, websiteID, limit)
	if err != nil {
		h.logger.Error().Err(err).Str("id", id).Msg("automation: list executions failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"executions": execs})
}
// BulkDelete godoc
// DELETE /websites/:website_id/automations/bulk-delete
func (h *AutomationHandler) BulkDelete(c *gin.Context) {
	websiteID := c.Param("website_id")
	var req struct {
		AutomationIDs []string `json:"automationIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.BulkDelete(c.Request.Context(), websiteID, req.AutomationIDs); err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID).Msg("automation: bulk delete failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
