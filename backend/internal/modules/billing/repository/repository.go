package repository

import (
	"analytics-app/internal/modules/billing/models"
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillingRepository struct {
	db *pgxpool.Pool
}

func NewBillingRepository(db *pgxpool.Pool) *BillingRepository {
	return &BillingRepository{
		db: db,
	}
}

// GetUserSubscription retrieves a user's subscription and linked plan
func (r *BillingRepository) GetUserSubscription(ctx context.Context, userID string) (*models.Subscription, error) {
	query := `
		SELECT s.id, s.user_id, s.plan_id, s.status, s.paddle_subscription_id, s.paddle_customer_id,
		       s.current_period_start, s.current_period_end, s.cancel_at_period_end, s.created_at, s.updated_at,
		       p.id, p.name, p.description, p.max_monthly_events, p.max_websites, p.max_funnels, 
		       p.max_automation_rules, p.max_connected_domains, p.features
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		WHERE s.user_id = $1
	`

	var s models.Subscription
	var p models.Plan

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&s.ID, &s.UserID, &s.PlanID, &s.Status, &s.PaddleSubscriptionID, &s.PaddleCustomerID,
		&s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.CancelAtPeriodEnd, &s.CreatedAt, &s.UpdatedAt,
		&p.ID, &p.Name, &p.Description, &p.MaxMonthlyEvents, &p.MaxWebsites, &p.MaxFunnels,
		&p.MaxAutomationRules, &p.MaxConnectedDomains, &p.Features,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No subscription found, should handle default plan elsewhere
		}
		return nil, fmt.Errorf("failed to get user subscription: %w", err)
	}

	s.Plan = &p
	return &s, nil
}

// GetPlanByID retrieves a plan by its ID
func (r *BillingRepository) GetPlanByID(ctx context.Context, planID string) (*models.Plan, error) {
	query := `
		SELECT id, name, description, max_monthly_events, max_websites, max_funnels, 
		       max_automation_rules, max_connected_domains, features
		FROM plans
		WHERE id = $1
	`

	var p models.Plan
	err := r.db.QueryRow(ctx, query, planID).Scan(
		&p.ID, &p.Name, &p.Description, &p.MaxMonthlyEvents, &p.MaxWebsites, &p.MaxFunnels,
		&p.MaxAutomationRules, &p.MaxConnectedDomains, &p.Features,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get plan: %w", err)
	}

	return &p, nil
}

// UpsertSubscription updates or inserts a user subscription
func (r *BillingRepository) UpsertSubscription(ctx context.Context, s *models.Subscription) error {
	query := `
		INSERT INTO subscriptions (user_id, plan_id, status, paddle_subscription_id, paddle_customer_id, 
		                         current_period_start, current_period_end, cancel_at_period_end, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			plan_id = EXCLUDED.plan_id,
			status = EXCLUDED.status,
			paddle_subscription_id = EXCLUDED.paddle_subscription_id,
			paddle_customer_id = EXCLUDED.paddle_customer_id,
			current_period_start = EXCLUDED.current_period_start,
			current_period_end = EXCLUDED.current_period_end,
			cancel_at_period_end = EXCLUDED.cancel_at_period_end,
			updated_at = NOW()
	`

	_, err := r.db.Exec(ctx, query,
		s.UserID, s.PlanID, s.Status, s.PaddleSubscriptionID, s.PaddleCustomerID,
		s.CurrentPeriodStart, s.CurrentPeriodEnd, s.CancelAtPeriodEnd,
	)

	return err
}

// GetUserUsage retrieves usage for a user across all resources
func (r *BillingRepository) GetUserUsage(ctx context.Context, userID string) ([]models.Usage, error) {
	query := `SELECT user_id, resource_type, current_count, reset_at FROM usage_tracking WHERE user_id = $1`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usages []models.Usage
	for rows.Next() {
		var u models.Usage
		if err := rows.Scan(&u.UserID, &u.ResourceType, &u.CurrentCount, &u.ResetAt); err != nil {
			return nil, err
		}
		usages = append(usages, u)
	}

	return usages, nil
}

// IncrementUsage increments the count for a specific resource
func (r *BillingRepository) IncrementUsage(ctx context.Context, userID, resourceType string, count int) error {
	query := `
		INSERT INTO usage_tracking (user_id, resource_type, current_count, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, resource_type) DO UPDATE SET
			current_count = usage_tracking.current_count + EXCLUDED.current_count,
			updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, userID, resourceType, count)
	return err
}

// SetUsage sets the count for a specific resource (useful for resource counting like websites/funnels)
func (r *BillingRepository) SetUsage(ctx context.Context, userID, resourceType string, count int) error {
	query := `
		INSERT INTO usage_tracking (user_id, resource_type, current_count, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, resource_type) DO UPDATE SET
			current_count = EXCLUDED.current_count,
			updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, userID, resourceType, count)
	return err
}

// ResetMonthlyUsage resets the count for a specific resource (e.g. at the end of billing cycle)
func (r *BillingRepository) ResetMonthlyUsage(ctx context.Context, userID, resourceType string, nextReset time.Time) error {
	query := `
		INSERT INTO usage_tracking (user_id, resource_type, current_count, reset_at, updated_at)
		VALUES ($1, $2, 0, $3, NOW())
		ON CONFLICT (user_id, resource_type) DO UPDATE SET
			current_count = 0,
			reset_at = EXCLUDED.reset_at,
			updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, userID, resourceType, nextReset)
	return err
}

// CountUserResources counts actual websites, funnels, and automations from the DB
func (r *BillingRepository) CountUserResources(ctx context.Context, userID string) (map[string]int, error) {
	counts := make(map[string]int)

	// Count websites
	var websitesCount int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM websites WHERE user_id = $1", userID).Scan(&websitesCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count websites: %w", err)
	}
	counts[models.ResourceWebsites] = websitesCount

	// Count funnels
	var funnelsCount int
	err = r.db.QueryRow(ctx, "SELECT COUNT(*) FROM funnels WHERE user_id = $1", userID).Scan(&funnelsCount)
	if err != nil {
		// Table might not exist yet if migration hasn't run or is fresh
		counts[models.ResourceFunnels] = 0
	} else {
		counts[models.ResourceFunnels] = funnelsCount
	}

	// Count automations
	var automationsCount int
	err = r.db.QueryRow(ctx, "SELECT COUNT(*) FROM automations WHERE user_id = $1", userID).Scan(&automationsCount)
	if err != nil {
		counts[models.ResourceAutomations] = 0
	} else {
		counts[models.ResourceAutomations] = automationsCount
	}

	// Count monthly events (all time for now, or join with websites to filter by user)
	// System events (pageviews, etc.)
	var systemEventsCount int
	systemQuery := `
		SELECT COUNT(*) 
		FROM events e 
		JOIN websites w ON e.website_id = w.site_id 
		WHERE w.user_id = $1 
		AND e.created_at >= DATE_TRUNC('month', CURRENT_DATE)
	`
	err = r.db.QueryRow(ctx, systemQuery, userID).Scan(&systemEventsCount)
	if err != nil {
		systemEventsCount = 0
	}

	// Custom events (aggregated)
	var customEventsCount int
	customQuery := `
		SELECT COALESCE(SUM(count), 0) 
		FROM custom_events_aggregated ce 
		JOIN websites w ON ce.website_id = w.site_id 
		WHERE w.user_id = $1 
		AND ce.updated_at >= DATE_TRUNC('month', CURRENT_DATE)
	`
	err = r.db.QueryRow(ctx, customQuery, userID).Scan(&customEventsCount)
	if err != nil {
		customEventsCount = 0
	}

	counts[models.ResourceMonthlyEvents] = systemEventsCount + customEventsCount

	return counts, nil
}
