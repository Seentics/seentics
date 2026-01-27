package handlers

import (
	"analytics-app/internal/modules/billing/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type BillingHandler struct {
	service *services.BillingService
	logger  zerolog.Logger
}

func NewBillingHandler(service *services.BillingService, logger zerolog.Logger) *BillingHandler {
	return &BillingHandler{
		service: service,
		logger:  logger,
	}
}

// GetUsage retrieves current usage stats for the authenticated user
func (h *BillingHandler) GetUsage(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	usage, err := h.service.GetUserSubscriptionData(c.Request.Context(), userID.(string))
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.(string)).Msg("Failed to fetch usage")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch usage data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    usage,
	})
}

// CreateCheckout creates a Paddle checkout URL for a plan
func (h *BillingHandler) CreateCheckout(c *gin.Context) {
	var req struct {
		Plan string `json:"plan" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real scenario, this would generate a Paddle pay-link
	// For now, we'll return a mock URL
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"checkoutUrl": "https://buy.paddle.com/checkout/mock",
		},
	})
}

// CreatePortalSession returns a URL for the user to manage their billing
func (h *BillingHandler) CreatePortalSession(c *gin.Context) {
	// In a real scenario, this would return a Paddle customer portal URL
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url": "https://buy.paddle.com/customer-portal/mock",
		},
	})
}

// SelectFreePlan initializes a free subscription for the authenticated user
func (h *BillingHandler) SelectFreePlan(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := h.service.SelectFreePlan(c.Request.Context(), userID.(string)); err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.(string)).Msg("Failed to select free plan")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate free plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Free plan activated successfully",
	})
}

// PaddleWebhook handles incoming webhooks from Paddle
func (h *BillingHandler) PaddleWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	if err := h.service.HandlePaddleWebhook(c.Request.Context(), payload); err != nil {
		h.logger.Error().Err(err).Msg("Failed to handle Paddle webhook")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Webhook processing failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
