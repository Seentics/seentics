package middleware

import (
	"analytics-app/config"
	"analytics-app/utils"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type SubscriptionMiddleware struct {
	usersServiceURL string
	globalAPIKey    string
	logger          zerolog.Logger
	usageTracker    *utils.UsageTracker
}

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

func NewSubscriptionMiddleware(logger zerolog.Logger) *SubscriptionMiddleware {
	return &SubscriptionMiddleware{
		usersServiceURL: os.Getenv("USER_SERVICE_URL"),
		globalAPIKey:    os.Getenv("GLOBAL_API_KEY"),
		logger:          logger,
		usageTracker:    utils.NewUsageTracker(logger),
	}
}

func (s *SubscriptionMiddleware) checkUsageLimits(userID, resourceType string) (bool, error) {
	url := fmt.Sprintf("%s/api/v1/user/billing/usage", s.usersServiceURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create usage request: %w", err)
	}

	req.Header.Set("X-API-Key", s.globalAPIKey)
	req.Header.Set("X-User-ID", userID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to send usage request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("usage check failed with status: %d", resp.StatusCode)
	}

	var usageResp UsageResponse
	if err := json.NewDecoder(resp.Body).Decode(&usageResp); err != nil {
		return false, fmt.Errorf("failed to decode usage response: %w", err)
	}

	if !usageResp.Success {
		return false, fmt.Errorf("usage check API returned error")
	}

	switch resourceType {
	case "monthlyEvents":
		return usageResp.Data.Usage.MonthlyEvents.CanTrack, nil
	default:
		return false, fmt.Errorf("unknown resource type: %s", resourceType)
	}
}

// CheckEventLimit middleware (redundant if gateway handles it, but kept for consistency)
func (s *SubscriptionMiddleware) CheckEventLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if config.IsOpenSource() {
			c.Next()
			return
		}

		userID := c.GetHeader("X-Website-User-ID") // Gateway sets this for tracking routes
		if userID == "" {
			userID = c.GetHeader("X-User-ID") // Fallback for authenticated dashboard users
		}

		if userID == "" {
			c.Next() // Allow anonymous tracking
			return
		}

		canTrack, err := s.usageTracker.CheckEventLimit(userID, 1)
		if err != nil {
			c.Next()
			return
		}

		if !canTrack {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Monthly event limit exceeded",
				"message": "You have reached your plan's monthly event tracking limit. Please upgrade your plan to continue tracking events.",
				"code":    "EVENT_LIMIT_REACHED",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (s *SubscriptionMiddleware) CheckBatchEventLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if config.IsOpenSource() {
			c.Next()
			return
		}

		userID := c.GetHeader("X-Website-User-ID")
		if userID == "" {
			userID = c.GetHeader("X-User-ID")
		}

		if userID == "" {
			c.Next()
			return
		}

		var requestBody map[string]interface{}
		if err := c.ShouldBindJSON(&requestBody); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			c.Abort()
			return
		}

		events, ok := requestBody["events"].([]interface{})
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid events array"})
			c.Abort()
			return
		}

		eventCount := len(events)
		canTrack, err := s.usageTracker.CheckEventLimit(userID, eventCount)
		if err != nil {
			c.Set("request_body", requestBody)
			c.Next()
			return
		}

		if !canTrack {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Monthly event limit would be exceeded",
				"message": fmt.Sprintf("Processing %d events would exceed your plan's monthly limit. Please upgrade your plan.", eventCount),
				"code":    "BATCH_EVENT_LIMIT_REACHED",
			})
			c.Abort()
			return
		}

		c.Set("request_body", requestBody)
		c.Next()
	}
}

func (s *SubscriptionMiddleware) IncrementEventUsage(userID string, eventCount int) error {
	if userID == "" {
		return nil
	}
	return s.usageTracker.TrackEvents(userID, eventCount)
}

func (s *SubscriptionMiddleware) IncrementResourceUsage(userID, resourceType string, count int) error {
	if userID == "" || config.IsOpenSource() {
		return nil
	}

	if s.usersServiceURL == "" || s.globalAPIKey == "" {
		return nil
	}

	incrementData := map[string]interface{}{
		"type":  resourceType,
		"count": count,
	}

	jsonData, err := json.Marshal(incrementData)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/v1/user/billing/usage/increment", s.usersServiceURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", s.globalAPIKey)
	req.Header.Set("X-User-ID", userID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (s *SubscriptionMiddleware) GetUsageCacheStats() map[string]interface{} {
	return s.usageTracker.GetCacheStats()
}

func (s *SubscriptionMiddleware) Shutdown() {
	s.usageTracker.Shutdown()
}
