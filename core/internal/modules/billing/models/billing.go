package models

import (
	"time"
)

// Plan IDs
const (
	PlanStarter = "starter"
	PlanGrowth  = "growth"
	PlanScale   = "scale"
	PlanProPlus = "pro_plus"
)

// Plan represents a subscription tier
type Plan struct {
	ID                  string    `json:"id" db:"id"`
	Name                string    `json:"name" db:"name"`
	Description         string    `json:"description" db:"description"`
	PriceMonthly        float64   `json:"priceMonthly" db:"price_monthly"`
	PriceYearly         float64   `json:"priceYearly" db:"price_yearly"`
	PaddlePlanID        string    `json:"paddlePlanId" db:"paddle_plan_id"`
	MaxMonthlyEvents    int       `json:"maxMonthlyEvents" db:"max_monthly_events"`
	MaxWebsites         int       `json:"maxWebsites" db:"max_websites"`
	MaxFunnels          int       `json:"maxFunnels" db:"max_funnels"`
	MaxAutomationRules  int       `json:"maxAutomationRules" db:"max_automation_rules"`
	MaxHeatmaps         int       `json:"maxHeatmaps" db:"max_heatmaps"`
	MaxReplays          int       `json:"maxReplays" db:"max_replays"`
	MaxConnectedDomains int       `json:"maxConnectedDomains" db:"max_connected_domains"`
	Features            []string  `json:"features" db:"features"`
	CreatedAt           time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt           time.Time `json:"updatedAt" db:"updated_at"`
}

// Subscription represents a user's current plan status
type Subscription struct {
	ID                   string     `json:"id" db:"id"`
	UserID               string     `json:"userId" db:"user_id"`
	PlanID               string     `json:"planId" db:"plan_id"`
	Status               string     `json:"status" db:"status"`
	PaddleSubscriptionID string     `json:"paddleSubscriptionId" db:"paddle_subscription_id"`
	PaddleCustomerID     string     `json:"paddleCustomerId" db:"paddle_customer_id"`
	CurrentPeriodStart   *time.Time `json:"currentPeriodStart" db:"current_period_start"`
	CurrentPeriodEnd     *time.Time `json:"currentPeriodEnd" db:"current_period_end"`
	CancelAtPeriodEnd    bool       `json:"cancelAtPeriodEnd" db:"cancel_at_period_end"`
	CreatedAt            time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time  `json:"updatedAt" db:"updated_at"`

	// Enriched data
	Plan *Plan `json:"plan,omitempty" db:"-"`
}

// Usage represents current usage for a specific resource
type Usage struct {
	UserID       string     `json:"userId" db:"user_id"`
	ResourceType string     `json:"resourceType" db:"resource_type"`
	CurrentCount int        `json:"currentCount" db:"current_count"`
	ResetAt      *time.Time `json:"resetAt" db:"reset_at"`
}

// Resource types
const (
	ResourceMonthlyEvents = "monthly_events"
	ResourceWebsites      = "websites"
	ResourceFunnels       = "funnels"
	ResourceAutomations   = "automations"
	ResourceHeatmaps      = "heatmaps"
	ResourceReplays       = "replays"
)

// UsageStatus represents the status of a specific resource limit
type UsageStatus struct {
	Current   int  `json:"current"`
	Limit     int  `json:"limit"`
	CanCreate bool `json:"canCreate"`
}

// SubscriptionUsage represents aggregated usage data
type SubscriptionUsage struct {
	Websites      UsageStatus `json:"websites"`
	Workflows     UsageStatus `json:"workflows"`
	Funnels       UsageStatus `json:"funnels"`
	Heatmaps      UsageStatus `json:"heatmaps"`
	Replays       UsageStatus `json:"replays"`
	MonthlyEvents UsageStatus `json:"monthlyEvents"`
}

// SubscriptionResponse is the data returned to the frontend
type SubscriptionResponse struct {
	Plan     string            `json:"plan"`
	Usage    SubscriptionUsage `json:"usage"`
	Features []string          `json:"features"`
}
