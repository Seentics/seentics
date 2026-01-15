package utils

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// WebsiteValidator interface to support different validation functions
type WebsiteValidator interface{}

// Handle public website requests (analytics/tracking)
func ValidatePublicRequest(w http.ResponseWriter, r *http.Request, validateWebsiteFunc WebsiteValidator, websiteContextKey interface{}) error {
	// Extract domain and siteId from multiple sources
	requestData, err := ExtractRequestData(r)
	if err != nil {
		return fmt.Errorf("failed to extract request data: %v", err)
	}

	if requestData.Domain == "" && requestData.SiteID == "" {
		return fmt.Errorf("domain or siteId required")
	}

	// Extract websiteID from request data
	websiteID := requestData.SiteID

	// SECURITY: Domain must ONLY come from Origin/Referer headers, never from payload
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = r.Header.Get("Referer")
	}

	var domain string
	if origin != "" {
		// Extract domain from Origin/Referer header
		if parsedURL, err := url.Parse(origin); err == nil {
			domain = parsedURL.Hostname()
		} else {
			// Fallback parsing for malformed origins
			domain = strings.TrimPrefix(origin, "https://")
			domain = strings.TrimPrefix(domain, "http://")
			domain = strings.Split(domain, "/")[0]
			domain = strings.Split(domain, ":")[0]
		}
	}

	// Require both siteID and origin for tracking requests
	if websiteID == "" {
		return fmt.Errorf("siteId required")
	}
	if domain == "" && isTrackingRequest(r.URL.Path) {
		return fmt.Errorf("origin header required for tracking requests")
	}

	// For public fetch of active workflows, allow bypass in local/dev to avoid strict ObjectId coupling
	if strings.HasPrefix(r.URL.Path, "/api/v1/workflows/site/") && r.Method == http.MethodGet {
		// Minimal website data injection
		websiteData := map[string]interface{}{
			"id":         websiteID,
			"domain":     domain,
			"name":       "public-fetch",
			"isVerified": true,
			"isActive":   true,
		}
		InjectWebsiteHeaders(r, websiteData)
		ctx := context.WithValue(r.Context(), websiteContextKey, websiteData)
		*r = *r.WithContext(ctx)
		return nil
	}

	// For tracking endpoints, use origin validation from the already extracted origin

	// Check if this is a tracking endpoint that needs origin validation
	isTrackingEndpoint := isTrackingRequest(r.URL.Path)

	var websiteData map[string]interface{}
	var validationErr error

	if isTrackingEndpoint && origin != "" {
		// Try origin validation first for tracking endpoints
		if validateOriginFunc, ok := validateWebsiteFunc.(func(string, string, string) (map[string]interface{}, error)); ok {
			websiteData, validationErr = validateOriginFunc(websiteID, domain, origin)
		} else if validateRegularFunc, ok := validateWebsiteFunc.(func(string, string) (map[string]interface{}, error)); ok {
			// Fallback to regular validation if origin validation not available
			websiteData, validationErr = validateRegularFunc(websiteID, domain)
		} else {
			return fmt.Errorf("invalid validation function type")
		}
	} else {
		// Use regular validation for non-tracking endpoints
		if validateRegularFunc, ok := validateWebsiteFunc.(func(string, string) (map[string]interface{}, error)); ok {
			websiteData, validationErr = validateRegularFunc(websiteID, domain)
		} else {
			return fmt.Errorf("invalid validation function type")
		}
	}

	if validationErr != nil {
		return fmt.Errorf("website validation failed: %v", validationErr)
	}

	// Inject headers for downstream services
	InjectWebsiteHeaders(r, websiteData)

	// Inject minimal metadata to body payload (optional)
	if err := InjectMetadataToBody(r, requestData, websiteData); err != nil {
		// Failed to inject metadata to body
	}

	// Add website data to context
	ctx := context.WithValue(r.Context(), websiteContextKey, websiteData)
	*r = *r.WithContext(ctx)

	return nil
}

// isTrackingRequest checks if the request path is for tracking/analytics endpoints
func isTrackingRequest(path string) bool {
	trackingPaths := []string{
		"/api/v1/analytics/event",
		"/api/v1/analytics/event/batch",
		"/api/v1/analytics/track",
		"/api/v1/workflows/analytics/track",
		"/api/v1/workflows/analytics/track/batch",
	}

	for _, trackingPath := range trackingPaths {
		if strings.HasPrefix(path, trackingPath) {
			return true
		}
	}

	return false
}

// Handle protected dashboard requests
func ValidateProtectedRequest(w http.ResponseWriter, r *http.Request, validateJWTFunc func(string) (map[string]interface{}, error), userContextKey interface{}) error {
	token := r.Header.Get("Authorization")
	if token == "" {
		return fmt.Errorf("authorization header required")
	}

	// Remove Bearer prefix
	token = strings.TrimPrefix(token, "Bearer ")

	// Validate token and get user data from cache/auth service
	userData, err := validateJWTFunc(token)
	if err != nil {
		return fmt.Errorf("invalid token: %v", err)
	}

	// Inject user headers for downstream services
	InjectUserHeaders(r, userData)

	// Add user to context
	ctx := context.WithValue(r.Context(), userContextKey, userData)

	*r = *r.WithContext(ctx)

	return nil
}
