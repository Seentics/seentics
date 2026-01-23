package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// UserUsageCache represents cached usage data for a user
type UserUsageCache struct {
	UserID        string    `json:"user_id"`
	Plan          string    `json:"plan"`
	MonthlyLimit  int       `json:"monthly_limit"`
	CurrentUsage  int       `json:"current_usage"`
	PendingEvents int       `json:"pending_events"` // Events tracked but not yet flushed
	LastUpdated   time.Time `json:"last_updated"`
	CanTrack      bool      `json:"can_track"`
}

// UsageTracker manages in-memory usage tracking with periodic database flushes
type UsageTracker struct {
	cache          map[string]*UserUsageCache
	cacheMutex     sync.RWMutex
	logger         zerolog.Logger
	userServiceURL string
	globalAPIKey   string
	flushInterval  time.Duration
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
}

// NewUsageTracker creates a new usage tracker with in-memory caching
func NewUsageTracker(logger zerolog.Logger) *UsageTracker {
	ctx, cancel := context.WithCancel(context.Background())

	tracker := &UsageTracker{
		cache:          make(map[string]*UserUsageCache),
		logger:         logger,
		userServiceURL: getEnvOrDefault("USER_SERVICE_URL", "http://api-gateway:8080"),
		globalAPIKey:   getEnvOrDefault("GLOBAL_API_KEY", ""),
		flushInterval:  10 * time.Minute,
		ctx:            ctx,
		cancel:         cancel,
	}

	// Start background flush routine
	tracker.startFlushRoutine()

	return tracker
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// CheckEventLimit checks if user can track events (in-memory check)
func (ut *UsageTracker) CheckEventLimit(userID string, eventCount int) (bool, error) {
	if userID == "" {
		return true, nil
	}

	ut.cacheMutex.RLock()
	userCache, exists := ut.cache[userID]
	ut.cacheMutex.RUnlock()

	if !exists || time.Since(userCache.LastUpdated) > 30*time.Minute {
		if err := ut.refreshUserCache(userID); err != nil {
			ut.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to refresh user cache")
			return true, nil
		}

		ut.cacheMutex.RLock()
		userCache = ut.cache[userID]
		ut.cacheMutex.RUnlock()
	}

	if userCache == nil {
		return true, nil
	}

	totalUsage := userCache.CurrentUsage + userCache.PendingEvents + eventCount
	if totalUsage > userCache.MonthlyLimit && userCache.MonthlyLimit > 0 {
		return false, nil
	}

	return userCache.CanTrack, nil
}

// TrackEvents increments the pending event count in memory
func (ut *UsageTracker) TrackEvents(userID string, eventCount int) error {
	if userID == "" {
		return nil
	}

	ut.cacheMutex.Lock()
	defer ut.cacheMutex.Unlock()

	userCache, exists := ut.cache[userID]
	if !exists {
		ut.cacheMutex.Unlock()
		if err := ut.refreshUserCache(userID); err != nil {
			return err
		}
		ut.cacheMutex.Lock()
		userCache = ut.cache[userID]
	}

	if userCache != nil {
		userCache.PendingEvents += eventCount
	}

	return nil
}

// refreshUserCache fetches latest usage data from user service
func (ut *UsageTracker) refreshUserCache(userID string) error {
	if ut.userServiceURL == "" || ut.globalAPIKey == "" {
		return fmt.Errorf("user service not configured")
	}

	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("%s/api/v1/user/billing/usage", ut.userServiceURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-API-Key", ut.globalAPIKey)
	req.Header.Set("X-User-ID", userID)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call user service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("user service returned status %d", resp.StatusCode)
	}

	var usageResp struct {
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

	if err := json.NewDecoder(resp.Body).Decode(&usageResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	if !usageResp.Success {
		return fmt.Errorf("user service returned unsuccessful response")
	}

	// Update cache
	ut.cacheMutex.Lock()
	ut.cache[userID] = &UserUsageCache{
		UserID:        userID,
		Plan:          usageResp.Data.Plan,
		MonthlyLimit:  usageResp.Data.Usage.MonthlyEvents.Limit,
		CurrentUsage:  usageResp.Data.Usage.MonthlyEvents.Current,
		PendingEvents: 0,
		LastUpdated:   time.Now(),
		CanTrack:      usageResp.Data.Usage.MonthlyEvents.CanTrack,
	}
	ut.cacheMutex.Unlock()

	return nil
}

// startFlushRoutine starts the background routine to flush pending events
func (ut *UsageTracker) startFlushRoutine() {
	ut.wg.Add(1)
	go func() {
		defer ut.wg.Done()

		ticker := time.NewTicker(ut.flushInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ut.ctx.Done():
				ut.flushPendingEvents()
				return
			case <-ticker.C:
				ut.flushPendingEvents()
			}
		}
	}()
}

// flushPendingEvents sends all pending events
func (ut *UsageTracker) flushPendingEvents() {
	ut.cacheMutex.Lock()
	usersToFlush := make(map[string]int)
	for userID, userCache := range ut.cache {
		if userCache.PendingEvents > 0 {
			usersToFlush[userID] = userCache.PendingEvents
			userCache.CurrentUsage += userCache.PendingEvents
			userCache.PendingEvents = 0
		}
	}
	ut.cacheMutex.Unlock()

	if len(usersToFlush) == 0 {
		return
	}

	for userID, eventCount := range usersToFlush {
		if err := ut.flushUserEvents(userID, eventCount); err != nil {
			ut.cacheMutex.Lock()
			if userCache, exists := ut.cache[userID]; exists {
				userCache.CurrentUsage -= eventCount
				userCache.PendingEvents += eventCount
			}
			ut.cacheMutex.Unlock()
		}
	}
}

// flushUserEvents sends a single user's pending events
func (ut *UsageTracker) flushUserEvents(userID string, eventCount int) error {
	return ut.IncrementUsage(userID, "monthlyEvents", eventCount)
}

// GetCacheStats returns statistics about the usage cache
func (ut *UsageTracker) GetCacheStats() map[string]interface{} {
	ut.cacheMutex.RLock()
	defer ut.cacheMutex.RUnlock()

	totalPending := 0
	for _, userCache := range ut.cache {
		totalPending += userCache.PendingEvents
	}

	return map[string]interface{}{
		"cached_users":    len(ut.cache),
		"total_pending":   totalPending,
		"flush_interval":  ut.flushInterval.String(),
		"last_flush_time": time.Now().Format(time.RFC3339),
	}
}

// IncrementUsage increments usage count
func (ut *UsageTracker) IncrementUsage(userID, resourceType string, count int) error {
	if userID == "" || ut.userServiceURL == "" || ut.globalAPIKey == "" {
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

	client := &http.Client{Timeout: 10 * time.Second}
	url := fmt.Sprintf("%s/api/v1/user/billing/usage/increment", ut.userServiceURL)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", ut.globalAPIKey)
	req.Header.Set("X-User-ID", userID)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("increment usage failed with status: %d", resp.StatusCode)
	}

	return nil
}

// DecrementUsage decrements usage count
func (ut *UsageTracker) DecrementUsage(userID, resourceType string, count int) error {
	if userID == "" || ut.userServiceURL == "" || ut.globalAPIKey == "" {
		return nil
	}

	decrementData := map[string]interface{}{
		"type":  resourceType,
		"count": count,
	}

	jsonData, err := json.Marshal(decrementData)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := fmt.Sprintf("%s/api/v1/user/billing/usage/decrement", ut.userServiceURL)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", ut.globalAPIKey)
	req.Header.Set("X-User-ID", userID)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// Shutdown gracefully shuts down the usage tracker
func (ut *UsageTracker) Shutdown() {
	ut.cancel()
	ut.wg.Wait()
}
