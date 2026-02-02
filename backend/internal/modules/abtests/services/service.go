package services

import (
"analytics-app/internal/modules/abtests/models"
"analytics-app/internal/modules/abtests/repository"
"context"
)

type ABTestService struct {
repo *repository.ABTestRepository
}

func NewABTestService(repo *repository.ABTestRepository) *ABTestService {
return &ABTestService{repo: repo}
}

func (s *ABTestService) CreateABTest(ctx context.Context, test *models.ABTest) error {
if test.Status == "" {
test.Status = "draft"
}
return s.repo.Create(ctx, test)
}

func (s *ABTestService) GetWebsiteABTests(ctx context.Context, websiteID string) ([]models.ABTest, error) {
return s.repo.List(ctx, websiteID)
}

func (s *ABTestService) GetABTest(ctx context.Context, id, websiteID string) (*models.ABTest, error) {
return s.repo.GetByID(ctx, id, websiteID)
}
