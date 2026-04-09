package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/Seentics/seentics/internal/shared/cache"
)

// RateLimitMiddleware enforces rate limits for the core service.
func RateLimitMiddleware(appCache *cache.Cache) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		clientIP := c.ClientIP()

		// Default limits
		limit := int64(200)
		window := time.Minute
		keyPrefix := "rl:api"
		identifier := clientIP

		// Granular Rate Limiting Logic
		switch {
		case strings.HasPrefix(path, "/api/v1/internal/"):
			// Internal API (Gateway to Core) - High limit but protected
			limit = 2000
			keyPrefix = "rl:internal"
			identifier = clientIP // Could also use a specific identifier if needed
		case path == "/api/v1/tracker/collect":
			// Tracker endpoints — called by browsers every 10s.
			// 60 req/min gives ~10x headroom over normal usage and stops flooding.
			limit = 60
			keyPrefix = "rl:tracker"
			identifier = clientIP
		case path == "/api/v1/analytics/event" || path == "/api/v1/analytics/batch" || path == "/api/v1/heatmaps/record" || path == "/api/v1/replays/record" || path == "/api/v1/funnels/track" || path == "/api/v1/funnels/batch":
			// Ingestion Endpoints (High throughput)
			limit = 10000
			keyPrefix = "rl:ingest"
			identifier = clientIP
		case strings.Contains(path, "/auth/login") || strings.Contains(path, "/auth/register"):
			// Auth Endpoints (Security sensitive)
			limit = 20
			keyPrefix = "rl:auth"
			identifier = clientIP
		case strings.HasPrefix(path, "/api/v1/admin/"):
			// Admin Endpoints
			limit = 100
			keyPrefix = "rl:admin"
			if userID, exists := c.Get("user_id"); exists {
				identifier = userID.(string)
			}
		case strings.HasPrefix(path, "/api/v1/analytics/"):
			// Analytics query endpoints — expensive ClickHouse queries
			limit = 300
			keyPrefix = "rl:analytics"
			if userID, exists := c.Get("user_id"); exists {
				identifier = userID.(string)
			}
		default:
			// General Dashboard/API access
			if userID, exists := c.Get("user_id"); exists {
				identifier = userID.(string)
			}
		}

		key := fmt.Sprintf("%s:%s", keyPrefix, identifier)

		allowed, state := appCache.RateLimit(key, cache.RateLimitOptions{
			Limit:  limit,
			Window: window,
		})

		if !allowed {
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", state.Limit))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("Retry-After", "60")

			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded",
				"message": "Too many requests. Please try again later.",
			})
			return
		}

		c.Next()
	}
}
