package handlers

import (
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

func (h *AutomationHandler) GetAutomations(c *gin.Context) {
	websiteID := c.Param("website_id")
	// Placeholder
	c.JSON(http.StatusOK, gin.H{"website_id": websiteID, "automations": []string{}})
}
