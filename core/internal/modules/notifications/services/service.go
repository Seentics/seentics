package services

import (
	"analytics-app/internal/modules/notifications/models"
	"analytics-app/internal/modules/notifications/repository"
	"context"
)

type NotificationService struct {
	repo *repository.NotificationRepository
}

func NewNotificationService(repo *repository.NotificationRepository) *NotificationService {
	return &NotificationService{repo: repo}
}

func (s *NotificationService) CreateNotification(ctx context.Context, userID, nType, title, message, link string) error {
	return s.repo.Create(ctx, &models.Notification{
		UserID:  userID,
		Type:    nType,
		Title:   title,
		Message: message,
		Link:    link,
	})
}

func (s *NotificationService) GetUserNotifications(ctx context.Context, userID string) ([]models.Notification, error) {
	return s.repo.List(ctx, userID)
}

func (s *NotificationService) MarkRead(ctx context.Context, id, userID string) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllAsRead(ctx, userID)
}
