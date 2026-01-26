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
