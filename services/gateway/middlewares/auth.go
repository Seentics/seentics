package middlewares

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/seentics/seentics/services/gateway/cache"
	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
	"github.com/seentics/seentics/services/gateway/utils"
)

// Auth middleware with 3 request types
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		routeType := utils.GetRouteType(r.URL.Path)

		switch routeType {
		case "unprotected":
			// No validation needed

		case "public":
			// Validate domain/siteId for public website requests
			if err := utils.ValidatePublicRequest(w, r, cache.ValidateWebsite, WebsiteContextKey); err != nil {
				http.Error(w, err.Error(), http.StatusForbidden)
				return
			}

		case "protected":
			// Validate JWT token
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}
			token := strings.TrimPrefix(authHeader, "Bearer ")

			// Validate token and get claims
			claims, err := cache.ValidateJWTToken(token)
			if err != nil {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}

			// Fetch full user from DB for roles/permissions
			var user models.User
			userID := uint(claims["user_id"].(float64))
			if err := database.DB.First(&user, userID).Error; err != nil {
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			}

			// Propagate user info to downstream services via headers
			r.Header.Set("X-User-ID", strconv.FormatUint(uint64(user.ID), 10))
			r.Header.Set("X-User-Email", user.Email)
			r.Header.Set("X-User-Plan", user.Plan)
			r.Header.Set("X-User-Role", user.Role)

			// Add full user object to context for internal handlers
			ctx := context.WithValue(r.Context(), UserContextKey, &user)
			*r = *r.WithContext(ctx)
		}

		next.ServeHTTP(w, r)
	})
}
