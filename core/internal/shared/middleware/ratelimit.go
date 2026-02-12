package middleware

import (
	"analytics-app/internal/shared/config"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// RateLimitMiddleware enforces rate limits for OSS mode
func RateLimitMiddleware(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting in Cloud Mode as Gateway handles it
		if config.CloudEnabled() {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		clientIP := c.ClientIP()

		// Default limits
		limit := 100
		window := time.Minute
		keyPrefix := "rl:general"
		identifier := clientIP

		// Granular Rate Limiting Logic
		switch {
		case path == "/api/v1/analytics/event" || path == "/api/v1/analytics/batch" || path == "/api/v1/heatmaps/record" || path == "/api/v1/replays/record":
			// Ingestion Endpoints (High throughput) - ALWAYS use IP for ingestion
			limit = 5000
			keyPrefix = "rl:ingest"
			identifier = clientIP
		case path == "/api/v1/user/auth/login" || path == "/api/v1/user/auth/register":
			// Auth Endpoints (Security sensitive)
			limit = 10
			keyPrefix = "rl:auth"
			identifier = clientIP
		case strings.HasPrefix(path, "/api/v1/admin/"):
			// Admin Endpoints
			limit = 50
			keyPrefix = "rl:admin"
			if userID, exists := c.Get("user_id"); exists {
				identifier = userID.(string)
			}
		default:
			// Dashboard/API access
			limit = 200
			keyPrefix = "rl:api"
			if userID, exists := c.Get("user_id"); exists {
				identifier = userID.(string)
			}
		}

		key := fmt.Sprintf("%s:%s", keyPrefix, identifier)
		ctx := c.Request.Context()

		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			// Fail open on Redis errors to avoid blocking the service
			c.Next()
			return
		}

		if count == 1 {
			redisClient.Expire(ctx, key, window)
		}

		if count > int64(limit) {
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
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
