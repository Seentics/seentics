package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Extract domain and siteId from multiple sources with priority
func ExtractRequestData(r *http.Request) (*RequestData, error) {
	data := &RequestData{}

	// 1. First priority: Check query parameters
	if siteID := r.URL.Query().Get("siteId"); siteID != "" {
		data.SiteID = siteID
		data.Source = "query"
	}
	if siteID := r.URL.Query().Get("website_id"); siteID != "" {
		data.SiteID = siteID
		data.Source = "query"
	}
	if domain := r.URL.Query().Get("domain"); domain != "" {
		data.Domain = domain
		data.Source = "query"
	}

	// 2. Second priority: Check headers
	if data.SiteID == "" {
		if siteID := r.Header.Get("X-Site-ID"); siteID != "" {
			data.SiteID = siteID
			data.Source = "header"
		}
	}
	if data.Domain == "" {
		if domain := r.Header.Get("X-Domain"); domain != "" {
			data.Domain = domain
			data.Source = "header"
		}
	}

	// 3. Third priority: Check body payload (for POST/PUT requests)
	if (data.SiteID == "" || data.Domain == "") &&
		(r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH") {

		bodyData, err := extractFromBody(r)
		if err != nil {
			// Failed to extract from body
		} else {
			if data.SiteID == "" && bodyData.SiteID != "" {
				data.SiteID = bodyData.SiteID
				data.Source = "body"
			}
			if data.Domain == "" && bodyData.Domain != "" {
				data.Domain = bodyData.Domain
				data.Source = "body"
			}
		}
	}

	// 4. Fifth priority: Extract website ID from URL path
	if data.SiteID == "" {
		pathSiteID := ExtractWebsiteIDFromPath(r.URL.Path)
		if pathSiteID != "" {
			data.SiteID = pathSiteID
			data.Source = "path"
		}
	}

	// 5. Sixth priority: Extract domain from Origin/Referer headers
	if data.Domain == "" {
		if origin := r.Header.Get("Origin"); origin != "" {
			domain := strings.TrimPrefix(origin, "https://")
			domain = strings.TrimPrefix(domain, "http://")
			data.Domain = strings.Split(domain, ":")[0]
			data.Source = "origin"
		} else if referer := r.Header.Get("Referer"); referer != "" {
			domain := strings.TrimPrefix(referer, "https://")
			domain = strings.TrimPrefix(domain, "http://")
			data.Domain = strings.Split(domain, "/")[0]
			data.Source = "referer"
		}
	}

	return data, nil
}

// Extract domain and siteId from request body
func extractFromBody(r *http.Request) (*RequestData, error) {
	// Read the body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read request body: %v", err)
	}

	// Restore the body for downstream services
	r.Body = io.NopCloser(bytes.NewReader(body))

	// Parse JSON body
	var bodyData map[string]interface{}
	if err := json.Unmarshal(body, &bodyData); err != nil {
		// If not JSON, return empty data (not an error for our use case)
		return &RequestData{}, nil
	}

	data := &RequestData{}

	// Extract siteId from body - check ALL possible field names from your payload
	if siteID, ok := bodyData["siteId"].(string); ok {
		data.SiteID = siteID
	} else if websiteID, ok := bodyData["websiteId"].(string); ok {
		data.SiteID = websiteID
	} else if websiteID, ok := bodyData["website_id"].(string); ok {
		data.SiteID = websiteID
	}

	// Domain should NEVER be trusted from client payload for security
	// Domain will be extracted from Origin/Referer headers only

	return data, nil
}

// Extract websiteId from URL path for dashboard routes
func ExtractWebsiteIDFromPath(path string) string {
	// Remove trailing slash if present
	path = strings.TrimSuffix(path, "/")

	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return ""
	}

	// Handle specific patterns
	// /api/v1/workflows/site/{websiteId}/active
	if len(parts) >= 5 && parts[3] == "site" && IsValidWebsiteID(parts[4]) {
		return parts[4]
	}

	// Most websiteId will come at the end of the path
	// Examples:
	// /api/v1/analytics/dashboard/{websiteId}
	// /api/v1/websites/{websiteId}
	// /api/v1/workflows/{websiteId}
	// /api/v1/analytics/{websiteId}/events
	// /api/v1/analytics/{websiteId}/sessions

	lastPart := parts[len(parts)-1]

	// Check if last part looks like a websiteId (basic validation)
	// Website IDs should be MongoDB ObjectIds (24 hex characters) or similar
	// Avoid extracting common path segments like 'triggers', 'events', 'analytics', etc.
	commonPathSegments := []string{"triggers", "events", "analytics", "dashboard", "workflows", "sessions", "users", "websites"}

	for _, segment := range commonPathSegments {
		if lastPart == segment {
			return "" // Don't extract common path segments as website IDs
		}
	}

	// Check if last part looks like a websiteId (basic validation)
	// Assuming websiteId is alphanumeric and longer than 3 chars
	if len(lastPart) > 3 && IsValidWebsiteID(lastPart) {
		return lastPart
	}

	// Fallback: check second to last for cases like /api/v1/analytics/{websiteId}/events
	if len(parts) >= 2 {
		secondToLast := parts[len(parts)-2]
		if len(secondToLast) > 3 && IsValidWebsiteID(secondToLast) {
			return secondToLast
		}
	}

	return ""
}

// Helper function to validate if a string looks like a websiteId
func IsValidWebsiteID(id string) bool {
	// Basic validation - adjust based on your websiteId format
	// This assumes websiteId contains alphanumeric characters, hyphens, or underscores
	for _, char := range id {
		if !((char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '-' || char == '_') {
			return false
		}
	}
	return true
}
