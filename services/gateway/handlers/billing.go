package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/seentics/seentics/services/gateway/database"
	"github.com/seentics/seentics/services/gateway/models"
)

func LemonSqueezyWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusInternalServerError)
		return
	}

	// Verify signature
	signature := r.Header.Get("X-Signature")
	secret := os.Getenv("LEMON_SQUEEZY_WEBHOOK_SECRET")
	if !verifySignature(body, signature, secret) {
		http.Error(w, "Invalid signature", http.StatusForbidden)
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "Error parsing JSON", http.StatusBadRequest)
		return
	}

	eventName := payload["meta"].(map[string]interface{})["event_name"].(string)
	data := payload["data"].(map[string]interface{})
	attributes := data["attributes"].(map[string]interface{})

	log.Printf("Received Lemon Squeezy webhook: %s", eventName)

	switch eventName {
	case "subscription_created", "subscription_updated":
		handleSubscriptionChange(attributes)
	case "subscription_cancelled":
		handleSubscriptionCancellation(attributes)
	}

	w.WriteHeader(http.StatusOK)
}

func verifySignature(body []byte, signature, secret string) bool {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	sha := hex.EncodeToString(h.Sum(nil))
	return sha == signature
}

func handleSubscriptionChange(attrs map[string]interface{}) {
	userEmail := attrs["user_email"].(string)
	lemonID := attrs["id"].(string)
	variantName := attrs["variant_name"].(string) // Use this to determine plan: Standard, Pro, Enterprise
	status := attrs["status"].(string)

	var user models.User
	if err := database.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		log.Printf("User not found for subscription sync: %s", userEmail)
		return
	}

	// Map variant name to internal plan name
	plan := "free"
	switch variantName {
	case "Standard":
		plan = "standard"
	case "Pro":
		plan = "pro"
	case "Enterprise":
		plan = "enterprise"
	}

	// Update user
	database.DB.Model(&user).Updates(map[string]interface{}{
		"plan":            plan,
		"subscription_id": lemonID,
	})

	// Sync Subscription record
	var sub models.Subscription
	database.DB.Where("user_id = ?", user.ID).FirstOrCreate(&sub)

	database.DB.Model(&sub).Updates(map[string]interface{}{
		"lemon_id": lemonID,
		"plan":     plan,
		"status":   status,
	})
}

func handleSubscriptionCancellation(attrs map[string]interface{}) {
	// Revert to free plan on actual end of period
	// logic...
}
