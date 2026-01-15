package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
)

func GetSubscription(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var sub models.Subscription
	if err := database.DB.Where("user_id = ?", user.ID).First(&sub).Error; err != nil {
		// New users/free plan might not have a record yet
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": map[string]interface{}{
				"plan":   "free",
				"status": "none",
			},
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": sub,
	})
}
