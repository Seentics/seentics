package services

import (
	"analytics-app/internal/modules/automations/models"
	"analytics-app/internal/modules/automations/repository"
)

type AutomationService struct {
	repo *repository.AutomationRepository
}

func NewAutomationService(repo *repository.AutomationRepository) *AutomationService {
	return &AutomationService{
		repo: repo,
	}
}

func (s *AutomationService) ListAutomations(websiteID string) ([]models.Automation, error) {
	// Placeholder
	return []models.Automation{}, nil
}
