package privacy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Website represents a website from the user service
type Website struct {
	ID     string `json:"_id"`
	Name   string `json:"name"`
	Domain string `json:"domain"`
	UserID string `json:"userId"`
}

// UserServiceResponse represents the response from user service
type UserServiceResponse struct {
	Success bool      `json:"success"`
	Data    []Website `json:"data"`
}

// GetUserWebsitesFromUserService gets all websites owned by a user from the user service
func (r *PrivacyRepository) GetUserWebsitesFromUserService(userID string) ([]string, error) {
	// Make HTTP call to user service to get websites
	userServiceURL := os.Getenv("USER_SERVICE_URL")
	if userServiceURL == "" {
		userServiceURL = "http://api-gateway:8080" // Default fallback (Gateway now handles user info)
	}

	url := fmt.Sprintf("%s/api/internal/users/%s/websites", userServiceURL, userID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return []string{}, fmt.Errorf("failed to create request: %w", err)
	}

	// Add API key for internal service communication
	apiKey := os.Getenv("GLOBAL_API_KEY")
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to call user service for user %s: %v\n", userID, err)
		// Fallback to analytics data method
		return r.getWebsitesFromAnalyticsData(userID)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("User service returned status %d for user %s\n", resp.StatusCode, userID)
		// Fallback to analytics data method
		return r.getWebsitesFromAnalyticsData(userID)
	}

	var response UserServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		fmt.Printf("Failed to decode user service response for user %s: %v\n", userID, err)
		// Fallback to analytics data method
		return r.getWebsitesFromAnalyticsData(userID)
	}

	if !response.Success {
		fmt.Printf("User service returned error for user %s\n", userID)
		// Fallback to analytics data method
		return r.getWebsitesFromAnalyticsData(userID)
	}

	// Extract website IDs
	var websiteIDs []string
	for _, website := range response.Data {
		websiteIDs = append(websiteIDs, website.ID)
	}

	fmt.Printf("Retrieved %d websites from user service for user %s: %v\n", len(websiteIDs), userID, websiteIDs)
	return websiteIDs, nil
}

// getWebsitesFromAnalyticsData is a fallback method to get websites from analytics data
func (r *PrivacyRepository) getWebsitesFromAnalyticsData(userID string) ([]string, error) {
	fmt.Printf("Using fallback method to get websites from analytics data for user %s\n", userID)

	query := `SELECT DISTINCT website_id FROM events WHERE visitor_id = $1 OR session_id LIKE $2`

	rows, err := r.db.Query(context.Background(), query, userID, userID+"%")
	if err != nil {
		return []string{}, fmt.Errorf("failed to query user websites: %w", err)
	}
	defer rows.Close()

	var websiteIDs []string
	for rows.Next() {
		var websiteID string
		if err := rows.Scan(&websiteID); err != nil {
			continue // Skip invalid entries
		}
		websiteIDs = append(websiteIDs, websiteID)
	}

	return websiteIDs, nil
}

// GetUserWebsites gets all websites owned by a user (legacy method)
func (r *PrivacyRepository) GetUserWebsites(userID string) ([]string, error) {
	// Use the new method
	return r.GetUserWebsitesFromUserService(userID)
}

// LogPrivacyOperation logs privacy operations for audit purposes
func (r *PrivacyRepository) LogPrivacyOperation(operation, userID, details string) error {
	// Create audit log entry in database
	insertQuery := `
		INSERT INTO privacy_audit_log (operation, user_id, details, timestamp, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	// For system operations, we don't have IP or user agent
	var ipAddress, userAgent *string

	_, err := r.db.Exec(context.Background(), insertQuery,
		operation, userID, details, time.Now().UTC(), ipAddress, userAgent)

	if err != nil {
		// If the audit log table doesn't exist, just log to console
		// In production, you would ensure the table exists
		fmt.Printf("Privacy operation logged: %s for user %s - %s\n", operation, userID, details)
		return nil
	}

	return nil
}
