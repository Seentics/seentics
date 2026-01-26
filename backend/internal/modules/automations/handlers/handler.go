package handlers

import (
	"analytics-app/internal/modules/automations/models"
	"analytics-app/internal/modules/automations/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AutomationHandler struct {
	service *services.AutomationService
}

func NewAutomationHandler(service *services.AutomationService) *AutomationHandler {
	return &AutomationHandler{
		service: service,
	}
}

// ListAutomations godoc
// @Summary List all automations for a website
// @Tags automations
// @Produce json
// @Param website_id path string true "Website ID"
// @Success 200 {array} models.Automation
// @Router /api/websites/{website_id}/automations [get]
func (h *AutomationHandler) ListAutomations(c *gin.Context) {
	websiteID := c.Param("website_id")

	automations, err := h.service.ListAutomations(c.Request.Context(), websiteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"automations": automations,
		"total":       len(automations),
	})
}

// GetAutomation godoc
// @Summary Get a single automation by ID
// @Tags automations
// @Produce json
// @Param website_id path string true "Website ID"
// @Param automation_id path string true "Automation ID"
// @Success 200 {object} models.Automation
// @Router /api/websites/{website_id}/automations/{automation_id} [get]
func (h *AutomationHandler) GetAutomation(c *gin.Context) {
	automationID := c.Param("automation_id")

	automation, err := h.service.GetAutomation(c.Request.Context(), automationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Automation not found"})
		return
	}

	c.JSON(http.StatusOK, automation)
}

// CreateAutomation godoc
// @Summary Create a new automation
// @Tags automations
// @Accept json
// @Produce json
// @Param website_id path string true "Website ID"
// @Param automation body models.CreateAutomationRequest true "Automation data"
// @Success 201 {object} models.Automation
// @Router /api/websites/{website_id}/automations [post]
func (h *AutomationHandler) CreateAutomation(c *gin.Context) {
	websiteID := c.Param("website_id")

	var req models.CreateAutomationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (assuming it's set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		userID = "system" // fallback
	}

	automation, err := h.service.CreateAutomation(c.Request.Context(), &req, websiteID, userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, automation)
}

// UpdateAutomation godoc
// @Summary Update an existing automation
// @Tags automations
// @Accept json
// @Produce json
// @Param website_id path string true "Website ID"
// @Param automation_id path string true "Automation ID"
// @Param automation body models.UpdateAutomationRequest true "Update data"
// @Success 200 {object} models.Automation
// @Router /api/websites/{website_id}/automations/{automation_id} [put]
func (h *AutomationHandler) UpdateAutomation(c *gin.Context) {
	automationID := c.Param("automation_id")

	var req models.UpdateAutomationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	automation, err := h.service.UpdateAutomation(c.Request.Context(), automationID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, automation)
}

// DeleteAutomation godoc
// @Summary Delete an automation
// @Tags automations
// @Param website_id path string true "Website ID"
// @Param automation_id path string true "Automation ID"
// @Success 204
// @Router /api/websites/{website_id}/automations/{automation_id} [delete]
func (h *AutomationHandler) DeleteAutomation(c *gin.Context) {
	automationID := c.Param("automation_id")

	err := h.service.DeleteAutomation(c.Request.Context(), automationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ToggleAutomation godoc
// @Summary Toggle automation active status
// @Tags automations
// @Produce json
// @Param website_id path string true "Website ID"
// @Param automation_id path string true "Automation ID"
// @Success 200 {object} models.Automation
// @Router /api/websites/{website_id}/automations/{automation_id}/toggle [post]
func (h *AutomationHandler) ToggleAutomation(c *gin.Context) {
	automationID := c.Param("automation_id")

	automation, err := h.service.ToggleAutomation(c.Request.Context(), automationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, automation)
}

// GetAutomationStats godoc
// @Summary Get automation statistics
// @Tags automations
// @Produce json
// @Param website_id path string true "Website ID"
// @Param automation_id path string true "Automation ID"
// @Success 200 {object} models.AutomationStats
// @Router /api/websites/{website_id}/automations/{automation_id}/stats [get]
func (h *AutomationHandler) GetAutomationStats(c *gin.Context) {
	automationID := c.Param("automation_id")

	stats, err := h.service.GetAutomationStats(c.Request.Context(), automationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetActiveWorkflows retrieves active automations for a site
func (h *AutomationHandler) GetActiveWorkflows(c *gin.Context) {
	siteId := c.Param("website_id")
	if siteId == "" {
		siteId = c.Query("website_id")
	}

	if siteId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	automations, err := h.service.GetActiveAutomations(c.Request.Context(), siteId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"workflows": automations,
		"total":     len(automations),
	})
}

// TrackExecution records an action execution
func (h *AutomationHandler) TrackExecution(c *gin.Context) {
	var exec models.AutomationExecution
	if err := c.ShouldBindJSON(&exec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.TrackExecution(c.Request.Context(), &exec)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
