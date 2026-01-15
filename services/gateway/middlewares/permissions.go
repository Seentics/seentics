package middlewares

import (
	"net/http"

	"github.com/seentics/seentics/services/gateway/models"
)

// HasPermission checks if the authenticated user has the required permission
func HasPermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*models.User)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Admin bypass
			if user.Role == "admin" {
				next.ServeHTTP(w, r)
				return
			}

			// Check if permission exists in user's permissions slice
			hasPerm := false
			for _, p := range user.Permissions {
				if p == permission {
					hasPerm = true
					break
				}
			}

			if !hasPerm {
				http.Error(w, "Forbidden: Missing required permission: "+permission, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// HasRole checks if the authenticated user has the required role
func HasRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*models.User)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			if user.Role != role && user.Role != "admin" {
				http.Error(w, "Forbidden: Role "+role+" required", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
