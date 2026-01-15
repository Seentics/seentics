package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
	// For extractions if needed
)

func WebsiteHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case http.MethodGet:
		var websites []models.Website
		database.DB.Where("user_id = ?", user.ID).Find(&websites)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": websites,
		})

	case http.MethodPost:
		var website models.Website
		if err := json.NewDecoder(r.Body).Decode(&website); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		website.UserID = user.ID
		// Generate site_id if not provided (should be unique)
		if website.SiteID == "" {
			website.SiteID = strings.ReplaceAll(website.URL, ".", "-") + "-dev" // Placeholder logic
		}

		// Set default settings if not provided
		if website.Settings.DataRetentionDays == 0 {
			website.Settings.DataRetentionDays = 365
			website.Settings.TrackingEnabled = true
			if website.Settings.AllowedOrigins == nil {
				website.Settings.AllowedOrigins = []string{}
			}
		}

		if err := database.DB.Create(&website).Error; err != nil {
			http.Error(w, "Failed to create website", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": website,
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func SingleWebsiteHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	pathParts := strings.Split(r.URL.Path, "/")
	websiteID := pathParts[len(pathParts)-1]
	if websiteID == "" && len(pathParts) > 1 {
		websiteID = pathParts[len(pathParts)-2]
	}

	var website models.Website
	if err := database.DB.Where("id = ? AND user_id = ?", websiteID, user.ID).First(&website).Error; err != nil {
		http.Error(w, "Website not found", http.StatusNotFound)
		return
	}

	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": website,
		})
	case http.MethodPut:
		var updateData models.Website
		if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Update allowed fields
		website.Name = updateData.Name
		website.URL = updateData.URL
		website.Settings = updateData.Settings

		if err := database.DB.Save(&website).Error; err != nil {
			http.Error(w, "Failed to update website", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": website,
		})
	case http.MethodDelete:
		database.DB.Delete(&website)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
