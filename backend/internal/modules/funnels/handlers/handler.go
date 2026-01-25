package handlers

import (
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

func (h *FunnelHandler) GetFunnels(c *gin.Context) {
	websiteID := c.Param("website_id")
	// Placeholder
	c.JSON(http.StatusOK, gin.H{"website_id": websiteID, "funnels": []string{}})
}
