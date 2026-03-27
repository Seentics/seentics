package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Seentics/seentics/internal/modules/apikeys"
	"github.com/gin-gonic/gin"
)

// registerRawAPIRoutes mounts the customer-facing read API under /raw/v1.
// Auth: Authorization: Bearer <key>  or  X-API-Key: <key>
func registerRawAPIRoutes(router *gin.Engine, svc *apikeys.Service, h appHandlers) {
	raw := router.Group("/raw/v1", rawAPIAuth(svc))
	ws := raw.Group("/:website_id")
	{
		ws.GET("/analytics/dashboard", h.analytics.GetDashboard)
		ws.GET("/analytics/top-pages", h.analytics.GetTopPages)
		ws.GET("/analytics/top-referrers", h.analytics.GetTopReferrers)
		ws.GET("/analytics/top-sources", h.analytics.GetTopSources)
		ws.GET("/analytics/top-countries", h.analytics.GetTopCountries)
		ws.GET("/analytics/top-browsers", h.analytics.GetTopBrowsers)
		ws.GET("/analytics/top-devices", h.analytics.GetTopDevices)
		ws.GET("/analytics/top-os", h.analytics.GetTopOS)
		ws.GET("/analytics/top-languages", h.analytics.GetTopLanguages)
		ws.GET("/analytics/top-cities", h.analytics.GetTopCities)
		ws.GET("/analytics/traffic-summary", h.analytics.GetTrafficSummary)
		ws.GET("/analytics/activity-trends", h.analytics.GetActivityTrends)
		ws.GET("/analytics/daily-stats", h.analytics.GetDailyStats)
		ws.GET("/analytics/hourly-stats", h.analytics.GetHourlyStats)
		ws.GET("/analytics/custom-events", h.analytics.GetCustomEvents)
		ws.GET("/analytics/visitor-insights", h.analytics.GetVisitorInsights)
		ws.GET("/analytics/recent-activity", h.analytics.GetRecentActivity)
		ws.GET("/analytics/path-analysis", h.analytics.GetPathAnalysis)
		ws.GET("/analytics/realtime", h.analytics.GetRealtimeData)
		ws.GET("/analytics/export", h.analytics.ExportAnalytics)
	}
}

// registerAPIKeyManagementRoutes adds key-management endpoints under the
// existing authenticated /api/v1 group (JWT-authed, same as the dashboard).
func registerAPIKeyManagementRoutes(v1 *gin.RouterGroup, svc *apikeys.Service) {
	g := v1.Group("/user/websites/:website_id/api-keys")
	{
		g.POST("", createAPIKeyHandler(svc))
		g.GET("", listAPIKeysHandler(svc))
		g.DELETE("/:key_id", revokeAPIKeyHandler(svc))
	}
}

// ── Auth middleware ───────────────────────────────────────────────────────────

func rawAPIAuth(svc *apikeys.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := extractBearerKey(c)
		if raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized,
				gin.H{"error": "API key required (Authorization: Bearer <key> or X-API-Key: <key>)"})
			return
		}

		rec, err := svc.Validate(c.Request.Context(), raw)
		if err != nil || !rec.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or revoked API key"})
			return
		}
		if rec.ExpiresAt != nil && time.Now().After(*rec.ExpiresAt) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API key has expired"})
			return
		}
		if wsID := c.Param("website_id"); wsID != "" && wsID != rec.WebsiteID {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "API key not authorized for this website"})
			return
		}

		c.Set("raw_api_website_id", rec.WebsiteID)
		c.Next()
	}
}

func extractBearerKey(c *gin.Context) string {
	if auth := c.GetHeader("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
		return auth[7:]
	}
	return c.GetHeader("X-API-Key")
}

// ── Key management handlers ───────────────────────────────────────────────────

func createAPIKeyHandler(svc *apikeys.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		websiteID := c.Param("website_id")
		userID, _ := c.Get("user_id")

		var req struct {
			Name      string     `json:"name" binding:"required"`
			Scopes    []string   `json:"scopes"`
			ExpiresAt *time.Time `json:"expires_at"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := svc.Create(c.Request.Context(), websiteID, fmt.Sprintf("%v", userID), req.Name, req.Scopes, req.ExpiresAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create API key"})
			return
		}
		c.JSON(http.StatusCreated, result)
	}
}

func listAPIKeysHandler(svc *apikeys.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		keys, err := svc.List(c.Request.Context(), c.Param("website_id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list API keys"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"keys": keys})
	}
}

func revokeAPIKeyHandler(svc *apikeys.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := svc.Revoke(c.Request.Context(), c.Param("key_id"), c.Param("website_id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke API key"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "revoked"})
	}
}
