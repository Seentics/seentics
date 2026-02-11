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

func (h *AutomationHandler) getUserID(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	return userID.(string)
}

// ListAutomations godoc
// @Summary List all automations for a website
// @Tags automations
// @Produce json
// @Param website_id path string true "Website ID"
// @Success 200 {array} models.Automation
// @Router /api/websites/{website_id}/automations [get]
func (h *AutomationHandler) ListAutomations(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Param("website_id")

	automations, err := h.service.ListAutomations(c.Request.Context(), websiteID, userID)
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
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	automationID := c.Param("automation_id")

	automation, err := h.service.GetAutomation(c.Request.Context(), automationID, userID)
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
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	automationID := c.Param("automation_id")

	var req models.UpdateAutomationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	automation, err := h.service.UpdateAutomation(c.Request.Context(), automationID, &req, userID)
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
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	automationID := c.Param("automation_id")

	if err := h.service.DeleteAutomation(c.Request.Context(), automationID, userID); err != nil {
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
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	automationID := c.Param("automation_id")

	automation, err := h.service.ToggleAutomation(c.Request.Context(), automationID, userID)
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
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	automationID := c.Param("automation_id")

	stats, err := h.service.GetAutomationStats(c.Request.Context(), automationID, userID)
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

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	automations, err := h.service.GetActiveAutomations(c.Request.Context(), siteId, origin)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
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

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	err := h.service.TrackExecution(c.Request.Context(), &exec, origin)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// TrackBatchExecutions records multiple action executions
func (h *AutomationHandler) TrackBatchExecutions(c *gin.Context) {
	var req models.BatchExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	// Process each execution
	// In a real optimized scenario, we would use a batch insert in the service/repo
	// For now, we iterate and call the service for each
	for _, exec := range req.Executions {
		// Ensure website ID matches batch request
		exec.WebsiteID = req.WebsiteID

		err := h.service.TrackExecution(c.Request.Context(), &exec, origin)
		if err != nil {
			// Log error but continue processing others?
			// Or fail fast? For analytics, usually best to try to save what we can.
			// Here we continue but could log individual failures.
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "count": len(req.Executions)})
}

// TestAutomation godoc
// @Summary Test an automation with sample data
// @Tags automations
// @Accept json
// @Produce json
// @Param test_request body models.TestAutomationRequest true "Test data"
// @Success 200 {object} models.TestAutomationResult
// @Router /api/automations/test [post]
func (h *AutomationHandler) TestAutomation(c *gin.Context) {
	var req models.TestAutomationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert request to automation model for testing
	automation := &models.Automation{
		ID:            req.Automation.ID,
		Name:          req.Automation.Name,
		TriggerType:   req.Automation.Trigger.Type,
		TriggerConfig: req.Automation.Trigger.Config,
		Conditions:    []models.AutomationCondition{},
		Actions:       []models.AutomationAction{},
	}

	// Convert conditions
	for i, cond := range req.Automation.Conditions {
		automation.Conditions = append(automation.Conditions, models.AutomationCondition{
			ConditionType:   cond.Type,
			ConditionConfig: cond.Config,
			OrderIndex:      i,
		})
	}

	// Convert actions
	for i, action := range req.Automation.Actions {
		automation.Actions = append(automation.Actions, models.AutomationAction{
			ActionType:   action.Type,
			ActionConfig: action.Config,
			OrderIndex:   i,
		})
	}

	// Run test
	result, err := h.service.TestAutomation(c.Request.Context(), automation, req.TestData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
