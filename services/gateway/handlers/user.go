package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
)

func GetProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Preload websites and other relations if needed
	database.DB.Preload("Websites").First(user)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    user,
	})
}

func GetUserWebsitesInternal(w http.ResponseWriter, r *http.Request) {
	// Extract userID from URL (assuming path is /api/internal/users/:userId/websites)
	// Simple path parsing
	path := r.URL.Path
	// Expected: /api/internal/users/{userId}/websites
	// Shift /api/internal/users/
	const prefix = "/api/internal/users/"
	if len(path) <= len(prefix) {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	userId := path[len(prefix) : len(path)-len("/websites")]
	if userId == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	var websites []models.Website
	if err := database.DB.Where("user_id = ?", userId).Find(&websites).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    websites,
	})
}
