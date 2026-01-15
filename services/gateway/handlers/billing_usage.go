package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
)

type UsageResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Plan  string `json:"plan"`
		Usage struct {
			MonthlyEvents struct {
				Current  int  `json:"current"`
				Limit    int  `json:"limit"`
				CanTrack bool `json:"canTrack"`
			} `json:"monthlyEvents"`
		} `json:"usage"`
	} `json:"data"`
}

func GetBillingUsage(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		// Also support X-User-ID header for inter-service calls if authenticated by API Key
		userID := r.Header.Get("X-User-ID")
		if userID != "" {
			if err := database.DB.First(&user, userID).Error; err != nil {
				http.Error(w, "User not found", http.StatusNotFound)
				return
			}
		} else {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	// This is a simplified version. In a real app, you'd query dedicated usage tables.
	// For now, let's return some mock/basic data based on plan
	resp := UsageResponse{Success: true}
	resp.Data.Plan = user.Plan

	// Default limits
	eventLimit := 10000

	switch user.Plan {
	case "standard":
		eventLimit = 100000
	case "pro":
		eventLimit = 1000000
	case "enterprise":
		eventLimit = 10000000
	}

	resp.Data.Usage.MonthlyEvents.Limit = eventLimit
	resp.Data.Usage.MonthlyEvents.Current = 0     // TODO: get from redis tracker
	resp.Data.Usage.MonthlyEvents.CanTrack = true // eventCount < eventLimit

	json.NewEncoder(w).Encode(resp)
}

func IncrementBillingUsage(w http.ResponseWriter, r *http.Request) {
	// Logic to increment resource usage in DB/Redis
	// For now, just return success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}
