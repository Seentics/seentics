package middleware

import "github.com/gin-gonic/gin"

// SecurityHeadersMiddleware sets HTTP security headers on every response.
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent MIME-type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// Disallow embedding in iframes
		c.Header("X-Frame-Options", "DENY")

		// Force HTTPS for 1 year, include subdomains
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Only send origin on cross-origin requests, full URL on same-origin
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Disable browser features not needed by an API
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		// Restrict what can be loaded — API responses contain no scripts or media
		c.Header("Content-Security-Policy", "default-src 'none'")

		c.Next()
	}
}
