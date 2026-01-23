package middleware

import (
	"analytics-app/utils"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func Logger(logger zerolog.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.Info().
			Str("client_ip", param.ClientIP).
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
		clientIP := c.ClientIP()
		ctx := utils.SetClientIPInContext(c.Request.Context(), clientIP)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
