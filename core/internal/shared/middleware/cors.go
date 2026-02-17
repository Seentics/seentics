package middleware

import (
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

// isLocalhostOrigin returns true when the origin's host is localhost or 127.0.0.1,
// regardless of port. Used to allow any local development server port.
func isLocalhostOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return host == "localhost" || host == "127.0.0.1"
}

// CORSMiddleware handles Cross-Origin Resource Sharing
func CORSMiddleware(allowedOrigins string) gin.HandlerFunc {
	origins := strings.Split(allowedOrigins, ",")

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if the origin is allowed
		allowThisOrigin := false
		if allowedOrigins == "*" || allowedOrigins == "" {
			allowThisOrigin = true
		} else if origin != "" && isLocalhostOrigin(origin) {
			// Allow any localhost port in development so tracker scripts work
			// from test sites running on arbitrary ports (e.g. :5173, :4000, etc.)
			allowThisOrigin = true
		} else {
			for _, o := range origins {
				o = strings.TrimSpace(o)
				if o == origin {
					allowThisOrigin = true
					break
				}
			}
		}

		if allowThisOrigin && origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if allowedOrigins == "*" || allowedOrigins == "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-API-Key, X-Site-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
