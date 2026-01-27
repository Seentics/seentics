package services

import (
	"analytics-app/internal/modules/billing/models"
	"analytics-app/internal/modules/billing/repository"
	"context"
	"fmt"
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
func (s *BillingService) GetUserSubscriptionData(ctx context.Context, userID string) (*models.SubscriptionResponse, error) {
	sub, err := s.repo.GetUserSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Default to Free plan if none found
	var planID = models.PlanStarter
	if sub != nil {
		planID = sub.PlanID
	}

	plan, err := s.repo.GetPlanByID(ctx, planID)
	if err != nil {
		return nil, err
	}

	usages, err := s.repo.GetUserUsage(ctx, userID)
	if err != nil {
		return nil, err
	}

	usageMap := make(map[string]int)
	for _, u := range usages {
		usageMap[u.ResourceType] = u.CurrentCount
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

// HandlePaddleWebhook handles subscription lifecycle events from Paddle
func (s *BillingService) HandlePaddleWebhook(ctx context.Context, payload map[string]interface{}) error {
	alertName := payload["alert_name"].(string)

	switch alertName {
	case "subscription_created", "subscription_updated":
		userID := payload["passthrough"].(string) // We'll pass the UserID in passthrough
		planID := s.mapPaddlePlanToPlanID(payload["subscription_plan_id"].(string))

		sub := &models.Subscription{
			UserID:               userID,
			PlanID:               planID,
			Status:               payload["status"].(string),
			PaddleSubscriptionID: fmt.Sprintf("%v", payload["subscription_id"]),
			PaddleCustomerID:     fmt.Sprintf("%v", payload["user_id"]),
			CurrentPeriodEnd:     s.parsePaddleDate(payload["next_bill_date"].(string)),
		}

		return s.repo.UpsertSubscription(ctx, sub)

	case "subscription_cancelled":
		userID := payload["passthrough"].(string)
		sub, err := s.repo.GetUserSubscription(ctx, userID)
		if err != nil || sub == nil {
			return err
		}

		sub.Status = "deleted"
		sub.PlanID = models.PlanStarter // Revert to starter plan
		return s.repo.UpsertSubscription(ctx, sub)
	}

	return nil
}

func (s *BillingService) mapPaddlePlanToPlanID(paddlePlanID string) string {
	// Map actual Paddle Plan IDs to our internal Plan IDs
	// This would typically come from config
	return models.PlanGrowth
}

func (s *BillingService) parsePaddleDate(dateStr string) time.Time {
	t, _ := time.Parse("2006-01-02", dateStr)
	return t
}
