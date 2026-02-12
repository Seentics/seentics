package middleware

import (
	"analytics-app/internal/shared/utils"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func Logger(logger zerolog.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		clientIP := utils.GetClientIPFromContext(param.Request.Context())
		if clientIP == "" {
			clientIP = param.ClientIP
		}

		logger.Info().
			Str("client_ip", clientIP).
			Str("method", param.Method).
			Str("path", param.Path).
			Int("status", param.StatusCode).
			Dur("latency", param.Latency).
			Str("user_agent", param.Request.UserAgent()).
			Time("timestamp", param.TimeStamp).
			Msg("HTTP Request")
		return ""
	})
}

// ClientIPMiddleware sets the client IP in the context for geolocation
func ClientIPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfIP := c.GetHeader("CF-Connecting-IP")
		xff := c.GetHeader("X-Forwarded-For")
		xri := c.GetHeader("X-Real-IP")

		// Priority 1: Cloudflare real IP
		clientIP := cfIP

		// Priority 2: X-Forwarded-For (standard proxy)
		if clientIP == "" && xff != "" {
			// Get the first IP in the list
			ips := strings.Split(xff, ",")
			clientIP = strings.TrimSpace(ips[0])
		}

		// Priority 3: X-Real-IP
		if clientIP == "" && xri != "" {
			clientIP = xri
		}

		// Priority 4: Gin's built-in ClientIP (X-Real-IP or RemoteAddr)
		if clientIP == "" {
			clientIP = c.ClientIP()
		}

		ctx := utils.SetClientIPInContext(c.Request.Context(), clientIP)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
