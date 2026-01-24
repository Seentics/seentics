package middleware

import (
	"analytics-app/config"
	"context"
	"fmt"
	"net/http"
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

		// Determine limit and window based on endpoint
		limit := 100
		window := time.Minute
		keyPrefix := "rl:analytics"

		// Higher limits for ingestion endpoints
		if c.Request.URL.Path == "/api/v1/analytics/event" || c.Request.URL.Path == "/api/v1/analytics/event/batch" {
			limit = 5000 // 5000 events per minute per IP for ingestion
			keyPrefix = "rl:ingest"
		}

		// Get client identifier (IP or User ID)
		identifier := c.ClientIP()
		// Only use UserID for non-ingestion endpoints (ingestion is usually anonymous/public)
		if keyPrefix == "rl:analytics" {
			if userID, exists := c.Get("user_id"); exists {
				identifier = userID.(string)
			}
		}

		key := fmt.Sprintf("%s:%s", keyPrefix, identifier)
		ctx := context.Background()

		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			c.Next() // Don't block on Redis error
			return
		}

		if count == 1 {
			redisClient.Expire(ctx, key, window)
		}

		if count > int64(limit) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded",
				"message": "Too many requests. Please slow down.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
