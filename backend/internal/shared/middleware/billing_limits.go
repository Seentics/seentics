package middleware

import (
	"analytics-app/internal/modules/billing/models"
	"analytics-app/internal/modules/billing/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BillingLimitMiddleware checks if the user has reached their plan limits for a specific resource
func BillingLimitMiddleware(service *services.BillingService, resourceType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		usage, err := service.GetUserSubscriptionData(c.Request.Context(), userID.(string))
		if err != nil {
			// Fail-safe: allow if billing service is down, or log and block?
			// For now, allow but log.
			c.Next()
			return
		}

		var canCreate bool
		var limit int
		var current int

		switch resourceType {
		case models.ResourceWebsites:
			canCreate = usage.Usage.Websites.CanCreate
			limit = usage.Usage.Websites.Limit
			current = usage.Usage.Websites.Current
		case models.ResourceFunnels:
			canCreate = usage.Usage.Funnels.CanCreate
			limit = usage.Usage.Funnels.Limit
			current = usage.Usage.Funnels.Current
		case models.ResourceAutomations:
			canCreate = usage.Usage.Workflows.CanCreate
			limit = usage.Usage.Workflows.Limit
			current = usage.Usage.Workflows.Current
		default:
			c.Next()
			return
		}

		if !canCreate {
			c.JSON(http.StatusForbidden, gin.H{
				"error":       "Usage limit reached",
				"message":     "You've reached the limit of your current plan.",
				"resource":    resourceType,
				"limit":       limit,
				"current":     current,
				"upgrade_url": "/settings/billing",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
