package handlers

import (
	"analytics-app/internal/modules/billing/services"
	"fmt"
	"net/http"
	"os"
	"strings"

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

// CreateCheckout creates a Lemon Squeezy checkout URL for a plan
func (h *BillingHandler) CreateCheckout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Plan string `json:"plan" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Checkout links mapping
	// Growth: https://seentics.lemonsqueezy.com/checkout/buy/8494299b-f420-4332-9645-dc7a8367f737
	checkoutLinks := map[string]string{
		"growth":   "https://seentics.lemonsqueezy.com/checkout/buy/ffe14f0b-843d-44b2-80fd-f9f38e4ed24a",
		"scale":    "https://seentics.lemonsqueezy.com/checkout/buy/PLACEHOLDER_SCALE_ID",
		"pro_plus": "https://seentics.lemonsqueezy.com/checkout/buy/PLACEHOLDER_PRO_PLUS_ID",
	}

	baseUrl, ok := checkoutLinks[req.Plan]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan or plan has no checkout link"})
		return
	}

	// Append user_id as custom data for LS tracking
	// LS allows custom data via checkout[custom][key] query params
	checkoutUrl := fmt.Sprintf("%s?checkout[custom][user_id]=%s", baseUrl, userID.(string))

	// If store is in test mode, append test=1
	// We check if ENVIRONMENT is not production to enable test mode automatically
	env := os.Getenv("ENVIRONMENT")
	if env != "production" {
		if !strings.Contains(checkoutUrl, "test=1") {
			if strings.Contains(checkoutUrl, "?") {
				checkoutUrl += "&test=1"
			} else {
				checkoutUrl += "?test=1"
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"checkoutUrl": checkoutUrl,
		},
	})
}

// CreatePortalSession returns a URL for the user to manage their billing
func (h *BillingHandler) CreatePortalSession(c *gin.Context) {
	// Lemon Squeezy doesn't have a direct portal session API like Stripe
	// Users usually manage via the link in their email or a generic customer portal
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url": "https://seentics.lemonsqueezy.com/billing",
		},
	})
}

// CancelSubscription returns the portal URL for cancellation
func (h *BillingHandler) CancelSubscription(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url": "https://seentics.lemonsqueezy.com/billing",
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

// Webhook handles incoming webhooks from Lemon Squeezy
func (h *BillingHandler) Webhook(c *gin.Context) {
	// Verify Lemon Squeezy signature
	signature := c.GetHeader("X-Signature")
	if signature == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing signature"})
		return
	}

	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	if err := h.service.HandleLemonSqueezyWebhook(c.Request.Context(), body, signature); err != nil {
		h.logger.Error().Err(err).Msg("Failed to handle Lemon Squeezy webhook")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Webhook processing failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// SimulateWebhook allows triggering a webhook event without signature verification (Dev only)
func (h *BillingHandler) SimulateWebhook(c *gin.Context) {
	if os.Getenv("ENVIRONMENT") == "production" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not allowed in production"})
		return
	}

	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	// Create a dummy signature that the service's verification will accept or we skip verification
	// Let's modify HandleLemonSqueezyWebhook to accept a skip flag or just call a separate logic
	// For simplicity, we'll just parse and update here or add a bypass to the service.

	// Actually, let's just make the service verification optional in dev
	if err := h.service.HandleLemonSqueezyWebhook(c.Request.Context(), body, "SKIP_VERIFICATION"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Simulation successful"})
}
