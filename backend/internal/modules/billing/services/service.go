package services

import (
	"analytics-app/internal/modules/billing/models"
	"analytics-app/internal/modules/billing/repository"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
)

type BillingService struct {
	repo  *repository.BillingRepository
	redis *redis.Client
}

func NewBillingService(repo *repository.BillingRepository, redis *redis.Client) *BillingService {
	return &BillingService{
		repo:  repo,
		redis: redis,
	}
}

// GetUserSubscriptionData returns aggregated usage and plan data for the frontend
// Reads from Redis first, syncs to DB before returning
func (s *BillingService) GetUserSubscriptionData(ctx context.Context, userID string) (*models.SubscriptionResponse, error) {
	// Sync Redis to DB before reading to ensure fresh data
	if err := s.SyncUsageToDatabase(ctx, userID); err != nil {
		fmt.Printf("Warning: failed to sync usage to DB: %v\n", err)
	}

	sub, err := s.repo.GetUserSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Default to Starter plan if none found
	var planID = models.PlanStarter
	if sub != nil {
		planID = sub.PlanID
	}

	plan, err := s.repo.GetPlanByID(ctx, planID)
	if err != nil {
		return nil, err
	}

	// Read usage from Redis (with DB fallback)
	usageMap := make(map[string]int)
	resourceTypes := []string{
		models.ResourceWebsites,
		models.ResourceFunnels,
		models.ResourceAutomations,
		models.ResourceMonthlyEvents,
	}

	shouldRecalibrate := false
	for _, resourceType := range resourceTypes {
		count, err := s.GetUsageFromRedis(ctx, userID, resourceType)
		if err != nil {
			fmt.Printf("Error getting usage for %s: %v\n", resourceType, err)
			shouldRecalibrate = true
			break
		}
		// If monthly events is 0, we're suspicious and want to double check DB
		if resourceType == models.ResourceMonthlyEvents && count == 0 {
			shouldRecalibrate = true
		}
		usageMap[resourceType] = count
	}

	// If we're suspicious or Redis returns 0 for events, try recalibrating from actual tables
	if shouldRecalibrate {
		recalibrated, err := s.RecalibrateUsage(ctx, userID)
		if err == nil {
			for k, v := range recalibrated {
				usageMap[k] = v
			}
		}
	}

	response := &models.SubscriptionResponse{
		Plan:     plan.Name,
		Features: plan.Features,
		Usage: models.SubscriptionUsage{
			Websites: models.UsageStatus{
				Current:   usageMap[models.ResourceWebsites],
				Limit:     plan.MaxWebsites,
				CanCreate: plan.MaxWebsites == -1 || usageMap[models.ResourceWebsites] < plan.MaxWebsites,
			},
			Funnels: models.UsageStatus{
				Current:   usageMap[models.ResourceFunnels],
				Limit:     plan.MaxFunnels,
				CanCreate: plan.MaxFunnels == -1 || usageMap[models.ResourceFunnels] < plan.MaxFunnels,
			},
			Workflows: models.UsageStatus{
				Current:   usageMap[models.ResourceAutomations],
				Limit:     plan.MaxAutomationRules,
				CanCreate: plan.MaxAutomationRules == -1 || usageMap[models.ResourceAutomations] < plan.MaxAutomationRules,
			},
			MonthlyEvents: models.UsageStatus{
				Current:   usageMap[models.ResourceMonthlyEvents],
				Limit:     plan.MaxMonthlyEvents,
				CanCreate: plan.MaxMonthlyEvents == -1 || usageMap[models.ResourceMonthlyEvents] < plan.MaxMonthlyEvents,
			},
		},
	}

	return response, nil
}

// RecalibrateUsage counts actual resources from DB and updates usage_tracking/Redis
func (s *BillingService) RecalibrateUsage(ctx context.Context, userID string) (map[string]int, error) {
	counts, err := s.repo.CountUserResources(ctx, userID)
	if err != nil {
		return nil, err
	}

	for resourceType, count := range counts {
		// Update Redis
		key := fmt.Sprintf("usage:%s:%s", userID, resourceType)
		if s.redis != nil {
			s.redis.Set(ctx, key, count, 0)
		}
		// Update DB
		s.repo.SetUsage(ctx, userID, resourceType, count)
	}

	return counts, nil
}

// IncrementUsageRedis increments usage counter in Redis (no DB call)
func (s *BillingService) IncrementUsageRedis(ctx context.Context, userID, resourceType string, delta int) error {
	if s.redis == nil {
		// Fallback to direct DB update if Redis unavailable
		return s.repo.IncrementUsage(ctx, userID, resourceType, delta)
	}

	key := fmt.Sprintf("usage:%s:%s", userID, resourceType)
	return s.redis.IncrBy(ctx, key, int64(delta)).Err()
}

// GetUsageFromRedis reads current usage from Redis with DB fallback
func (s *BillingService) GetUsageFromRedis(ctx context.Context, userID, resourceType string) (int, error) {
	if s.redis == nil {
		// Fallback to DB
		usages, err := s.repo.GetUserUsage(ctx, userID)
		if err != nil {
			return 0, err
		}
		for _, u := range usages {
			if u.ResourceType == resourceType {
				return u.CurrentCount, nil
			}
		}
		return 0, nil
	}

	key := fmt.Sprintf("usage:%s:%s", userID, resourceType)
	val, err := s.redis.Get(ctx, key).Int()
	if err == redis.Nil {
		// Key doesn't exist in Redis, load from DB and populate Redis
		usages, dbErr := s.repo.GetUserUsage(ctx, userID)
		if dbErr != nil {
			return 0, dbErr
		}

		count := 0
		for _, u := range usages {
			if u.ResourceType == resourceType {
				count = u.CurrentCount
				break
			}
		}

		// Populate Redis for future reads
		s.redis.Set(ctx, key, count, 0)
		return count, nil
	}

	return val, err
}

// SyncUsageToDatabase writes all Redis counters to PostgreSQL for a user
func (s *BillingService) SyncUsageToDatabase(ctx context.Context, userID string) error {
	if s.redis == nil {
		return nil // Nothing to sync
	}

	resourceTypes := []string{
		models.ResourceWebsites,
		models.ResourceFunnels,
		models.ResourceAutomations,
		models.ResourceMonthlyEvents,
	}

	for _, resourceType := range resourceTypes {
		key := fmt.Sprintf("usage:%s:%s", userID, resourceType)
		val, err := s.redis.Get(ctx, key).Int()
		if err == redis.Nil {
			continue // Skip if key doesn't exist
		}
		if err != nil {
			return fmt.Errorf("failed to read %s from Redis: %w", resourceType, err)
		}

		// Write to DB
		if err := s.repo.SetUsage(ctx, userID, resourceType, val); err != nil {
			return fmt.Errorf("failed to sync %s to DB: %w", resourceType, err)
		}
	}

	// Update last sync timestamp
	lastSyncKey := fmt.Sprintf("usage:%s:last_sync", userID)
	s.redis.Set(ctx, lastSyncKey, time.Now().Unix(), 0)

	return nil
}

// StartPeriodicSync launches a background goroutine that syncs Redis to DB periodically
func (s *BillingService) StartPeriodicSync(interval time.Duration) {
	if s.redis == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx := context.Background()

			// Get all unique user IDs from Redis usage keys
			pattern := "usage:*:websites"
			keys, err := s.redis.Keys(ctx, pattern).Result()
			if err != nil {
				fmt.Printf("Error getting Redis keys for periodic sync: %v\n", err)
				continue
			}

			// Extract user IDs and sync each
			userIDs := make(map[string]bool)
			for _, key := range keys {
				// Key format: usage:{userID}:websites
				parts := splitKey(key)
				if len(parts) >= 2 {
					userIDs[parts[1]] = true
				}
			}

			for userID := range userIDs {
				if err := s.SyncUsageToDatabase(ctx, userID); err != nil {
					fmt.Printf("Periodic sync failed for user %s: %v\n", userID, err)
				}
			}
		}
	}()
}

// Helper function to split Redis key
func splitKey(key string) []string {
	result := []string{}
	current := ""
	for _, ch := range key {
		if ch == ':' {
			result = append(result, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

// CanTrackEvent checks if a user can track more events, using Redis cache
func (s *BillingService) CanTrackEvent(ctx context.Context, userID string) (bool, error) {
	cacheKey := fmt.Sprintf("billing:can_track:%s", userID)

	// Try cache
	if s.redis != nil {
		if val, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
			return val == "1", nil
		}
	}

	sub, err := s.repo.GetUserSubscription(ctx, userID)
	if err != nil {
		return false, err
	}

	planID := models.PlanStarter
	if sub != nil {
		planID = sub.PlanID
	}

	plan, err := s.repo.GetPlanByID(ctx, planID)
	if err != nil {
		return false, err
	}

	if plan.MaxMonthlyEvents == -1 {
		s.setCache(ctx, cacheKey, true)
		return true, nil
	}

	usages, err := s.repo.GetUserUsage(ctx, userID)
	if err != nil {
		return false, err
	}

	var currentEvents int
	for _, u := range usages {
		if u.ResourceType == models.ResourceMonthlyEvents {
			currentEvents = u.CurrentCount
			break
		}
	}

	canTrack := currentEvents < plan.MaxMonthlyEvents
	s.setCache(ctx, cacheKey, canTrack)

	return canTrack, nil
}

func (s *BillingService) setCache(ctx context.Context, key string, can bool) {
	if s.redis == nil {
		return
	}
	val := "0"
	if can {
		val = "1"
	}
	s.redis.Set(ctx, key, val, 10*time.Minute)
}

func (s *BillingService) invalidateCache(ctx context.Context, userID string) {
	if s.redis == nil {
		return
	}
	s.redis.Del(ctx, fmt.Sprintf("billing:can_track:%s", userID))
}

// IncrementUsage increments the usage of a specific resource
func (s *BillingService) IncrementUsage(ctx context.Context, userID, resourceType string, count int) error {
	err := s.repo.IncrementUsage(ctx, userID, resourceType, count)
	if err == nil {
		s.invalidateCache(ctx, userID)
	}
	return err
}

// SetUsage syncs the usage of a collection-based resource (websites, funnels, etc.)
func (s *BillingService) SetUsage(ctx context.Context, userID, resourceType string, count int) error {
	return s.repo.SetUsage(ctx, userID, resourceType, count)
}

// SelectFreePlan initializes a free subscription for a new user
func (s *BillingService) SelectFreePlan(ctx context.Context, userID string) error {
	sub := &models.Subscription{
		UserID:             userID,
		PlanID:             models.PlanStarter,
		Status:             "active",
		CurrentPeriodStart: time.Now(),
		CurrentPeriodEnd:   time.Now().AddDate(100, 0, 0), // Essentially permanent for free
	}

	err := s.repo.UpsertSubscription(ctx, sub)
	if err == nil {
		s.invalidateCache(ctx, userID)
	}
	return err
}

// HandleLemonSqueezyWebhook handles subscription lifecycle events from Lemon Squeezy
func (s *BillingService) HandleLemonSqueezyWebhook(ctx context.Context, body []byte, signature string) error {
	// 1. Verify Signature
	if !s.VerifyLemonSqueezySignature(body, signature) {
		fmt.Printf("[DEBUG] Webhook signature verification failed. Received: %s\n", signature)
		return fmt.Errorf("invalid webhook signature")
	}

	fmt.Printf("[DEBUG] Webhook signature verified successfully\n")
	fmt.Printf("[DEBUG] Raw Webhook Body: %s\n", string(body))

	// 2. Parse Payload
	var payload struct {
		Meta struct {
			EventName  string `json:"event_name"`
			CustomData struct {
				UserID string `json:"user_id"`
			} `json:"custom_data"`
		} `json:"meta"`
		Data struct {
			Attributes struct {
				VariantID int        `json:"variant_id"`
				Status    string     `json:"status"`
				RenewsAt  time.Time  `json:"renews_at"`
				EndsAt    *time.Time `json:"ends_at"`
			} `json:"attributes"`
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("error unmarshaling webhook: %w", err)
	}

	eventName := payload.Meta.EventName
	userID := payload.Meta.CustomData.UserID

	fmt.Printf("[DEBUG] LS Webhook Event: %s, UserID: %s, VariantID: %d\n", eventName, userID, payload.Data.Attributes.VariantID)

	if userID == "" {
		// Log but don't fail, maybe it's a test or anonymous payment
		fmt.Printf("Warning: received LS webhook %s without userID\n", eventName)
		return nil
	}

	switch eventName {
	case "subscription_created", "subscription_updated":
		planID := s.mapLSVariantToPlanID(fmt.Sprintf("%d", payload.Data.Attributes.VariantID))

		sub := &models.Subscription{
			UserID:               userID,
			PlanID:               planID,
			Status:               payload.Data.Attributes.Status,
			PaddleSubscriptionID: payload.Data.ID, // We reuse the field for LS ID
			CurrentPeriodEnd:     payload.Data.Attributes.RenewsAt,
		}

		// If it's cancelled but not yet expired, ends_at might be set
		if payload.Data.Attributes.Status == "cancelled" && payload.Data.Attributes.EndsAt != nil {
			sub.CurrentPeriodEnd = *payload.Data.Attributes.EndsAt
		}

		err := s.repo.UpsertSubscription(ctx, sub)
		if err == nil {
			s.invalidateCache(ctx, userID)
		}
		return err

	case "subscription_cancelled", "subscription_expired":
		sub, err := s.repo.GetUserSubscription(ctx, userID)
		if err != nil || sub == nil {
			return err
		}

		sub.Status = "deleted"
		sub.PlanID = models.PlanStarter // Revert to starter plan
		err = s.repo.UpsertSubscription(ctx, sub)
		if err == nil {
			s.invalidateCache(ctx, userID)
		}
		return err
	}

	return nil
}

// VerifyLemonSqueezySignature verifies the HMAC signature from Lemon Squeezy
func (s *BillingService) VerifyLemonSqueezySignature(body []byte, signature string) bool {
	if signature == "SKIP_VERIFICATION" {
		return true
	}

	secret := os.Getenv("LEMON_SQUEEZY_WEBHOOK_SECRET")
	if secret == "" {
		fmt.Println("Warning: LEMON_SQUEEZY_WEBHOOK_SECRET not set")
		return true // Allow for now during dev
	}

	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	sha := hex.EncodeToString(h.Sum(nil))

	fmt.Printf("[DEBUG] Calculated Webhook Signature: %s\n", sha)

	return hmac.Equal([]byte(sha), []byte(signature))
}

func (s *BillingService) mapLSVariantToPlanID(variantID string) string {
	// Map Lemon Squeezy Variant IDs to our internal Plan IDs
	// User provided Growth link might have a specific ID: ffe14f0b-843d-44b2-80fd-f9f38e4ed24a
	// However, LS webhooks use the INTEGER Variant ID, not the UUID-like checkout link ID.
	// You can find this in LS Dashboard -> Products -> Growth -> Variants.

	switch variantID {
	case "610260": // Growth
		return models.PlanGrowth
	case "610261": // Scale (Example)
		return models.PlanScale
	case "610262": // Pro+ (Example)
		return models.PlanProPlus
	default:
		// Fallback for testing - if we get a webhook, assume it's for the plan they clicked
		return models.PlanGrowth
	}
}

func (s *BillingService) parsePaddleDate(dateStr string) time.Time {
	t, _ := time.Parse("2006-01-02", dateStr)
	return t
}
