package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
)

type EventRepository interface {
	Create(ctx context.Context, event *models.Event) error
	CreateBatch(ctx context.Context, events []models.Event) (*BatchResult, error)
	GetTotalEventCount(ctx context.Context) (int64, error)
	GetEventsToday(ctx context.Context) (int64, error)
	GetUniqueVisitorsToday(ctx context.Context) (int64, error)
	GetTotalPageviews(ctx context.Context) (int64, error)
	GetByWebsiteID(ctx context.Context, websiteID string, limit, offset int) ([]models.Event, error)
	HealthCheck(ctx context.Context) error
}
