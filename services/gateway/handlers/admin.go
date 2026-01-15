package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
)

// AdminStats represents the admin dashboard statistics
type AdminStats struct {
	TotalUsers     int64                  `json:"total_users"`
	TotalWebsites  int64                  `json:"total_websites"`
	TotalEvents    int64                  `json:"total_events"`
	RecentUsers    []models.User          `json:"recent_users"`
	RecentWebsites []models.Website       `json:"recent_websites"`
	SystemHealth   map[string]interface{} `json:"system_health"`
	Timestamp      time.Time              `json:"timestamp"`
}

// GetAdminStats fetches comprehensive admin statistics
func GetAdminStats(w http.ResponseWriter, r *http.Request) {
	stats := &AdminStats{
		Timestamp: time.Now(),
		SystemHealth: map[string]interface{}{
			"status": "healthy",
		},
	}

	// Fetch user statistics from DB
	database.DB.Model(&models.User{}).Count(&stats.TotalUsers)
	database.DB.Order("created_at desc").Limit(5).Find(&stats.RecentUsers)

	// Fetch website statistics from DB
	database.DB.Model(&models.Website{}).Count(&stats.TotalWebsites)
	database.DB.Order("created_at desc").Limit(5).Find(&stats.RecentWebsites)

	// Fetch analytics statistics from Analytics service
	analyticsStats, err := fetchAnalyticsStats()
	if err == nil {
		stats.TotalEvents = int64(analyticsStats["total_events"].(float64))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GetUsersList fetches paginated list of users from DB
func GetUsersList(w http.ResponseWriter, r *http.Request) {
	var users []models.User
	database.DB.Find(&users)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": users,
	})
}

// GetWebsitesList fetches paginated list of websites from DB
func GetWebsitesList(w http.ResponseWriter, r *http.Request) {
	var websites []models.Website
	database.DB.Find(&websites)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": websites,
	})
}

// Helper functions to fetch data from external services

func fetchAnalyticsStats() (map[string]interface{}, error) {
	return makeServiceRequest(os.Getenv("ANALYTICS_SERVICE_URL") + "/api/v1/admin/analytics/stats")
}

// makeServiceRequest makes HTTP request to internal services
func makeServiceRequest(url string) (map[string]interface{}, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Add API key for inter-service communication
	globalAPIKey := os.Getenv("GLOBAL_API_KEY")
	if globalAPIKey != "" {
		req.Header.Set("X-API-Key", globalAPIKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("service returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return result, nil
}
