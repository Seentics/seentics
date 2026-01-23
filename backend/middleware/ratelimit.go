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

		// Skip rate limiting for tracking endpoints (those have their own limits/buffers)
		if c.Request.URL.Path == "/api/v1/analytics/event" || c.Request.URL.Path == "/api/v1/analytics/event/batch" {
			c.Next()
			return
		}

		// Get client identifier (IP or User ID)
		identifier := c.ClientIP()
		if userID, exists := c.Get("user_id"); exists {
			identifier = userID.(string)
		}

		ctx := context.Background()
		key := fmt.Sprintf("rl:analytics:%s", identifier)

		// Simple fixed window rate limit (e.g., 100 requests per minute)
		limit := 100
		window := time.Minute

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
