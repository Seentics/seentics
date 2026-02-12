package middleware

import (
	"analytics-app/internal/shared/config"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// APIKeyMiddleware validates global API key for all requests
func APIKeyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get global API key from environment
		expectedAPIKey := os.Getenv("GLOBAL_API_KEY")
		if expectedAPIKey == "" {
			http.Error(w, "Service configuration error", http.StatusInternalServerError)
			return
		}

		// Get API key from request header
		providedAPIKey := r.Header.Get("X-API-Key")
		if providedAPIKey == "" {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		// Validate API key using simple string comparison
		if providedAPIKey != expectedAPIKey {
			http.Error(w, "Invalid authentication", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// UnifiedAuthMiddleware handles authentication based on deployment mode (Cloud vs OSS)
func UnifiedAuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Cloud Mode: All auth handled by Gateway
		if config.CloudEnabled() {
			// Validate internal API key from Gateway
			providedAPIKey := c.GetHeader("X-API-Key")
			if providedAPIKey == "" || providedAPIKey != cfg.GlobalAPIKey {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized inter-service request"})
				c.Abort()
				return
			}

			// Extract user info passed from Gateway headers
			c.Set("user_id", c.GetHeader("X-User-ID"))
			c.Set("user_email", c.GetHeader("X-User-Email"))
			c.Set("user_plan", c.GetHeader("X-User-Plan"))
			c.Set("user_role", c.GetHeader("X-User-Role"))

			c.Next()
			return
		}

		// 2. OSS Mode: Standalone JWT validation
		// Allow public tracking endpoints and websocket handshake
		if c.Request.URL.Path == "/api/v1/analytics/event" ||
			c.Request.URL.Path == "/api/v1/analytics/batch" ||
			strings.HasSuffix(c.Request.URL.Path, "/pulse") {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			var userID string
			switch val := claims["user_id"].(type) {
			case string:
				userID = val
			case float64:
				userID = fmt.Sprintf("%.0f", val)
			default:
				userID = fmt.Sprintf("%v", val)
			}

			c.Set("user_id", userID)
			c.Set("user_email", claims["email"])
		}

		c.Next()
	}
}

// RoleMiddleware checks if the user has the required role
func RoleMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists || role != requiredRole {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: insufficient permissions"})
			c.Abort()
			return
		}
		c.Next()
	}
}
