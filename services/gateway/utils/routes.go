package utils

import (
	"fmt"
	"strings"
)

// Route classification
func GetRouteType(path string) string {
	// Remove query parameters for path matching
	cleanPath := strings.Split(path, "?")[0]

	// Debug logging
	fmt.Printf("DEBUG: Checking route type for path: %s\n", cleanPath)

	// Handle exact root path first
	if cleanPath == "/" {
		return "unprotected"
	}

	// Other unprotected routes
	unprotectedPrefixes := []string{
		"/api/v1/user/auth/register",
		"/api/v1/user/auth/login",
		"/api/v1/user/auth/google",
		"/api/v1/user/auth/github",
		"/api/v1/user/support/contact", // Support contact form
		"/api/v1/user/webhooks/",
		"/api/v1/webhooks/",
		"/api/v1/admin/", // Admin routes - authentication handled at frontend level
		"/webhook-test",  // Webhook test endpoint
		"/health",
		"/metrics",
		"/favicon.ico",
		"/robots.txt",
	}

	for _, prefix := range unprotectedPrefixes {
		if strings.HasPrefix(cleanPath, prefix) {
			return "unprotected"
		}
	}

	// Public website routes - domain/siteId validation only
	publicPrefixes := []string{
		"/api/v1/track",
		"/api/v1/analytics/event",
		"/api/v1/analytics/event/batch",
		"/api/v1/analytics/track",
		"/api/v1/workflows/analytics/track",
		"/api/v1/workflows/analytics/track/batch",
		"/api/v1/workflows/site/",
		"/api/v1/workflows/active",           // Active workflows for tracker (public)
		"/api/v1/workflows/execution/action", // Workflow execution (public with validation)
	}

	for _, prefix := range publicPrefixes {
		if strings.HasPrefix(cleanPath, prefix) {
			fmt.Printf("DEBUG: Found public route match: %s -> %s\n", cleanPath, prefix)
			return "public"
		}
	}

	// Protected dashboard routes - JWT + website ownership
	fmt.Printf("DEBUG: No public route match found, returning protected for: %s\n", cleanPath)
	return "protected"
}
